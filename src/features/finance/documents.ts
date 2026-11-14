import { Linking, Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ar } from '@/i18n';
import { lightColors } from '@/theme/colors';
import { formatMoney } from '@/utils/format';
import type { FinanceState, Receipt } from './domain';
const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const money = (amount: number) => formatMoney(amount / 100);
export const reference = (id: string) =>
  id.startsWith('inv_') ? id.toUpperCase() : id.slice(0, 8).toUpperCase();
export function documentHtml(title: string, company: string, rows: string[][], notice: string) {
  const c = lightColors;
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:32px;color:${c.text};line-height:1.9}h1{color:${c.brand}}table{width:100%;border-collapse:collapse}td{padding:10px;border-bottom:1px solid ${c.border}}tr:first-child{font-weight:bold;background:${c.surfaceAlt}}footer{margin-top:28px;color:${c.textSecondary}}.notice{padding:12px;border:1px solid ${c.borderStrong}}@page{size:A4;margin:15mm}</style><h1>${esc(company)}</h1><h2>${esc(title)}</h2><p class="notice">${esc(notice)}</p><table>${rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table><footer>${esc(ar['finance.documentFooter'])}</footer></html>`;
}
export async function printDocument(html: string) {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank', 'width=900,height=800');
    if (!win) throw new Error('server');
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
    // Some browsers complete document.write before onload is attached.
    if (win.document.readyState === 'complete')
      setTimeout(() => {
        win.focus();
        win.print();
      }, 200);
  } else {
    const file = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync())
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    else await Print.printAsync({ uri: file.uri });
  }
}
export async function shareReceipt(state: FinanceState, r: Receipt, notice: string) {
  const customer = state.customers.find((c) => c.id === r.customerId)!;
  const status =
    r.method === 'cheque'
      ? ar[
          r.status === 'pending'
            ? 'finance.pendingReceipt'
            : r.status === 'bounced'
              ? 'finance.bouncedReceipt'
              : 'finance.clearedReceipt'
        ]
      : ar['finance.clearedReceipt'];
  const vars: Record<string, string> = {
    company: state.companyName,
    id: reference(r.id),
    customer: customer.name,
    amount: money(r.amount),
    method: ar[`finance.${r.method}`],
    date: r.date.slice(0, 10),
    status: `${status}\n${notice}`,
  };
  const message = ar['finance.receiptMessage'].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  let phone = customer.phone.replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (/^05\d{8}$/.test(phone)) phone = `970${phone.slice(1)}`;
  if (phone) await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
  else await Share.share({ message });
}
