/**
 * Ticketly Design System
 * Standard sizes, spacing, and typography used across the app.
 * Use these constants for consistent UI.
 */

/** Size scale: xs (compact) < sm < md (default) < lg */
export type Size = 'xs' | 'sm' | 'md' | 'lg';

// ─── Spacing (padding, margin) ─────────────────────────────────────────────
export const spacing = {
  /** 4px */
  xs: 4,
  /** 6px */
  sm: 6,
  /** 8px */
  md: 8,
  /** 12px */
  lg: 12,
  /** 16px */
  xl: 16,
  /** 20px */
  '2xl': 20,
  /** 24px */
  '3xl': 24,
} as const;

// ─── Typography (Tailwind classes) ─────────────────────────────────────────
export const text = {
  /** 9px - captions, metadata */
  xs: 'text-[9px]',
  /** 10px - small labels, badges */
  sm: 'text-[10px]',
  /** 12px - body compact, labels */
  base: 'text-xs',
  /** 14px - body default */
  md: 'text-sm',
  /** 16px - subheading */
  lg: 'text-base',
  /** 18px - section title */
  xl: 'text-lg',
  /** 20px - page title */
  '2xl': 'text-xl',
} as const;

export const fontWeight = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
} as const;

// ─── Icon sizes (numeric for MaterialIcons size prop) ──────────────────────
export const iconSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

// ─── Border radius (Tailwind classes) ──────────────────────────────────────
export const radius = {
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
} as const;

// ─── Component class presets ───────────────────────────────────────────────

/** Button padding & text by size */
export const button = {
  xs: {
    container: 'py-1 px-2 rounded',
    text: 'text-[10px]',
    icon: iconSize.xs,
  },
  sm: {
    container: 'py-2 px-3 rounded-lg',
    text: 'text-xs',
    icon: iconSize.sm,
  },
  md: {
    container: 'py-2.5 px-4 rounded-lg',
    text: 'text-xs',
    icon: iconSize.md,
  },
  lg: {
    container: 'py-3 px-5 rounded-xl',
    text: 'text-sm',
    icon: iconSize.lg,
  },
} as const;

/** Card padding by size */
export const card = {
  xs: 'p-2',
  sm: 'p-2.5',
  md: 'p-3',
  lg: 'p-4',
} as const;

/** Section padding (page sections) */
export const section = {
  xs: 'px-2 py-2',
  sm: 'px-3 py-2',
  md: 'px-4 py-4',
} as const;

/** Detail row (icon + label + value) spacing */
export const detailRow = {
  xs: {
    gap: 6,
    icon: iconSize.xs,
    label: 'text-[10px]',
    value: 'text-[10px]',
    marginBottom: 8,
  },
  sm: {
    gap: 8,
    icon: iconSize.sm,
    label: 'text-xs',
    value: 'text-xs',
    marginBottom: 8,
  },
  md: {
    gap: 12,
    icon: iconSize.md,
    label: 'text-sm',
    value: 'text-sm',
    marginBottom: 20,
  },
} as const;

/** Input field sizing */
export const input = {
  xs: 'px-3 py-2 rounded-lg text-xs',
  sm: 'px-3 py-2.5 rounded-lg text-xs',
  md: 'px-4 py-3 rounded-xl text-sm',
  lg: 'px-5 py-3.5 rounded-xl text-base',
} as const;

/** Modal sizing */
export const modal = {
  overlay: 'p-3',
  container: 'p-4 rounded-xl',
  title: 'text-base',
  message: 'text-xs',
  button: 'py-2 rounded-lg text-xs',
} as const;
