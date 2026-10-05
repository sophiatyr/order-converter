import { ProductMappingItem } from '../types/database';
import { defaultProductDatabase } from '../data/defaultProducts';

export const DB_STORAGE_KEY = 'SK_PRODUCT_MAPPING_DB_V2';

export function getStoredProducts(): ProductMappingItem[] {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DB_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Error reading product database from localStorage', e);
  }
  return defaultProductDatabase;
}

export function saveProductsToStorage(items: ProductMappingItem[]): void {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(items));
    }
  } catch (e) {
    console.error('Error writing product database to localStorage', e);
  }
}

export function matchProductInDatabase(itemNo: string): ProductMappingItem | undefined {
  if (!itemNo) return undefined;
  const products = getStoredProducts();
  const cleanTarget = itemNo.trim().toUpperCase();

  // 1. Exact match
  const exact = products.find((p) => p.itemNo.trim().toUpperCase() === cleanTarget);
  if (exact) return exact;

  // 2. Prefix match (e.g. target "AFB831W26-050" matches "AFB831W26")
  const prefixMatch = products.find(
    (p) =>
      cleanTarget.startsWith(p.itemNo.trim().toUpperCase()) ||
      p.itemNo.trim().toUpperCase().startsWith(cleanTarget)
  );
  if (prefixMatch) return prefixMatch;

  return undefined;
}

export function upsertProductInDatabase(item: {
  itemNo: string;
  factorySupplier?: string;
  chineseName?: string;
  chineseSpec?: string;
  styleNameEN?: string;
  specEN?: string;
  customerPriceUSD?: number;
  factoryCurrency?: 'RMB' | 'USD';
  factoryPrice?: number;
}): void {
  if (!item.itemNo) return;
  const products = getStoredProducts();
  const cleanItemNo = item.itemNo.trim();
  const idx = products.findIndex((p) => p.itemNo.trim().toUpperCase() === cleanItemNo.toUpperCase());

  const today = new Date().toISOString().split('T')[0];

  if (idx !== -1) {
    const existing = products[idx];
    products[idx] = {
      ...existing,
      factorySupplier: item.factorySupplier ?? existing.factorySupplier,
      chineseName: item.chineseName ?? existing.chineseName,
      chineseSpec: item.chineseSpec ?? existing.chineseSpec,
      customerPriceUSD: item.customerPriceUSD ?? existing.customerPriceUSD ?? 0,
      factoryCurrency: item.factoryCurrency ?? existing.factoryCurrency ?? 'RMB',
      factoryPrice: item.factoryPrice !== undefined && item.factoryPrice > 0 ? item.factoryPrice : existing.factoryPrice,
      unitPriceRMB:
        item.factoryCurrency === 'RMB' && item.factoryPrice
          ? item.factoryPrice
          : existing.unitPriceRMB,
      unitPriceUSD:
        item.factoryCurrency === 'USD' && item.factoryPrice
          ? item.factoryPrice
          : existing.unitPriceUSD,
      updatedAt: today,
    };
  } else {
    products.unshift({
      id: `prod-user-${Date.now()}`,
      itemNo: cleanItemNo,
      factorySupplier: item.factorySupplier || '',
      styleNameEN: item.styleNameEN || cleanItemNo,
      chineseName: item.chineseName || '',
      specEN: item.specEN || '',
      chineseSpec: item.chineseSpec || '',
      customerPriceUSD: item.customerPriceUSD || 0,
      factoryCurrency: item.factoryCurrency || 'RMB',
      factoryPrice: item.factoryPrice || 0,
      unitPriceRMB: item.factoryCurrency === 'RMB' ? (item.factoryPrice || 0) : 0,
      unitPriceUSD: item.factoryCurrency === 'USD' ? (item.factoryPrice || 0) : 0,
      updatedAt: today,
    });
  }

  saveProductsToStorage(products);
}
