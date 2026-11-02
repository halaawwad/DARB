import type { Product } from '@/types';
import { COMPANY } from './users';

export const PRODUCTS: Product[] = [
  { id: 'p_water', companyId: COMPANY.id, name: 'مياه معدنية 0.5 لتر', brand: 'نبع الجبل', unit: 'كرتونة', price: 12, aliases: ['مي', 'مية', 'ميه', 'مياه', 'ماء', 'مويه'] },
  { id: 'p_chips', companyId: COMPANY.id, name: 'شيبس مشكّل', brand: 'قرمش', unit: 'كرتونة', price: 45, aliases: ['شيبس', 'شبس', 'تشيبس'] },
  { id: 'p_juice', companyId: COMPANY.id, name: 'عصير برتقال 1 لتر', brand: 'بستان', unit: 'كرتونة', price: 60, aliases: ['عصير', 'عصاير', 'عصاير برتقان'] },
  { id: 'p_milk', companyId: COMPANY.id, name: 'حليب طويل الأجل 1 لتر', brand: 'الحقول', unit: 'كرتونة', price: 72, aliases: ['حليب', 'حليب طويل'] },
  { id: 'p_rice', companyId: COMPANY.id, name: 'أرز مصري 5 كغم', brand: 'السنابل', unit: 'كيس', price: 38, aliases: ['رز', 'ارز', 'أرز'] },
];

export const productById = (id: string): Product | undefined => PRODUCTS.find((product) => product.id === id);
