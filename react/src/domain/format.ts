// Formatting module: every number and date the app shows.
// KPI cards: compactMoney. Tooltips, Grid cells: money. Counts: count. Ratios: percent.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fixed = (digits: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const money = (value: number): string => usd.format(value);
export const count = (value: number): string => whole.format(value);
export const percent = (ratio: number, digits = 1): string =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: digits }).format(ratio);

/**
 * Compact money for KPI values, chart data labels and axes: three significant figures above a million
 * (full amount below it) — design-system.md, "Number formatting" ("$6.89M", "$12.4M", "$1.2B"). Thousands
 * are compacted too, so a chart label reads "$579K" instead of "$579,000" and stays inside the chart
 * (syncfusion-component-patterns.md, "Charts in a measured container").
 */
export function compactMoney(value: number): string {
  const sign = value < 0 ? '-' : '', absolute = Math.abs(value);
  if (absolute >= 1e9) return `${sign}$${fixed(absolute >= 1e10 ? 0 : 1).format(absolute / 1e9)}B`;
  if (absolute >= 1e6) return `${sign}$${fixed(absolute < 1e7 ? 2 : absolute < 1e8 ? 1 : 0).format(absolute / 1e6)}M`;
  if (absolute >= 1e4) return `${sign}$${fixed(0).format(absolute / 1e3)}K`;
  return money(value);
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const monthLabel = (month: string): string => monthFormat.format(new Date(`${month}-01T00:00:00Z`));
export const dateLabel = (date: Date): string => dayFormat.format(date);
export const DATE_FORMAT = 'MM/dd/yyyy';

export const SYNCFUSION_FORMATS = { money: 'C0', count: 'N0', percent: 'P1' } as const;