import { describe, it, expect } from 'vitest';
import { BalanceHistoryInputParser } from './input-parser.js';
import type { BalanceHistoryArgs } from '../../types.js';

describe(BalanceHistoryInputParser.name, () => {
  const parser = new BalanceHistoryInputParser();

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

  it('should use defaults when accountId is omitted', () => {
    const result = parser.parse({} as BalanceHistoryArgs);

    expect(result).toEqual({
      accountId: undefined,
      includeOffBudget: false,
      months: 12,
    });
  });

  it('should treat empty accountId as undefined', () => {
    const result = parser.parse({ accountId: '' } as BalanceHistoryArgs);
    expect(result.accountId).toBeUndefined();
  });

  it('should use default 12 months when value is invalid', () => {
    const result = parser.parse({ months: -5 } as BalanceHistoryArgs);
    expect(result.months).toBe(12);
  });
});
