import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from './server.js';

vi.mock('./resources.js', () => ({
  setupResources: vi.fn(),
}));

vi.mock('./tools/index.js', () => ({
  setupTools: vi.fn(),
}));

vi.mock('./prompts.js', () => ({
  setupPrompts: vi.fn(),
}));

import { setupResources } from './resources.js';
import { setupTools } from './tools/index.js';
import { setupPrompts } from './prompts.js';

describe('createServer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(setupResources).mockReset();
    vi.mocked(setupTools).mockReset();
    vi.mocked(setupPrompts).mockReset();
  });

  it('wires up resources, tools, and prompts on the returned server (happy path)', () => {
    const server = createServer({ enableWrite: false });

    expect(server).toBeInstanceOf(Server);
    expect(setupResources).toHaveBeenCalledWith(server);
    expect(setupTools).toHaveBeenCalledWith(server, false);
    expect(setupPrompts).toHaveBeenCalledWith(server);
  });

  it('creates an independent instance per call so concurrent connections never share state (edge case)', () => {
    const server1 = createServer({ enableWrite: false });
    const server2 = createServer({ enableWrite: true });

    expect(server1).not.toBe(server2);
    // enableWrite must be threaded through per instance.
    expect(setupTools).toHaveBeenNthCalledWith(1, server1, false);
    expect(setupTools).toHaveBeenNthCalledWith(2, server2, true);
  });

  it('registers a SetLevel handler that logs to stderr and returns an empty result', () => {
    // Capture the handler registered for the logging/setLevel request.
    const setRequestHandlerSpy = vi.spyOn(Server.prototype, 'setRequestHandler');
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    createServer({ enableWrite: false });

    const registration = setRequestHandlerSpy.mock.calls.find(([schema]) => schema === SetLevelRequestSchema);
    expect(registration).toBeDefined();

    const handler = registration![1] as unknown as (request: { params: { level: string } }, extra: unknown) => unknown;
    const result = handler({ params: { level: 'debug' } }, {});

    expect(result).toEqual({});
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('debug'));
  });

  it('propagates errors from setup steps so a misconfigured server fails fast (failure case)', () => {
    vi.mocked(setupTools).mockImplementationOnce(() => {
      throw new Error('tool setup failed');
    });

    expect(() => createServer({ enableWrite: false })).toThrow('tool setup failed');
  });
});
