import api from '@actual-app/api';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { BudgetFile, TransactionData, UpdateTransactionData } from './types.js';
import {
  APIAccountEntity,
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/src/server/api-models.js';
import { RuleEntity, TransactionEntity } from '@actual-app/api/@types/loot-core/src/types/models/index.js';

const DEFAULT_DATA_DIR: string = path.resolve(os.homedir() || '.', '.actual');

let initPromise: Promise<void> | null = null;
let shutdownPromise: Promise<void> | null = null;
let shutdownTimer: ReturnType<typeof setTimeout> | null = null;

const DEFAULT_CACHE_TTL_SECONDS = 60;

function getCacheTtlMs(): number {
  const raw = process.env.ACTUAL_MCP_CACHE_TTL_SECONDS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_CACHE_TTL_SECONDS * 1000;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`Invalid ACTUAL_MCP_CACHE_TTL_SECONDS="${raw}"; falling back to ${DEFAULT_CACHE_TTL_SECONDS}s`);
    return DEFAULT_CACHE_TTL_SECONDS * 1000;
  }
  return parsed * 1000;
}

export async function initActualApi(): Promise<boolean> {
  cancelScheduledShutdown();
  // Reason: a TTL-triggered shutdown may already be mid-flight (api.shutdown()
  // not yet resolved). Wait for it to finish before re-initializing, otherwise
  // loadBudget() would race api.init() against the in-progress api.shutdown().
  if (shutdownPromise) {
    await shutdownPromise;
  }
  const reused = initPromise !== null;
  if (!initPromise) {
    initPromise = loadBudget();
    initPromise.catch(() => {
      initPromise = null;
    });
  }
  await initPromise;
  return reused;
}

async function loadBudget(): Promise<void> {
  console.error('Initializing Actual Budget API...');
  const dataDir = process.env.ACTUAL_DATA_DIR || DEFAULT_DATA_DIR;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  await api.init({
    dataDir,
    serverURL: process.env.ACTUAL_SERVER_URL,
    password: process.env.ACTUAL_PASSWORD,
  });

  const budgets: BudgetFile[] = await api.getBudgets();
  if (!budgets || budgets.length === 0) {
    throw new Error('No budgets found. Please create a budget in Actual first.');
  }

  const budgetId: string = process.env.ACTUAL_BUDGET_SYNC_ID || budgets[0].cloudFileId || budgets[0].id || '';
  console.error(`Loading budget: ${budgetId}`);
  if (process.env.ACTUAL_SERVER_URL) {
    await api.downloadBudget(
      budgetId,
      process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD
        ? {
            password: process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD,
          }
        : undefined
    );
  } else {
    // Reason: downloadBudget always asks a sync server for the remote file list
    // and throws "Could not get remote files" when none is configured. In
    // local-only mode (ACTUAL_DATA_DIR without ACTUAL_SERVER_URL) the budget is
    // already on disk, so load it directly instead of trying to download it.
    await api.loadBudget(budgetId);
  }

  console.error('Actual Budget API initialized successfully');
}

export async function shutdownActualApi(): Promise<void> {
  cancelScheduledShutdown();
  if (shutdownPromise) return shutdownPromise;
  const pending = initPromise;
  if (!pending) return;
  initPromise = null;
  shutdownPromise = (async () => {
    try {
      try {
        await pending;
      } catch {
        // Init itself failed; there is nothing initialized to tear down.
        return;
      }
      try {
        await api.shutdown();
      } catch (err) {
        console.error('Error shutting down Actual Budget API:', err);
      }
    } finally {
      shutdownPromise = null;
    }
  })();
  return shutdownPromise;
}

export function cancelScheduledShutdown(): void {
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
}

export function scheduleShutdown(): Promise<void> | void {
  cancelScheduledShutdown();
  const ttlMs = getCacheTtlMs();
  if (ttlMs <= 0) {
    // Reason: TTL=0 disables caching, so the caller can await teardown to
    // guarantee the legacy "shut down after every call" behavior completes.
    return shutdownActualApi();
  }
  shutdownTimer = setTimeout(() => {
    shutdownTimer = null;
    void shutdownActualApi();
  }, ttlMs);
  shutdownTimer.unref?.();
}

export async function syncBudget(): Promise<void> {
  if (!initPromise) return;
  // Reason: api.sync() reconciles with a sync server; in local-only mode
  // (no ACTUAL_SERVER_URL) there is no server and the call errors out.
  if (!process.env.ACTUAL_SERVER_URL) return;
  try {
    await api.sync();
  } catch (err) {
    console.error('Error syncing Actual Budget data:', err);
  }
}

// ----------------------------
// FETCH
// ----------------------------

/**
 * Get all accounts (ensures API is initialized)
 */
export async function getAccounts(): Promise<APIAccountEntity[]> {
  await initActualApi();
  return api.getAccounts();
}

/**
 * Get all categories (ensures API is initialized)
 */
export async function getCategories(): Promise<APICategoryEntity[]> {
  await initActualApi();
  return api.getCategories();
}

/**
 * Get all category groups (ensures API is initialized)
 */
export async function getCategoryGroups(): Promise<APICategoryGroupEntity[]> {
  await initActualApi();
  return api.getCategoryGroups();
}

/**
 * Get all payees (ensures API is initialized)
 */
export async function getPayees(): Promise<APIPayeeEntity[]> {
  await initActualApi();
  return api.getPayees();
}

/**
 * Get transactions for a specific account and date range (ensures API is initialized)
 */
export async function getTransactions(accountId: string, start: string, end: string): Promise<TransactionEntity[]> {
  await initActualApi();
  return api.getTransactions(accountId, start, end);
}

/**
 * Get all rules (ensures API is initialized)
 */
export async function getRules(): Promise<RuleEntity[]> {
  await initActualApi();
  return api.getRules();
}

// ----------------------------
// ACTION
// ----------------------------

/**
 * Create a new payee (ensures API is initialized)
 */
export async function createPayee(args: Record<string, unknown>): Promise<string> {
  await initActualApi();
  return api.createPayee(args);
}

/**
 * Update a payee (ensures API is initialized)
 */
export async function updatePayee(id: string, args: Record<string, unknown>): Promise<unknown> {
  await initActualApi();
  return api.updatePayee(id, args);
}

/**
 * Delete a payee (ensures API is initialized)
 */
export async function deletePayee(id: string): Promise<unknown> {
  await initActualApi();
  return api.deletePayee(id);
}

/**
 * Create a new rule (ensures API is initialized)
 */
export async function createRule(args: Record<string, unknown>): Promise<RuleEntity> {
  await initActualApi();
  return api.createRule(args);
}

/**
 * Update a rule (ensures API is initialized)
 */
export async function updateRule(args: Record<string, unknown>): Promise<RuleEntity> {
  await initActualApi();
  return api.updateRule(args);
}

/**
 * Delete a rule (ensures API is initialized)
 */
export async function deleteRule(id: string): Promise<boolean> {
  await initActualApi();
  return api.deleteRule(id);
}

/**
 * Create a new category (ensures API is initialized)
 */
export async function createCategory(args: Record<string, unknown>): Promise<string> {
  await initActualApi();
  return api.createCategory(args);
}

/**
 * Update a category (ensures API is initialized)
 */
export async function updateCategory(id: string, args: Record<string, unknown>): Promise<unknown> {
  await initActualApi();
  return api.updateCategory(id, args);
}

/**
 * Delete a category (ensures API is initialized)
 */
export async function deleteCategory(id: string): Promise<{ error?: string }> {
  await initActualApi();
  return api.deleteCategory(id);
}

/**
 * Create a new category group (ensures API is initialized)
 */
export async function createCategoryGroup(args: Record<string, unknown>): Promise<string> {
  await initActualApi();
  return api.createCategoryGroup(args);
}

/**
 * Update a category group (ensures API is initialized)
 */
export async function updateCategoryGroup(id: string, args: Record<string, unknown>): Promise<unknown> {
  await initActualApi();
  return api.updateCategoryGroup(id, args);
}

/**
 * Delete a category group (ensures API is initialized)
 */
export async function deleteCategoryGroup(id: string): Promise<unknown> {
  await initActualApi();
  return api.deleteCategoryGroup(id);
}

/**
 * Create a transaction (ensures API is initialized)
 */
export async function createTransaction(accountId: string, data: TransactionData): Promise<string> {
  await initActualApi();
  return api.addTransactions(accountId, [data]);
}

/**
 * Update a transaction (ensures API is initialized)
 */
export async function updateTransaction(id: string, data: UpdateTransactionData): Promise<unknown> {
  await initActualApi();
  return api.updateTransaction(id, data);
}

/**
 * Delete a transaction (ensures API is initialized)
 */
export async function deleteTransaction(id: string): Promise<unknown> {
  await initActualApi();
  return api.deleteTransaction(id);
}

/**
 * Run bank sync for accounts (ensures API is initialized)
 *
 * @param accountId - Optional. Specific account ID, or special value:
 *   - "onbudget": sync all on-budget linked accounts
 *   - "offbudget": sync all off-budget linked accounts
 *   - undefined: sync ALL linked accounts
 */
export async function runBankSync(accountId?: string): Promise<void> {
  await initActualApi();
  // API expects { accountId } object or undefined for all accounts
  return api.runBankSync(accountId ? { accountId } : undefined);
}
