import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formatAmount } from '../utils.js';

describe('formatAmount', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original environment variable
    originalEnv = process.env.ACTUAL_MCP_CURRENCY_SYMBOL;
  });

  afterEach(() => {
    // Restore original environment variable
    if (originalEnv === undefined) {
      delete process.env.ACTUAL_MCP_CURRENCY_SYMBOL;
    } else {
      process.env.ACTUAL_MCP_CURRENCY_SYMBOL = originalEnv;
    }
  });

  describe('without currency symbol', () => {
    beforeEach(() => {
      delete process.env.ACTUAL_MCP_CURRENCY_SYMBOL;
    });

    it('formats positive amounts without currency symbol', () => {
      expect(formatAmount(12345)).toBe('123.45');
    });

    it('formats negative amounts without currency symbol', () => {
      expect(formatAmount(-12345)).toBe('-123.45');
    });

    it('formats zero without currency symbol', () => {
      expect(formatAmount(0)).toBe('0.00');
    });

    it('formats small amounts correctly', () => {
      expect(formatAmount(1)).toBe('0.01');
    });

    it('formats large amounts with thousand separators', () => {
      expect(formatAmount(123456789)).toBe('1,234,567.89');
    });

    it('returns N/A for undefined', () => {
      expect(formatAmount(undefined)).toBe('N/A');
    });

    it('returns N/A for null', () => {
      expect(formatAmount(null)).toBe('N/A');
    });
  });

  describe('with USD currency symbol', () => {
    beforeEach(() => {
      process.env.ACTUAL_MCP_CURRENCY_SYMBOL = '$';
    });

    it('formats positive amounts with currency symbol', () => {
      expect(formatAmount(12345)).toBe('$123.45');
    });

    it('formats negative amounts with currency symbol', () => {
      expect(formatAmount(-12345)).toBe('-$123.45');
    });

    it('formats zero with currency symbol', () => {
      expect(formatAmount(0)).toBe('$0.00');
    });

    it('formats large amounts with currency symbol and thousand separators', () => {
      expect(formatAmount(123456789)).toBe('$1,234,567.89');
    });
  });

  describe('with Euro currency symbol', () => {
    beforeEach(() => {
      process.env.ACTUAL_MCP_CURRENCY_SYMBOL = '€';
    });

    it('formats positive amounts with Euro symbol', () => {
      expect(formatAmount(12345)).toBe('€123.45');
    });

    it('formats negative amounts with Euro symbol', () => {
      expect(formatAmount(-12345)).toBe('-€123.45');
    });
  });

  describe('with Pound currency symbol', () => {
    beforeEach(() => {
      process.env.ACTUAL_MCP_CURRENCY_SYMBOL = '£';
    });

    it('formats positive amounts with Pound symbol', () => {
      expect(formatAmount(12345)).toBe('£123.45');
    });
  });

  describe('with custom multi-character currency symbol', () => {
    beforeEach(() => {
      process.env.ACTUAL_MCP_CURRENCY_SYMBOL = 'USD ';
    });

    it('formats amounts with multi-character currency symbol (space preserved)', () => {
      expect(formatAmount(12345)).toBe('USD 123.45');
    });
  });

  describe('with empty or whitespace-only currency symbol', () => {
    it('treats empty string as no currency symbol', () => {
      process.env.ACTUAL_MCP_CURRENCY_SYMBOL = '';
      expect(formatAmount(12345)).toBe('123.45');
    });

    it('treats whitespace-only string as no currency symbol', () => {
      process.env.ACTUAL_MCP_CURRENCY_SYMBOL = '   ';
      expect(formatAmount(12345)).toBe('123.45');
    });
  });
});
