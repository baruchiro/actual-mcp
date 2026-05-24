import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTools } from './index.js';

vi.mock('../actual-api.js', () => ({
  initActualApi: vi.fn().mockResolvedValue(undefined),
  shutdownActualApi: vi.fn().mockResolvedValue(undefined),
}));

interface RequestHandlerInvocation {
  (request: { params: { name: string; arguments?: unknown } }): Promise<{
    isError?: boolean;
    content: { type: string; text: string }[];
    _meta?: Record<string, unknown>;
  }>;
}

function captureHandler(): {
  server: { setRequestHandler: ReturnType<typeof vi.fn> };
  getCallHandler: () => RequestHandlerInvocation;
} {
  const handlers = new Map<unknown, unknown>();
  const setRequestHandler = vi.fn((schema, handler) => {
    handlers.set(schema, handler);
  });
  return {
    server: { setRequestHandler } as { setRequestHandler: ReturnType<typeof vi.fn> },
    getCallHandler: () => {
      // The CallToolRequestSchema is the second handler registered.
      const entries = Array.from(handlers.values());
      const handler = entries[1] as RequestHandlerInvocation;
      if (!handler) throw new Error('CallTool handler not registered');
      return handler;
    },
  };
}

describe('setupTools error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a structured error for unknown tools, never crashing', async () => {
    const { server, getCallHandler } = captureHandler();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setupTools(server as any, false);

    const result = await getCallHandler()({
      params: { name: 'not-a-real-tool', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not-a-real-tool');
    expect(result.content[0].text).toContain('unknown_tool');
    expect(result._meta).toMatchObject({ tool: 'not-a-real-tool', code: 'unknown_tool' });
  });

  it('does not leak "[object Object]" when a tool handler rejects with a plain object', async () => {
    // Mock a tool that rejects with a non-Error reason (the exact failure mode
    // reported in issue #23 — the Actual API rejects with `#<Object>`).
    const { server, getCallHandler } = captureHandler();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setupTools(server as any, false);

    // get-accounts is registered as a read tool; mock its handler module to reject.
    // Since we cannot easily intercept the bound import, instead exercise the
    // dispatcher with a known tool name by calling it with arguments designed
    // to fail downstream (initActualApi mocked to throw a plain object).
    const { initActualApi } = await import('../actual-api.js');
    vi.mocked(initActualApi).mockRejectedValueOnce({ reason: 'budget unavailable' });

    const result = await getCallHandler()({
      params: { name: 'get-accounts', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain('[object Object]');
    expect(result.content[0].text).toContain('budget unavailable');
    expect(result.content[0].text).toContain('get-accounts');
  });

  it('shuts down the API after the handler completes (not before)', async () => {
    const { server, getCallHandler } = captureHandler();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setupTools(server as any, false);

    const { initActualApi, shutdownActualApi } = await import('../actual-api.js');
    const order: string[] = [];
    vi.mocked(initActualApi).mockImplementation(async () => {
      order.push('init');
    });
    vi.mocked(shutdownActualApi).mockImplementation(async () => {
      order.push('shutdown');
    });

    await getCallHandler()({
      params: { name: 'definitely-unknown-tool', arguments: {} },
    });

    expect(order).toEqual(['init', 'shutdown']);
  });
});
