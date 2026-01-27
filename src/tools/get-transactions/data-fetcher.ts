// Fetches transactions and related data for get-transactions tool
import { fetchAllAccounts } from '../../core/data/fetch-accounts.js';
import { fetchTransactionsForAccount, fetchAllOnBudgetTransactions } from '../../core/data/fetch-transactions.js';
import type { Transaction } from '../../core/types/domain.js';

export class GetTransactionsDataFetcher {
  async fetch(accountId: string | undefined, start: string, end: string): Promise<Transaction[]> {
    if (accountId) {
      return await fetchTransactionsForAccount(accountId, start, end);
    } else {
      const accounts = await fetchAllAccounts();
      return await fetchAllOnBudgetTransactions(accounts, start, end);
    }
  }
}
