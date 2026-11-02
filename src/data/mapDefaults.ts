/** Al-Manara Square, Ramallah. */
export const RAMALLAH_CENTER = { latitude: 31.90332, longitude: 35.20583 } as const;

/** Opening view covering Ramallah, Al-Bireh and Beitunia. */
export const DEFAULT_REGION = {
  ...RAMALLAH_CENTER,
  latitudeDelta: 0.06,
  longitudeDelta: 0.07,
};
