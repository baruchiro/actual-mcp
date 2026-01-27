import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetTransactionsDataFetcher } from './data-fetcher.js';
import type { Account, Transaction } from '../../core/types/domain.js';

vi.mock('../../core/data/fetch-accounts.js', () => ({
  fetchAllAccounts: vi.fn(),
}));

vi.mock('../../core/data/fetch-transactions.js', () => ({
  fetchTransactionsForAccount: vi.fn(),
  fetchAllOnBudgetTransactions: vi.fn(),
}));

import { fetchAllAccounts } from '../../core/data/fetch-accounts.js';
import { fetchTransactionsForAccount, fetchAllOnBudgetTransactions } from '../../core/data/fetch-transactions.js';

describe(GetTransactionsDataFetcher.name, () => {
  const fetcher = new GetTransactionsDataFetcher();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch transactions for specific account when accountId is provided', async () => {
    const mockTransactions: Transaction[] = [
      {
        id: '1',
        account: 'acc1',
        date: '2023-01-01',
        amount: -100,
        payee_name: 'Store',
        category_name: 'Groceries',
      },
    ];

    vi.mocked(fetchTransactionsForAccount).mockResolvedValue(mockTransactions);

    const result = await fetcher.fetch('acc1', '2023-01-01', '2023-01-31');

    expect(result).toEqual(mockTransactions);
    expect(fetchTransactionsForAccount).toHaveBeenCalledWith('acc1', '2023-01-01', '2023-01-31');
    expect(fetchAllAccounts).not.toHaveBeenCalled();
  });

  it('should fetch transactions for all on-budget accounts when accountId is omitted', async () => {
    const mockAccounts: Account[] = [
      { id: 'acc1', name: 'Checking', offbudget: false, closed: false },
      { id: 'acc2', name: 'Savings', offbudget: false, closed: false },
    ];

    const mockTransactions: Transaction[] = [
      {
        id: '1',
        account: 'acc1',
        date: '2023-01-01',
        amount: -100,
        payee_name: 'Store',
        category_name: 'Groceries',
      },
    ];

    vi.mocked(fetchAllAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(fetchAllOnBudgetTransactions).mockResolvedValue(mockTransactions);

    const result = await fetcher.fetch(undefined, '2023-01-01', '2023-01-31');

    expect(result).toEqual(mockTransactions);
    expect(fetchAllAccounts).toHaveBeenCalledTimes(1);
    expect(fetchAllOnBudgetTransactions).toHaveBeenCalledWith(mockAccounts, '2023-01-01', '2023-01-31');
    expect(fetchTransactionsForAccount).not.toHaveBeenCalled();
  });
});
