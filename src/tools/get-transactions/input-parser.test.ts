import { describe, it, expect } from 'vitest';
import { GetTransactionsInputParser } from './input-parser.js';

describe(GetTransactionsInputParser.name, () => {
  const parser = new GetTransactionsInputParser();

  it('should parse all parameters when provided', () => {
    const result = parser.parse({
      accountId: 'acc123',
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      minAmount: 10,
      maxAmount: 100,
      categoryName: 'Food',
      payeeName: 'Store',
      limit: 50,
    });

    expect(result).toEqual({
      accountId: 'acc123',
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      minAmount: 10,
      maxAmount: 100,
      categoryName: 'Food',
      payeeName: 'Store',
      limit: 50,
    });
  });

  it('should use undefined for accountId when omitted', () => {
    const result = parser.parse({});
    expect(result.accountId).toBeUndefined();
  });

  it('should treat empty accountId as undefined', () => {
    const result = parser.parse({ accountId: '' });
    expect(result.accountId).toBeUndefined();
  });

  it('should handle missing optional parameters', () => {
    const result = parser.parse({ accountId: 'acc123' });

    expect(result).toEqual({
      accountId: 'acc123',
      startDate: undefined,
      endDate: undefined,
      minAmount: undefined,
      maxAmount: undefined,
      categoryName: undefined,
      payeeName: undefined,
      limit: undefined,
    });
  });

  it('should throw error for null args', () => {
    expect(() => parser.parse(null)).toThrow('Arguments must be an object');
  });

  it('should throw error for non-object args', () => {
    expect(() => parser.parse('string')).toThrow('Arguments must be an object');
  });
});
