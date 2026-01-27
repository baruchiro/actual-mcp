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

describe('GetTransactionsDataFetcher', () => {
  const fetcher = new GetTransactionsDataFetcher();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('with accountId provided', () => {
    it('should fetch transactions for specific account', async () => {
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
      expect(fetchAllOnBudgetTransactions).not.toHaveBeenCalled();
    });

    it('should handle errors from fetchTransactionsForAccount', async () => {
      vi.mocked(fetchTransactionsForAccount).mockRejectedValue(new Error('API Error'));

      await expect(fetcher.fetch('acc1', '2023-01-01', '2023-01-31')).rejects.toThrow('API Error');

      expect(fetchTransactionsForAccount).toHaveBeenCalledWith('acc1', '2023-01-01', '2023-01-31');
      expect(fetchAllAccounts).not.toHaveBeenCalled();
      expect(fetchAllOnBudgetTransactions).not.toHaveBeenCalled();
    });
  });

  describe('without accountId (default to all on-budget)', () => {
    it('should fetch transactions for all on-budget accounts', async () => {
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
        {
          id: '2',
          account: 'acc2',
          date: '2023-01-02',
          amount: -50,
          payee_name: 'Gas Station',
          category_name: 'Fuel',
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

    it('should handle empty accounts list', async () => {
      vi.mocked(fetchAllAccounts).mockResolvedValue([]);
      vi.mocked(fetchAllOnBudgetTransactions).mockResolvedValue([]);

      const result = await fetcher.fetch(undefined, '2023-01-01', '2023-01-31');

      expect(result).toEqual([]);
      expect(fetchAllAccounts).toHaveBeenCalledTimes(1);
      expect(fetchAllOnBudgetTransactions).toHaveBeenCalledWith([], '2023-01-01', '2023-01-31');
    });

    it('should handle errors from fetchAllAccounts', async () => {
      vi.mocked(fetchAllAccounts).mockRejectedValue(new Error('Accounts API Error'));

      await expect(fetcher.fetch(undefined, '2023-01-01', '2023-01-31')).rejects.toThrow('Accounts API Error');

      expect(fetchAllAccounts).toHaveBeenCalledTimes(1);
      expect(fetchAllOnBudgetTransactions).not.toHaveBeenCalled();
      expect(fetchTransactionsForAccount).not.toHaveBeenCalled();
    });

    it('should handle errors from fetchAllOnBudgetTransactions', async () => {
      const mockAccounts: Account[] = [{ id: 'acc1', name: 'Checking', offbudget: false, closed: false }];

      vi.mocked(fetchAllAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(fetchAllOnBudgetTransactions).mockRejectedValue(new Error('Transactions API Error'));

      await expect(fetcher.fetch(undefined, '2023-01-01', '2023-01-31')).rejects.toThrow('Transactions API Error');

      expect(fetchAllAccounts).toHaveBeenCalledTimes(1);
      expect(fetchAllOnBudgetTransactions).toHaveBeenCalledWith(mockAccounts, '2023-01-01', '2023-01-31');
    });
  });
});
