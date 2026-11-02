/**
 * Brand identity — "navy and beige": a deep navy for the brand and chrome,
 * ink neutrals with a slight navy tint, warm beige light surfaces and a beige
 * accent used sparingly. Every colour the app draws must come from here —
 * never inline hex in screens.
 */

const palette = {
  // Navy, ordered light → dark. Brand identity, hero surfaces, splash.
  navy50: '#EEF2F8',
  navy100: '#DCE4F0',
  navy200: '#B7C6DE',
  navy300: '#8AA2C6',
  navy400: '#5C7BA8',
  navy500: '#3A5A8A',
  navy600: '#24406E',
  navy700: '#1B3157',
  navy800: '#142545',
  navy900: '#0F1C36',
  navy950: '#0A1326',

  // Beige — warm surfaces and the accent.
  beige50: '#FBF8F2',
  beige100: '#F5EFE3',
  beige200: '#EBDFC8',
  beige300: '#DCC9A6',
  beige400: '#C9AE80',
  beige500: '#B39262',
  beige600: '#8C6E44',

  // Ink neutrals — faintly navy so they sit with the brand.
  neutral900: '#141B2B',
  neutral800: '#222B3D',
  neutral700: '#374154',
  neutral600: '#4A5468',
  neutral500: '#646E83',
  neutral400: '#8A92A3',
  neutral300: '#B4B9C3',
  neutral200: '#DCDCDA',
  neutral100: '#ECE9E2',
  neutral50: '#F7F4EE',
  white: '#FFFFFF',
  black: '#000000',

  // Status hues stay separate from the brand.
  green600: '#22613F',
  green500: '#2E7D5B',
  green100: '#E3F1EA',

  amber600: '#7E5A28',
  amber500: '#C8923F',
  amber100: '#F8EEDC',

  red600: '#9B3B3D',
  red500: '#B8484A',
  red100: '#F9E9E7',

  blue600: '#2C5683',
  blue500: '#3A6EA5',
  blue100: '#E4EDF6',
};

export type ColorScheme = {
  /** Brand */
  brand: string;
  brandPressed: string;
  brandSoft: string;
  brandSofter: string;
  onBrand: string;
  deep: string;
  deepAlt: string;
  onDeep: string;
  onDeepMuted: string;
  accent: string;

  /** Surfaces */
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  /** Recessed track behind segmented controls: visible on every background. */
  track: string;
  surfaceInverse: string;
  overlay: string;
  scrim: string;
  glass: string;
  glassBorder: string;

  /** Lines */
  border: string;
  borderStrong: string;
  divider: string;

  /** Text */
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Hint text inside empty inputs: clearly lighter than a typed value. */
  placeholder: string;
  textInverse: string;
  textOnColor: string;

  /** Status — system feedback */
  success: string;
  successSoft: string;
  successText: string;
  warning: string;
  warningSoft: string;
  warningText: string;
  danger: string;
  dangerDeep: string;
  dangerSoft: string;
  dangerText: string;
  info: string;
  infoSoft: string;
  infoText: string;
  neutralSoft: string;
  neutralText: string;

  /** Map */
  mapWater: string;
  mapLand: string;
  /** Today's route polyline. */
  mapRoute: string;
  /** Customer pin fill and the beige ring around it. */
  pinCustomer: string;
  pinRing: string;
  skeleton: string;
  skeletonHighlight: string;
};

export const lightColors: ColorScheme = {
  brand: palette.navy700,
  brandPressed: palette.navy800,
  brandSoft: palette.navy100,
  brandSofter: palette.navy50,
  onBrand: palette.white,
  deep: palette.navy900,
  deepAlt: palette.navy950,
  onDeep: palette.beige100,
  onDeepMuted: 'rgba(245,239,227,0.76)',
  accent: palette.beige500,

  background: palette.beige50,
  surface: palette.white,
  surfaceAlt: palette.beige100,
  surfaceSunken: palette.beige200,
  track: palette.beige200,
  surfaceInverse: palette.navy900,
  overlay: 'rgba(10,19,38,0.48)',
  scrim: 'rgba(10,19,38,0.06)',
  glass: 'rgba(255,255,255,0.92)',
  glassBorder: 'rgba(20,27,43,0.08)',

  border: palette.beige200,
  borderStrong: palette.beige300,
  divider: 'rgba(20,27,43,0.07)',

  text: palette.neutral900,
  textSecondary: palette.neutral600,
  // Still 4.5:1 on white: used for small supporting text.
  textTertiary: palette.neutral500,
  placeholder: palette.neutral400,
  textInverse: palette.white,
  textOnColor: palette.white,

  success: palette.green500,
  successSoft: palette.green100,
  successText: palette.green600,
  warning: palette.amber500,
  warningSoft: palette.amber100,
  warningText: palette.amber600,
  danger: palette.red500,
  dangerDeep: '#843235',
  dangerSoft: palette.red100,
  dangerText: palette.red600,
  info: palette.blue500,
  infoSoft: palette.blue100,
  infoText: palette.blue600,
  neutralSoft: palette.beige100,
  neutralText: palette.neutral600,

  mapWater: '#D6E2EC',
  mapLand: '#F3EEE4',
  mapRoute: palette.navy700,
  pinCustomer: palette.navy700,
  pinRing: palette.beige300,
  skeleton: palette.beige200,
  skeletonHighlight: palette.beige100,
};

export const darkColors: ColorScheme = {
  brand: palette.navy300,
  brandPressed: palette.navy200,
  brandSoft: 'rgba(138,162,198,0.16)',
  brandSofter: 'rgba(138,162,198,0.08)',
  onBrand: palette.navy950,
  deep: palette.navy900,
  deepAlt: palette.navy950,
  onDeep: palette.beige100,
  onDeepMuted: 'rgba(245,239,227,0.72)',
  accent: palette.beige300,

  background: '#0B1220',
  surface: '#121B2E',
  surfaceAlt: '#18233A',
  surfaceSunken: '#0E1627',
  track: 'rgba(255,255,255,0.06)',
  surfaceInverse: palette.beige50,
  overlay: 'rgba(0,0,0,0.62)',
  scrim: 'rgba(255,255,255,0.05)',
  glass: 'rgba(18,27,46,0.92)',
  glassBorder: 'rgba(255,255,255,0.08)',

  border: '#26324A',
  borderStrong: '#34425E',
  divider: 'rgba(255,255,255,0.06)',

  text: palette.beige50,
  textSecondary: '#B7BFCE',
  textTertiary: '#8F99AD',
  placeholder: '#66718A',
  textInverse: palette.neutral900,
  textOnColor: palette.white,

  success: '#5BB38A',
  successSoft: 'rgba(91,179,138,0.15)',
  successText: '#9AD6B8',
  warning: '#D9A55A',
  warningSoft: 'rgba(217,165,90,0.15)',
  warningText: '#EBC88F',
  danger: '#E39893',
  dangerDeep: '#843235',
  dangerSoft: 'rgba(227,152,147,0.15)',
  dangerText: '#F2B8B2',
  info: '#7FA6D1',
  infoSoft: 'rgba(127,166,209,0.15)',
  infoText: '#B9D0EA',
  neutralSoft: '#18233A',
  neutralText: '#B7BFCE',

  mapWater: '#1B2A44',
  mapLand: '#18233A',
  mapRoute: palette.navy300,
  pinCustomer: palette.navy600,
  pinRing: palette.beige300,
  skeleton: '#1A2740',
  skeletonHighlight: '#24324E',
};

export { palette };
