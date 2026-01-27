// ----------------------------
// GET TRANSACTIONS TOOL TESTS
// ----------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler, schema } from './index.js';
import { GetTransactionsDataFetcher } from './data-fetcher.js';
import { GetTransactionsArgs } from '../../types.js';
import { Transaction } from '../../core/types/domain.js';

// Mock the data fetcher
vi.mock('./data-fetcher.js', () => ({
  GetTransactionsDataFetcher: vi.fn().mockImplementation(() => ({
    fetch: vi.fn(),
  })),
}));

describe('get-transactions tool', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const MockedDataFetcher = vi.mocked(GetTransactionsDataFetcher);
    mockFetch = vi.fn();
    MockedDataFetcher.mockImplementation(
      () =>
        ({
          fetch: mockFetch,
        }) as unknown as GetTransactionsDataFetcher
    );
  });

  describe('schema', () => {
    it('should have correct tool name and description', () => {
      expect(schema.name).toBe('get-transactions');
      expect(schema.description).toContain('Get transactions for an account');
      expect(schema.description).toContain('uncategorized');
    });

    it('should require accountId field', () => {
      expect(schema.inputSchema.required).toContain('accountId');
    });

    it('should have all expected properties in schema', () => {
      const properties = schema.inputSchema.properties;
      expect(properties).toHaveProperty('accountId');
      expect(properties).toHaveProperty('startDate');
      expect(properties).toHaveProperty('endDate');
      expect(properties).toHaveProperty('minAmount');
      expect(properties).toHaveProperty('maxAmount');
      expect(properties).toHaveProperty('categoryName');
      expect(properties).toHaveProperty('payeeName');
      expect(properties).toHaveProperty('uncategorizedOnly');
      expect(properties).toHaveProperty('limit');
    });
  });

  describe('handler - uncategorized filtering', () => {
    const mockTransactions: Transaction[] = [
      {
        id: 'tx1',
        account: 'account-1',
        date: '2025-12-01',
        amount: 5000,
        payee_name: 'Coffee Shop',
        category: 'cat-1',
        category_name: 'Food',
      },
      {
        id: 'tx2',
        account: 'account-1',
        date: '2025-12-02',
        amount: 10000,
        payee_name: 'Unknown Store',
        // No category - uncategorized
      },
      {
        id: 'tx3',
        account: 'account-1',
        date: '2025-12-03',
        amount: 7500,
        payee_name: 'Gas Station',
        // No category - uncategorized
      },
      {
        id: 'tx4',
        account: 'account-1',
        date: '2025-12-04',
        amount: 15000,
        payee_name: 'Grocery Store',
        category: 'cat-2',
        category_name: 'Groceries',
      },
    ];

    it('should filter only uncategorized transactions when uncategorizedOnly is true', async () => {
      mockFetch.mockResolvedValue(mockTransactions);

      const args: GetTransactionsArgs = {
        accountId: 'account-1',
        uncategorizedOnly: true,
      };

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('tx2');
      expect(result.content[0].text).toContain('tx3');
      expect(result.content[0].text).not.toContain('tx1');
      expect(result.content[0].text).not.toContain('tx4');
      expect(result.content[0].text).toContain('Uncategorized only');
      expect(result.content[0].text).toContain('Matching Transactions: 2/4');
    });

    it('should return all transactions when uncategorizedOnly is false', async () => {
      mockFetch.mockResolvedValue(mockTransactions);

      const args: GetTransactionsArgs = {
        accountId: 'account-1',
        uncategorizedOnly: false,
      };

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('tx1');
      expect(result.content[0].text).toContain('tx2');
      expect(result.content[0].text).toContain('tx3');
      expect(result.content[0].text).toContain('tx4');
      expect(result.content[0].text).not.toContain('Uncategorized only');
    });

    it('should return all transactions when uncategorizedOnly is not specified', async () => {
      mockFetch.mockResolvedValue(mockTransactions);

      const args: GetTransactionsArgs = {
        accountId: 'account-1',
      };

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('tx1');
      expect(result.content[0].text).toContain('tx2');
      expect(result.content[0].text).toContain('tx3');
      expect(result.content[0].text).toContain('tx4');
    });

    it('should combine uncategorizedOnly with other filters', async () => {
      mockFetch.mockResolvedValue(mockTransactions);

      const args: GetTransactionsArgs = {
        accountId: 'account-1',
        uncategorizedOnly: true,
        minAmount: 80, // $80 = 8000 cents
      };

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      // Only tx2 (10000) should match: uncategorized AND >= 8000
      expect(result.content[0].text).toContain('tx2');
      expect(result.content[0].text).not.toContain('tx1');
      expect(result.content[0].text).not.toContain('tx3'); // 7500 < 8000
      expect(result.content[0].text).not.toContain('tx4');
      expect(result.content[0].text).toContain('Uncategorized only');
      expect(result.content[0].text).toContain('Min amount');
    });

    it('should work with limit when filtering uncategorized', async () => {
      mockFetch.mockResolvedValue(mockTransactions);

      const args: GetTransactionsArgs = {
        accountId: 'account-1',
        uncategorizedOnly: true,
        limit: 1,
      };

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      // Should only return the first uncategorized transaction
      expect(result.content[0].text).toContain('tx2');
      expect(result.content[0].text).not.toContain('tx3');
      expect(result.content[0].text).toContain('Matching Transactions: 1/4');
    });
  });

  describe('handler - validation errors', () => {
    it('should return error when accountId is missing', async () => {
      const args = {} as unknown as GetTransactionsArgs;

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('accountId');
    });

    it('should return error when accountId is not a string', async () => {
      const args = {
        accountId: 123,
      } as unknown as GetTransactionsArgs;

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('string');
    });
  });

  describe('handler - edge cases', () => {
    it('should handle empty transaction list', async () => {
      mockFetch.mockResolvedValue([]);

      const args: GetTransactionsArgs = {
        accountId: 'account-1',
        uncategorizedOnly: true,
      };

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Matching Transactions: 0/0');
    });

    it('should handle all transactions being categorized', async () => {
      const allCategorized: Transaction[] = [
        {
          id: 'tx1',
          account: 'account-1',
          date: '2025-12-01',
          amount: 5000,
          category: 'cat-1',
          category_name: 'Food',
        },
        {
          id: 'tx2',
          account: 'account-1',
          date: '2025-12-02',
          amount: 10000,
          category: 'cat-2',
          category_name: 'Transport',
        },
      ];
      mockFetch.mockResolvedValue(allCategorized);

      const args: GetTransactionsArgs = {
        accountId: 'account-1',
        uncategorizedOnly: true,
      };

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Matching Transactions: 0/2');
    });
  });

  describe('handler - API errors', () => {
    it('should handle data fetcher errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      mockFetch.mockRejectedValue(mockError);

      const args: GetTransactionsArgs = {
        accountId: 'account-1',
      };

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Database connection failed');
    });
  });
});
