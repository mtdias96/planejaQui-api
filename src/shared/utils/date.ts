const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

/**
 * Returns the current month formatted as `YYYY-MM` in America/Sao_Paulo timezone.
 */
export function getCurrentSaoPauloMonth(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Resolves the UTC offset in minutes for America/Sao_Paulo at a given approximate instant.
 * Handles historical daylight saving time (DST) prior to 2019 (GMT-02:00) as well as standard time (GMT-03:00).
 */
function getSaoPauloOffsetMinutes(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIMEZONE,
    timeZoneName: 'longOffset',
  });
  const tzName = formatter.formatToParts(date).find(p => p.type === 'timeZoneName')?.value;
  if (!tzName || tzName === 'GMT') {
    return -180; // Default fallback to UTC-3
  }
  const match = tzName.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) {
    return -180;
  }
  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * (hours * 60 + minutes);
}

/**
 * Parses wall-clock year, month, day, hour, min, sec, ms in America/Sao_Paulo into a UTC Date.
 */
function parseSaoPauloWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  min: number,
  sec: number,
  ms: number,
): Date {
  const approx = new Date(Date.UTC(year, month - 1, day, hour, min, sec, ms));
  const offsetMinutes = getSaoPauloOffsetMinutes(approx);
  return new Date(approx.getTime() - offsetMinutes * 60 * 1000);
}

/**
 * Computes the start and end Date objects for a civil month in America/Sao_Paulo,
 * dynamically respecting historical daylight saving time rules and future changes.
 */
export function getSaoPauloMonthRange(monthKey?: string): {
  fromDate: Date;
  toDate: Date;
  formattedMonth: string;
} {
  const targetMonth = monthKey ?? getCurrentSaoPauloMonth();
  const [yearStr, monthStr] = targetMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const fromDate = parseSaoPauloWallClock(year, month, 1, 0, 0, 0, 0);
  const toDate = parseSaoPauloWallClock(year, month, lastDay, 23, 59, 59, 999);

  return {
    fromDate,
    toDate,
    formattedMonth: targetMonth,
  };
}
