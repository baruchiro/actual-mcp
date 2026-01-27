/**
 * Get date range parameters with defaults
 */
export function getDateRange(startDate?: string, endDate?: string): { startDate: string; endDate: string } {
  const today = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setMonth(today.getMonth() - 3); // 3 months ago by default

  return {
    startDate: startDate || formatDate(defaultStartDate),
    endDate: endDate || formatDate(today),
  };
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return '';
  if (typeof date === 'string') return date;

  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Format currency amounts for display
 */
export function formatAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return 'N/A';

  // Convert from cents to dollars
  const dollars = amount / 100;

  // Get optional currency code from environment variable
  const currencyCode = process.env.ACTUAL_MCP_CURRENCY_SYMBOL;

  try {
    if (currencyCode) {
      // Format with currency using the provided currency code
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(dollars);
    } else {
      // Format without currency
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(dollars);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to format amount with currency code "${currencyCode}": ${errorMessage}. ` +
        `Please provide a valid ISO 4217 currency code (e.g., "USD", "EUR", "GBP").`
    );
  }
}

// Helper to calculate start/end date strings for the N most recent months
export function getDateRangeForMonths(months: number): {
  start: string;
  end: string;
} {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month
  const start = new Date(end.getFullYear(), end.getMonth() - months + 1, 1); // first day of N months ago
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
