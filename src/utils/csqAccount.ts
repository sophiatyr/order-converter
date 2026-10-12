import type { OrderData } from '../types/order';
import { findCsqReference, type CsqReference } from './csqReferences';
import {normalizeClassification} from './classification';
import {applyConfirmedPoCorrections} from './orderCorrections';

// Reference: SK-KPI/backend/app/eoi/parsers/csq.py, proposed_order_no.
export const CSQ_COMPANIES = ['CISALFA', 'FALIS', 'PREMIUM SPORTS', 'ITALIAN FITNESS', 'INTERSPORT', 'MEDICO'] as const;
export type CsqCompany = typeof CSQ_COMPANIES[number];
export const CSQ_PAYMENT_TERMS='100% AMOUNT BY USANCE L/C 90 DAYS.';
export function chineseFactoryName(name:string){const start=name.search(/[\u3400-\u9fff]/);return start<0?'工廠中文名稱待補':name.slice(start).replace(/\s*[A-Za-z].*$/,'').trim();}
export function detectCsqCompany(text: string): CsqCompany {
  if (/PREMIUM\s+SPORTS/i.test(text)) return 'PREMIUM SPORTS';
  if (/FALIS\s*2014/i.test(text)) return 'FALIS';
  if (/MEDICO\s+FAR\s+EAST/i.test(text)) return 'MEDICO';
  if (/ITALIAN\s+FITNESS/i.test(text)) return 'ITALIAN FITNESS';
  if (/INTERSPORT/i.test(text)) return 'INTERSPORT';
  return 'CISALFA';
}
export function csqOrderNumber(po: string, company: CsqCompany, date = ''): string {
  const value = po.trim().toUpperCase();
  if (company === 'FALIS') {
    const year = /^\d{4}-/.test(date) ? date.slice(2, 4) : date.match(/\d{4}$/)?.[0].slice(2);
    return /^[1-9]\d{3}$/.test(value) && year ? `CS${year}${value}FA` : '';
  }
  if (company === 'ITALIAN FITNESS' || company === 'INTERSPORT') {
    const match = value.match(/^PO0(\d{6})$/);
    return match ? `CS${match[1]}${company === 'ITALIAN FITNESS' ? 'IF' : 'IT'}` : '';
  }
  const match = value.match(/^(\d{2})OF(\d{6})$/);
  if (!match) return '';
  return company === 'CISALFA' ? `CS${match[1]}${match[2]}` : `CS${match[2]}${company === 'MEDICO' ? 'ME' : 'PS'}`;
}
export function normalizeCsqOrder(order: OrderData): OrderData {
  order=applyConfirmedPoCorrections(normalizeClassification(order));
  const company = order.orderingCompany || detectCsqCompany(order.customerName);
  return { ...order, customerCode: 'CSQ', orderingCompany: company,
    paymentTerms:!order.paymentTerms||/^90\s*L\/?C$/i.test(order.paymentTerms.trim())||/^100% AMOUNT BY USANCE L\/C 90 DAYS\.?$/i.test(order.paymentTerms.trim())?CSQ_PAYMENT_TERMS:order.paymentTerms,
    customerName: company === 'CISALFA' ? 'CISALFA SPORT SPA.' : order.customerName,
    piNumber: csqOrderNumber(order.poNumber, company, order.poDate) || order.piNumber,
    totalPieces: order.items.reduce((sum, item) => sum + item.totalQuantity, 0),
    totalAmountUSD: order.items.reduce((sum, item) => sum + item.totalQuantity * item.unitPriceUSD, 0),
    totalAmountRMB: order.items.reduce((sum, item) => sum + item.totalQuantity * item.unitPriceRMB, 0),
  };
}
export function csqFactoryDate(ship: string): string {
  const match = ship.match(/^(\d{4})-(\d{2})-(\d{2})$/) || ship.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/);
  if (!match) return '';
  const iso = match[1].length === 4;
  const year = Number(iso ? match[1] : match[3]), month = Number(match[2]), day = Number(iso ? match[3] : match[1]);
  const source = new Date(Date.UTC(year, month - 1, day));
  if (source.getUTCMonth() !== month - 1 || source.getUTCDate() !== day) return '';
  const last = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 2, Math.min(day, last))).toISOString().slice(0, 10);
}
export function factoryDocument(order: OrderData, references: CsqReference[] = []): OrderData {
  return { ...order, items: order.items.map(item => {
    const reference = findCsqReference(item.itemNo, order.poNumber, references);
    return { ...item, chineseName: reference?.name || item.chineseName || item.styleName,
      chineseSpec: reference?.spec || item.description || item.styleName,
      unitPriceUSD: item.factoryUnitPriceUSD || 0, totalAmountUSD: item.totalQuantity * (item.factoryUnitPriceUSD || 0) };
  }) };
}
export function csqIssues(order: OrderData): string[] {
  const issues: string[] = [];
  if (!csqOrderNumber(order.poNumber, order.orderingCompany || 'CISALFA', order.poDate)) issues.push('客戶 PO 號碼與下單公司編號規則不符，請核對 S/C 號碼。');
  if (order.sourcePrintedAmount !== undefined && Math.abs(order.totalAmountUSD - order.sourcePrintedAmount) > 0.01) issues.push(`明細金額與原始 PO 金額 ${order.sourcePrintedAmount.toFixed(2)} 不符。`);
  if (order.sourcePrintedQuantity !== undefined && order.totalPieces !== order.sourcePrintedQuantity) issues.push(`目前 ${order.totalPieces} 件與原始 PO ${order.sourcePrintedQuantity} 件不符。`);
  if (order.sourcePrintedPackQuantity !== undefined && order.items.reduce((sum, item) => sum + (item.kitQty || 0), 0) !== order.sourcePrintedPackQuantity) issues.push('混碼包裝的包數合計與原始 PO 不符。');
  for (const item of order.items) {
    if (!(item.totalQuantity > 0) || !(item.unitPriceUSD > 0)) issues.push(`${item.itemNo}：請核對數量與客戶單價。`);
    for (const color of item.colors) {
      const sum = Object.values(color.quantitiesBySize).reduce((a, b) => a + b, 0);
      if (item.isPrepack && (sum !== (item.kitQty || 0) * (item.piecesPerKit || 0) || Object.entries(color.ratioBySize || {}).some(([size, ratio]) => color.quantitiesBySize[size] !== ratio * (item.kitQty || 0)))) issues.push(`${item.itemNo}／${color.colorCode}：修改後尺碼件數與原始包數／配比不符，請核對混碼包裝。`);
      if (sum !== color.totalQuantity || '未分碼' in color.quantitiesBySize) issues.push(`${item.itemNo}／${color.colorCode || color.colorName}：尺碼尚未核對完整。`);
    }
  }
  return [...new Set(issues)];
}
