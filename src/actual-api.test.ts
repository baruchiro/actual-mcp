import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Actual Budget API default export and fs so we never touch a real budget.
const mockApi = {
  init: vi.fn(),
  getBudgets: vi.fn(),
  downloadBudget: vi.fn(),
  shutdown: vi.fn(),
};

vi.mock('@actual-app/api', () => ({
  default: mockApi,
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

/**
 * Load a fresh copy of the module so the internal `initialized`/`initializing`
 * state does not leak between tests.
 */
async function loadModule(): Promise<typeof import('./actual-api.js')> {
  vi.resetModules();
  return import('./actual-api.js');
}

describe('actual-api init/shutdown stability (#96)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getBudgets.mockResolvedValue([{ id: 'budget-1', cloudFileId: 'budget-1' }]);
    mockApi.init.mockResolvedValue(undefined);
    mockApi.downloadBudget.mockResolvedValue(undefined);
    mockApi.shutdown.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes the API once (happy path)', async () => {
    const { initActualApi } = await loadModule();

    await initActualApi();
    await initActualApi(); // already initialized -> no second init

    expect(mockApi.init).toHaveBeenCalledTimes(1);
    expect(mockApi.downloadBudget).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent init calls so init() runs only once (edge case)', async () => {
    const { initActualApi } = await loadModule();

    // Make init() pause so both callers overlap; they must share the single
    // memoized init promise rather than each racing into api.init().
    let resolveInit: () => void = () => {};
    mockApi.init.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveInit = resolve;
        })
    );

    const first = initActualApi();
    const second = initActualApi();

    resolveInit();
    await Promise.all([first, second]);

    expect(mockApi.init).toHaveBeenCalledTimes(1);
  });

  it('swallows shutdown errors and still resets state (failure case)', async () => {
    const { initActualApi, shutdownActualApi } = await loadModule();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await initActualApi();
    mockApi.shutdown.mockRejectedValueOnce(new Error('boom'));

    // Must not throw even though api.shutdown() rejected.
    await expect(shutdownActualApi()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();

    // State was reset, so a subsequent shutdown is a no-op (no extra api call).
    mockApi.shutdown.mockClear();
    await shutdownActualApi();
    expect(mockApi.shutdown).not.toHaveBeenCalled();
  });

  it('clears the memoized promise on failure so a later call retries (failure case)', async () => {
    const { initActualApi } = await loadModule();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockApi.init.mockRejectedValueOnce(new Error('init failed'));

    // First attempt rejects...
    await expect(initActualApi()).rejects.toThrow('init failed');
    // ...and a later call retries instead of reusing the failed promise.
    await expect(initActualApi()).resolves.toBeUndefined();
    expect(mockApi.init).toHaveBeenCalledTimes(2);
  });

  it('waits for an in-flight init to settle before shutting down (edge case)', async () => {
    const { initActualApi, shutdownActualApi } = await loadModule();

    let resolveInit: () => void = () => {};
    mockApi.init.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveInit = resolve;
        })
    );

    const initCall = initActualApi();
    const shutdownCall = shutdownActualApi();

    // Init is still in progress, so shutdown must not call api.shutdown() yet —
    // doing so would race api.init() against api.shutdown().
    await Promise.resolve();
    expect(mockApi.shutdown).not.toHaveBeenCalled();

    resolveInit();
    await Promise.all([initCall, shutdownCall]);
    expect(mockApi.shutdown).toHaveBeenCalledTimes(1);
  });
});
