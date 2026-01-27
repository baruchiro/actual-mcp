import { describe, it, expect } from 'vitest';
import { GetTransactionsInputParser } from './input-parser.js';

describe(GetTransactionsInputParser.name, () => {
  const parser = new GetTransactionsInputParser();

  it('should treat empty accountId string as undefined', () => {
    const result = parser.parse({ accountId: '' });
    expect(result.accountId).toBeUndefined();
  });

  it('should throw error for invalid arguments', () => {
    expect(() => parser.parse(null)).toThrow('Arguments must be an object');
    expect(() => parser.parse('string')).toThrow('Arguments must be an object');
  });
});
