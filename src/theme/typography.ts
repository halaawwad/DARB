import type { TextStyle } from 'react-native';

/**
 * IBM Plex Sans Arabic is loaded at boot. It carries Latin glyphs and the
 * shekel sign too, so mixed strings (phone numbers, brand names, ₪ amounts)
 * stay in one family. It has no 800 weight; extrabold maps to bold.
 */
export const fontFamily = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
  extrabold: 'IBMPlexSansArabic_700Bold',
} as const;

/** Arabic needs taller lines for its ascenders and descenders. */
export const ARABIC_LINE_HEIGHT_SCALE = 1.14;

export type FontWeightToken = keyof typeof fontFamily;

/**
 * Font for a weight. Letter spacing must stay at zero for Arabic: a connected
 * script breaks apart when its letters are spread.
 */
export function typeFace(weight: FontWeightToken): string {
  return fontFamily[weight];
}

export type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'titleLg'
  | 'title'
  | 'bodyLg'
  | 'body'
  | 'bodySm'
  | 'label'
  | 'caption'
  | 'button'
  | 'buttonSm';

type VariantStyle = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'letterSpacing'> & {
  weight: FontWeightToken;
};

/**
 * A deliberately restrained scale: hierarchy comes from weight, colour and
 * space as much as size, so titles never crowd the content they introduce.
 */
export const typography: Record<TypographyVariant, VariantStyle> = {
  display: { fontSize: 32, lineHeight: 40, letterSpacing: -0.9, weight: 'semibold' },
  h1: { fontSize: 26, lineHeight: 34, letterSpacing: -0.6, weight: 'bold' },
  h2: { fontSize: 20, lineHeight: 28, letterSpacing: -0.35, weight: 'semibold' },
  h3: { fontSize: 17, lineHeight: 24, letterSpacing: -0.2, weight: 'semibold' },
  titleLg: { fontSize: 16, lineHeight: 22, letterSpacing: -0.15, weight: 'semibold' },
  title: { fontSize: 15, lineHeight: 21, letterSpacing: -0.1, weight: 'semibold' },
  bodyLg: { fontSize: 16, lineHeight: 24, weight: 'regular' },
  body: { fontSize: 15, lineHeight: 22, weight: 'regular' },
  bodySm: { fontSize: 13, lineHeight: 19, weight: 'regular' },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: -0.05, weight: 'semibold' },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.05, weight: 'medium' },
  button: { fontSize: 15, lineHeight: 22, letterSpacing: -0.1, weight: 'semibold' },
  buttonSm: { fontSize: 14, lineHeight: 20, letterSpacing: -0.05, weight: 'semibold' },
};

/** Caps text growth so layouts survive large accessibility text sizes. */
export const maxFontSizeMultiplier = 1.35;
