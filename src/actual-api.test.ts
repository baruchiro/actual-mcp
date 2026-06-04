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

    // Make init() pause so both callers overlap; without `initializing = true`
    // being set before the await, both would race into api.init().
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
});
