import type { OrderData } from '../types/order';

export interface CsqReference {
  style: string; name: string; spec: string; poNumbers: string[]; sourceFile: string; sheet: string; row: number;
}
export interface CsqReferenceSnapshot { updatedAt: string; records: CsqReference[]; warnings: string[] }
export async function loadCsqReferences(): Promise<CsqReferenceSnapshot> {
  const response = await fetch('./csq-reference-products.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('參考成份資料尚未建立，暫用原始 PO 說明。');
  const snapshot = await response.json();
  if (!Array.isArray(snapshot.records)) throw new Error('參考成份資料無法讀取，暫用原始 PO 說明。');
  return snapshot;
}
const normalized = (value: string) => value.replace(/[\s,，:：+＋。]/g, '').toUpperCase();
export function findCsqReference(style: string, po: string, references: CsqReference[]): CsqReference | undefined {
  const exact = references.filter(r => r.style.trim().toUpperCase() === style.trim().toUpperCase());
  const byPo = exact.filter(r => r.poNumbers.includes(po));
  const candidates = byPo.length ? byPo : exact;
  // Conflicting compositions are not chosen by file order or a partial style match.
  return new Set(candidates.map(r => normalized(r.spec))).size === 1 ? candidates[0] : undefined;
}
export function referenceCoverage(order: OrderData, references: CsqReference[]) {
  const styles = [...new Set(order.items.map(i => i.itemNo))];
  return { matched: styles.filter(s => findCsqReference(s, order.poNumber, references)).length, total: styles.length };
}
