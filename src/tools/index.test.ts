import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Actual API lifecycle so we can assert the cache wiring without a real budget.
vi.mock('../actual-api.js', () => ({
  initActualApi: vi.fn(),
  syncBudget: vi.fn(),
  scheduleShutdown: vi.fn(),
}));

import { initActualApi, syncBudget, scheduleShutdown } from '../actual-api.js';
import { setupTools } from './index.js';

type ToolHandler = (request: { params: { name: string; arguments?: unknown } }, extra: unknown) => Promise<unknown>;

/**
 * Build the tools and return the registered call-tool handler.
 */
function getCallToolHandler(enableWrite = false): ToolHandler {
  const handlers = new Map<unknown, unknown>();
  const fakeServer = {
    setRequestHandler: (schema: unknown, handler: unknown) => {
      handlers.set(schema, handler);
    },
  } as unknown as Server;

  setupTools(fakeServer, enableWrite);
  return handlers.get(CallToolRequestSchema) as ToolHandler;
}

describe('tools call handler — budget cache wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(scheduleShutdown).mockReturnValue(undefined);
  });

  it('syncs when a cached budget was reused, then schedules shutdown (happy path)', async () => {
    vi.mocked(initActualApi).mockResolvedValue(true); // reused cached budget
    const handler = getCallToolHandler();

    await handler({ params: { name: 'does-not-exist', arguments: {} } }, {});

    expect(initActualApi).toHaveBeenCalledTimes(1);
    expect(syncBudget).toHaveBeenCalledTimes(1);
    expect(scheduleShutdown).toHaveBeenCalledTimes(1);
  });

  it('skips sync after a fresh init but still schedules shutdown (edge case)', async () => {
    vi.mocked(initActualApi).mockResolvedValue(false); // freshly initialized -> already current
    const handler = getCallToolHandler();

    const result = await handler({ params: { name: 'does-not-exist', arguments: {} } }, {});

    expect(syncBudget).not.toHaveBeenCalled();
    expect(scheduleShutdown).toHaveBeenCalledTimes(1);
    // Unknown tool surfaces as a structured error rather than throwing.
    expect(result).toMatchObject({ isError: true });
  });

  it('schedules shutdown even when initialization throws (failure case)', async () => {
    vi.mocked(initActualApi).mockRejectedValue(new Error('init boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = getCallToolHandler();

    const result = await handler({ params: { name: 'get-accounts', arguments: {} } }, {});

    expect(result).toMatchObject({ isError: true });
    // finally must always run so the API doesn't stay pinned open after a failure.
    expect(scheduleShutdown).toHaveBeenCalledTimes(1);
  });
});
