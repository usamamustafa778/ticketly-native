/** Background pattern styles for ticket */
export type BackgroundElement =
  | 'none'
  | 'organic'      // Music - organic shapes
  | 'fluid'        // Fluid / Liquid
  | 'grid'         // Tech - grid lines
  | 'geometric'    // Technical / Geometric
  | 'mesh'         // Art - mesh pattern
  | 'gradient_mesh'// Aesthetic / Gradient mesh
  | 'vector'       // Sports - vector shapes
  | 'dynamic';     // Dynamic / Kinetic

/** Pattern weight: sharper (thinnest) to thicker (boldest) */
export type PatternWeight = 'sharper' | 'sharp' | 'thin' | 'medium' | 'thick' | 'thicker';

/** Ticket theme - dynamic colors for event tickets. Stored on Event, applied to all tickets. */
export interface TicketTheme {
  gradientStart: string;
  gradientEnd: string;
  primaryTextColor: string;
  accentColor: string;
  brandColor: string;
  gradientDirection: string;
  backgroundElement?: BackgroundElement;
  patternWeight?: PatternWeight;
}

export const PATTERN_WEIGHTS: { id: PatternWeight; name: string; description: string }[] = [
  { id: 'sharper', name: 'Sharper', description: 'Thinnest lines' },
  { id: 'sharp', name: 'Sharp', description: 'Thinner, finer lines' },
  { id: 'thin', name: 'Thin', description: 'Thin lines' },
  { id: 'medium', name: 'Medium', description: 'Balanced' },
  { id: 'thick', name: 'Thick', description: 'Bolder lines' },
  { id: 'thicker', name: 'Thicker', description: 'Boldest, thickest lines' },
];

export const BACKGROUND_ELEMENTS: { id: BackgroundElement; name: string; style: string }[] = [
  { id: 'none', name: 'None', style: 'No pattern' },
  { id: 'organic', name: 'Organic', style: 'Music' },
  { id: 'fluid', name: 'Fluid', style: 'Liquid' },
  { id: 'grid', name: 'Grid', style: 'Tech' },
  { id: 'geometric', name: 'Geometric', style: 'Technical' },
  { id: 'mesh', name: 'Mesh', style: 'Art' },
  { id: 'gradient_mesh', name: 'Gradient Mesh', style: 'Aesthetic' },
  { id: 'vector', name: 'Vector', style: 'Sports' },
  { id: 'dynamic', name: 'Dynamic', style: 'Kinetic' },
];

/** White background, primary dotted borders - no thumbnail-derived colors */
export const DEFAULT_TICKET_THEME: TicketTheme = {
  gradientStart: '#FFFFFF',
  gradientEnd: '#FFFFFF',
  primaryTextColor: '#1F1F1F',
  accentColor: '#DC2626', // primary - dotted borders
  brandColor: '#DC2626', // primary - ticketly branding
  gradientDirection: 'to right bottom',
  backgroundElement: 'none',
  patternWeight: 'medium',
};

/** Preset themes for quick selection */
export const PRESET_THEMES: { name: string; theme: TicketTheme }[] = [
  {
    name: 'Sunset',
    theme: {
      gradientStart: '#F59E0B',
      gradientEnd: '#EF4444',
      primaryTextColor: '#FFFFFF',
      accentColor: '#FCD34D',
      brandColor: '#FEE2E2',
      gradientDirection: 'to right bottom',
      backgroundElement: 'none',
    },
  },
  {
    name: 'Ocean',
    theme: {
      gradientStart: '#0EA5E9',
      gradientEnd: '#6366F1',
      primaryTextColor: '#FFFFFF',
      accentColor: '#67E8F9',
      brandColor: '#CFFAFE',
      gradientDirection: 'to right bottom',
      backgroundElement: 'none',
    },
  },
  {
    name: 'Forest',
    theme: {
      gradientStart: '#22C55E',
      gradientEnd: '#15803D',
      primaryTextColor: '#FFFFFF',
      accentColor: '#86EFAC',
      brandColor: '#DCFCE7',
      gradientDirection: 'to right bottom',
      backgroundElement: 'none',
    },
  },
  {
    name: 'Royal',
    theme: {
      gradientStart: '#7C3AED',
      gradientEnd: '#EC4899',
      primaryTextColor: '#FFFFFF',
      accentColor: '#E9D5FF',
      brandColor: '#FCE7F3',
      gradientDirection: 'to right bottom',
      backgroundElement: 'none',
    },
  },
  {
    name: 'Midnight',
    theme: {
      gradientStart: '#1E3A5F',
      gradientEnd: '#0F172A',
      primaryTextColor: '#F8FAFC',
      accentColor: '#38BDF8',
      brandColor: '#94A3B8',
      gradientDirection: 'to right bottom',
      backgroundElement: 'none',
    },
  },
];

/** Merge partial theme with defaults */
export function mergeTicketTheme(partial?: Partial<TicketTheme> | null): TicketTheme {
  if (!partial || typeof partial !== 'object') {
    return { ...DEFAULT_TICKET_THEME };
  }
  return {
    ...DEFAULT_TICKET_THEME,
    ...partial,
    gradientDirection: partial.gradientDirection ?? DEFAULT_TICKET_THEME.gradientDirection,
    backgroundElement: partial.backgroundElement ?? DEFAULT_TICKET_THEME.backgroundElement ?? 'none',
    patternWeight: partial.patternWeight ?? DEFAULT_TICKET_THEME.patternWeight ?? 'medium',
  };
}
