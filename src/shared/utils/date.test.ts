import { describe, it, expect } from 'vitest';
import { getCurrentSaoPauloMonth, getSaoPauloMonthRange } from './date.js';

describe('date utils', () => {
  it('returns valid YYYY-MM format for getCurrentSaoPauloMonth', () => {
    const month = getCurrentSaoPauloMonth();
    expect(month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it('calculates correct start and end dates for a modern month (GMT-03:00) in Sao Paulo timezone', () => {
    const range = getSaoPauloMonthRange('2026-08');

    expect(range.formattedMonth).toBe('2026-08');
    expect(range.fromDate.toISOString()).toBe('2026-08-01T03:00:00.000Z');
    expect(range.toDate.toISOString()).toBe('2026-09-01T02:59:59.999Z');
  });

  it('correctly handles historical daylight saving time (GMT-02:00) in January 2018', () => {
    const range = getSaoPauloMonthRange('2018-01');

    expect(range.formattedMonth).toBe('2018-01');
    expect(range.fromDate.toISOString()).toBe('2018-01-01T02:00:00.000Z');
    expect(range.toDate.toISOString()).toBe('2018-02-01T01:59:59.999Z');
  });

  it('correctly handles leap year February', () => {
    const range = getSaoPauloMonthRange('2028-02');

    expect(range.formattedMonth).toBe('2028-02');
    expect(range.fromDate.toISOString()).toBe('2028-02-01T03:00:00.000Z');
    expect(range.toDate.toISOString()).toBe('2028-03-01T02:59:59.999Z');
  });

  it('correctly handles non-leap year February', () => {
    const range = getSaoPauloMonthRange('2026-02');

    expect(range.formattedMonth).toBe('2026-02');
    expect(range.fromDate.toISOString()).toBe('2026-02-01T03:00:00.000Z');
    expect(range.toDate.toISOString()).toBe('2026-03-01T02:59:59.999Z');
  });
});
