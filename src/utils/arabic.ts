const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Folds the spelling variants people type and speech recognisers return, so
 * "أبو أحمد", "ابو احمد" and "ابو احمد٣" compare equal: alef forms → ا,
 * ة → ه, ى → ي, no tashkeel or tatweel, Arabic-Indic digits → Latin.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
    .toLowerCase()
    .trim();
}
