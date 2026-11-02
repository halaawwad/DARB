import type { Customer, Product } from '@/types';
import { normalizeArabic } from './arabic';

/**
 * Tiny hard-coded parser for spoken orders such as
 * "بدي ٣ كراتين مي و كرتونة شيبس للبقالة تبعت أبو أحمد".
 * It is a placeholder for the AI parser (see src/features/ai): it splits on
 * "و", finds a product alias and a quantity in each part, and matches the
 * customer by nickname, shop name or name anywhere in the sentence.
 */
export interface ParsedVoiceOrder {
  customer?: Customer;
  items: { product: Product; quantity: number }[];
}

const NUMBER_WORDS: Record<string, number> = {
  واحد: 1, وحده: 1,
  اثنين: 2, اتنين: 2, تنين: 2,
  ثلاث: 3, ثلاثه: 3, تلات: 3, تلاته: 3,
  اربع: 4, اربعه: 4,
  خمس: 5, خمسه: 5,
  ست: 6, سته: 6,
  سبع: 7, سبعه: 7,
  ثمان: 8, ثمانيه: 8, تمن: 8, تمانيه: 8,
  تسع: 9, تسعه: 9,
  عشر: 10, عشره: 10,
};

/** Dual unit forms mean two: "كرتونتين", "كيسين". */
const DUAL_UNITS = ['كرتونتين', 'كيسين', 'علبتين', 'باكيتين'];

/** Words may carry a clitic prefix: "المي", "والشيبس", "بالعصير". */
const stripPrefix = (word: string) => word.replace(/^(و|ب|ل)?(ال)?/, '');

function quantityIn(words: string[]): number {
  for (const word of words) {
    const digits = word.match(/\d+/);
    if (digits) return Number(digits[0]);
  }
  for (const word of words) {
    const value = NUMBER_WORDS[word] ?? NUMBER_WORDS[stripPrefix(word)];
    if (value) return value;
  }
  if (words.some((word) => DUAL_UNITS.includes(word))) return 2;
  return 1;
}

function productIn(segment: string, words: string[], products: Product[]): Product | undefined {
  return products.find((product) =>
    product.aliases.map(normalizeArabic).some((alias) =>
      alias.includes(' ')
        ? ` ${segment} `.includes(` ${alias} `)
        : words.some((word) => word === alias || stripPrefix(word) === alias),
    ),
  );
}

function customerIn(sentence: string, customers: Customer[]): Customer | undefined {
  let best: { customer: Customer; length: number } | undefined;
  for (const customer of customers) {
    for (const candidate of [customer.nickname, customer.shopName, customer.name]) {
      const needle = candidate && normalizeArabic(candidate);
      if (needle && sentence.includes(needle) && needle.length > (best?.length ?? 0)) {
        best = { customer, length: needle.length };
      }
    }
  }
  return best?.customer;
}

export function parseVoiceOrder(transcript: string, products: Product[], customers: Customer[]): ParsedVoiceOrder {
  const sentence = normalizeArabic(transcript);
  const items: ParsedVoiceOrder['items'] = [];

  for (const segment of sentence.split(/\s+و\s+|[،,]/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    const product = productIn(segment.trim(), words, products);
    if (!product) continue;
    const quantity = quantityIn(words);
    const existing = items.find((item) => item.product.id === product.id);
    if (existing) existing.quantity += quantity;
    else items.push({ product, quantity });
  }

  return { customer: customerIn(sentence, customers), items };
}
