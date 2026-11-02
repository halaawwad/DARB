/**
 * One continuous corner scale. Controls use the small end, cards the middle,
 * sheets and floating map surfaces the top.
 */
export const radius = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  xxl: 22,
  /** Large floating surfaces over the map. */
  xxxl: 26,
  pill: 999,
} as const;

export type Radius = keyof typeof radius;
