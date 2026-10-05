import { Colorway } from '../types/order';

export interface RatioGroup {
  ratioKey: string;
  ratioString: string;
  piecesPerPack: number;
  ratioBySize: Record<string, number>;
  colors: Colorway[];
}

/**
 * 依據混碼配比與每包件數，將顏色自動分組
 * 「如有不同的, 同一個數量的配比放一起, 再依序往下列」
 */
export function groupColorsByRatio(colors: Colorway[], sizes: string[]): RatioGroup[] {
  const map = new Map<string, RatioGroup>();
  const groups: RatioGroup[] = [];

  for (const c of colors) {
    const rBySize = c.ratioBySize || {};
    
    // Calculate total pieces per pack
    let pieces = c.piecesPerPack;
    if (!pieces || pieces <= 0) {
      pieces = Object.values(rBySize).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    }
    if (!pieces || pieces <= 0) {
      pieces = 1;
    }

    // Build normalized formula key based on item sizes
    const formulaParts = sizes.map((s) => (rBySize[s] !== undefined ? rBySize[s] : 0));
    const formula = formulaParts.join(':');
    const key = `${pieces}_${formula}`;

    if (!map.has(key)) {
      const group: RatioGroup = {
        ratioKey: key,
        ratioString: c.ratioString || `${formula} (${pieces} PCS/PACK)`,
        piecesPerPack: pieces,
        ratioBySize: rBySize,
        colors: [],
      };
      map.set(key, group);
      groups.push(group);
    }

    map.get(key)!.colors.push(c);
  }

  // Sort groups: higher pieces/pack first (e.g. 7 pcs/pack before 6 pcs/pack)
  groups.sort((a, b) => b.piecesPerPack - a.piecesPerPack);

  return groups;
}
