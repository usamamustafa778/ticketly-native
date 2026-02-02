import tinycolor from 'tinycolor2';
import type { TicketTheme } from '@/lib/types/ticketTheme';

/** Ensure text color has sufficient contrast against background. Returns black or white. */
export function ensureContrast(
  textColor: string,
  bgColor: string,
  minRatio = 4.5
): string {
  const tc = tinycolor(textColor);
  const bc = tinycolor(bgColor);
  if (tinycolor.isReadable(tc, bc, { level: 'AA', size: 'normal' })) {
    return textColor;
  }
  return bc.isLight() ? '#111827' : '#FFFFFF';
}

/** Get a readable text color for a gradient background (uses midpoint for check) */
export function getReadableTextForGradient(startColor: string, endColor: string): string {
  const start = tinycolor(startColor);
  const end = tinycolor(endColor);
  const mid = start.mix(end, 50);
  return mid.isLight() ? '#111827' : '#FFFFFF';
}

/** Extract theme from image colors result. Maps dominant/vibrant to gradient. */
export function imageColorsToTheme(colors: {
  dominant?: string | { hex: () => string };
  vibrant?: string | { hex: () => string };
  darkVibrant?: string | { hex: () => string };
  lightVibrant?: string | { hex: () => string };
  darkMuted?: string | { hex: () => string };
  lightMuted?: string | { hex: () => string };
}): Partial<TicketTheme> {
  const toHex = (c: string | { hex: () => string } | undefined): string => {
    if (!c) return '';
    if (typeof c === 'string') return c.startsWith('#') ? c : `#${c}`;
    return (c as { hex: () => string }).hex?.() ?? '';
  };
  const gradientStart = toHex(colors.vibrant) || toHex(colors.dominant) || '#F59E0B';
  const gradientEnd = toHex(colors.darkVibrant) || toHex(colors.darkMuted) || toHex(colors.dominant) || '#10B981';
  const primaryTextColor = getReadableTextForGradient(gradientStart, gradientEnd);
  const accentColor = toHex(colors.lightVibrant) || toHex(colors.lightMuted) || '#FCD34D';
  const brandColor = toHex(colors.vibrant) || gradientStart;

  return {
    gradientStart,
    gradientEnd,
    primaryTextColor,
    accentColor,
    brandColor,
    gradientDirection: 'to right bottom',
  };
}

/** Validate hex color string (#RRGGBB) */
export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

/** Normalize hex to #RRGGBB for color picker (accepts 3 or 6 digit hex) */
export function normalizeHex(hex: string): string {
  const tc = tinycolor(hex);
  return tc.isValid() ? tc.toHexString() : '#FFFFFF';
}
