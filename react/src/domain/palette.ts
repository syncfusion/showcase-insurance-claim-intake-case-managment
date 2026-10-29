// Colour palette for Syncfusion Charts and Maps SVG rendering.
// Mirrors the token baseline; no hex literals in components.

export type AppTheme = 'light' | 'dark';
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface Palette {
  success: string; warning: string; danger: string; info: string; neutral: string;
  reference: string;
  series: [string, string, string, string, string, string, string, string];
}

const PALETTES: Record<AppTheme, Palette> = {
  light: {
    success: '#027a48', warning: '#b54708', danger: '#b42318', info: '#175cd3', neutral: '#667085',
    reference: '#667085',
    series: ['#3b82f6', '#0d9488', '#a21caf', '#334155', '#0369a1', '#0891b2', '#a855f7', '#4f46e5']
  },
  dark: {
    success: '#86efac', warning: '#fbbf24', danger: '#fca5a5', info: '#93c5fd', neutral: '#94a3b8',
    reference: '#94a3b8',
    series: ['#3b82f6', '#2dd4bf', '#e879f9', '#64748b', '#0ea5e9', '#22d3ee', '#a855f7', '#6366f1']
  }
};

export const palette = (theme: AppTheme): Palette => PALETTES[theme];
export const markerTones: Palette = PALETTES.light;
export const chartTheme = (theme: AppTheme): 'Tailwind3' | 'Tailwind3Dark' => (theme === 'dark' ? 'Tailwind3Dark' : 'Tailwind3');

/** Ink drawn on top of a chart surface: the chart labels and axes use it in both themes. */
export const chartInk: Record<AppTheme, string> = { light: '#0f172a', dark: '#f1f5f9' };

/** A marker or slice outline on the OpenStreetMap tiles, which stay light in both themes. */
export const onTileInk = '#ffffff';

/** Ink for a label drawn inside a chart slice, chosen so it reads 4.5:1 on that slice's fill. */
export const sliceLabelInk = '#ffffff';
export const sliceLabelInkDark = '#0f172a';

/**
 * The ink that reads on a given slice fill (design-system.md, "Colour semantics";
 * syncfusion-component-patterns.md, "Pie and donut charts show their values"). The chart's own ink
 * choice put white on #3b82f6 (3.7:1), so the label ink is computed from the slice's own luminance.
 */
export function inkOnFill(hex: string): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return sliceLabelInk;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.42 ? sliceLabelInkDark : sliceLabelInk;
}

export interface Band { min?: number; tone: Tone; label?: string }
export function bandFor(value: number, bands: Band[]): Band {
  return bands.find((band) => band.min === undefined || value >= band.min) ?? bands[bands.length - 1];
}

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-[var(--color-sf-fg-success-primary)]',
  warning: 'text-[var(--color-sf-fg-warning-primary)]',
  danger: 'text-[var(--color-sf-fg-danger-primary)]',
  info: 'text-[var(--color-sf-fg-info-primary)]',
  neutral: 'text-[var(--color-sf-fg-neutral-primary)]'
};

export const TONE_BADGE: Record<Tone, string> = {
  success: 'badge--success',
  warning: 'badge--warning',
  danger: 'badge--danger',
  info: 'badge--info',
  neutral: 'badge--neutral'
};

// Solid colour for chip accents (map markers, card edges, status dots).
// Mirrors the foreground tokens so it reads on the light/dark surface.
export const TONE_INK: Record<Tone, string> = {
  success: 'var(--color-sf-fg-success-primary)',
  warning: 'var(--color-sf-fg-warning-primary)',
  danger: 'var(--color-sf-fg-danger-primary)',
  info: 'var(--color-sf-fg-info-primary)',
  neutral: 'var(--color-sf-fg-neutral-primary)'
};