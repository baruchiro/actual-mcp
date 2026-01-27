import { describe, it, expect } from 'vitest';
import { BalanceHistoryInputParser } from './input-parser.js';
import type { BalanceHistoryArgs } from '../../types.js';

describe('BalanceHistoryInputParser', () => {
  const parser = new BalanceHistoryInputParser();

  describe('accountId handling', () => {
    it('should accept valid accountId', () => {
      const result = parser.parse({ accountId: 'acc123' } as BalanceHistoryArgs);
      expect(result.accountId).toBe('acc123');
    });

    it('should handle missing accountId by returning undefined', () => {
      const result = parser.parse({} as BalanceHistoryArgs);
      expect(result.accountId).toBeUndefined();
    });

    it('should handle empty string accountId as undefined', () => {
      const result = parser.parse({ accountId: '' } as BalanceHistoryArgs);
      expect(result.accountId).toBeUndefined();
    });

    it('should handle non-string accountId as undefined', () => {
      const result = parser.parse({ accountId: 123 as unknown as string } as BalanceHistoryArgs);
      expect(result.accountId).toBeUndefined();
    });
  });

  describe('includeOffBudget parameter', () => {
    it('should parse true value', () => {
      const result = parser.parse({ includeOffBudget: true } as BalanceHistoryArgs);
      expect(result.includeOffBudget).toBe(true);
    });

    it('should parse false value', () => {
      const result = parser.parse({ includeOffBudget: false } as BalanceHistoryArgs);
      expect(result.includeOffBudget).toBe(false);
    });

    it('should default to false when not provided', () => {
      const result = parser.parse({} as BalanceHistoryArgs);
      expect(result.includeOffBudget).toBe(false);
    });

    it('should default to false for non-boolean values', () => {
      const result = parser.parse({ includeOffBudget: 'true' as unknown as boolean } as BalanceHistoryArgs);
      expect(result.includeOffBudget).toBe(false);
    });
  });

  describe('months parameter', () => {
    it('should parse valid positive number', () => {
      const result = parser.parse({ months: 6 } as BalanceHistoryArgs);
      expect(result.months).toBe(6);
    });

    it('should default to 12 when not provided', () => {
      const result = parser.parse({} as BalanceHistoryArgs);
      expect(result.months).toBe(12);
    });

    it('should default to 12 for zero', () => {
      const result = parser.parse({ months: 0 } as BalanceHistoryArgs);
      expect(result.months).toBe(12);
    });

    it('should default to 12 for negative numbers', () => {
      const result = parser.parse({ months: -5 } as BalanceHistoryArgs);
      expect(result.months).toBe(12);
    });

    it('should default to 12 for non-number values', () => {
      const result = parser.parse({ months: '6' as unknown as number } as BalanceHistoryArgs);
      expect(result.months).toBe(12);
    });
  });

  describe('combined parameters', () => {
    it('should parse all parameters when provided', () => {
      const result = parser.parse({
        accountId: 'acc123',
        includeOffBudget: true,
        months: 24,
      } as BalanceHistoryArgs);

      expect(result).toEqual({
        accountId: 'acc123',
        includeOffBudget: true,
        months: 24,
      });
    });

    it('should handle defaults for all optional parameters', () => {
      const result = parser.parse({} as BalanceHistoryArgs);

      expect(result).toEqual({
        accountId: undefined,
        includeOffBudget: false,
        months: 12,
      });
    });
  });
});
