export interface ProductMappingItem {
  id: string;
  itemNo: string;               // 產品編號 e.g. "ABCRW1036S26", "AFB831W26"
  factorySupplier: string;      // 工廠名稱 / 供應商 e.g. "晉江市蜀諾服裝有限公司" (直接帶入採購單)
  styleNameEN: string;          // 英文品名 e.g. "T-SHIRT ABC WOMAN"
  chineseName: string;          // 中文品名 e.g. "ABC女士短袖T恤"
  specEN: string;               // 英文面料 e.g. "100% POLYESTER SMALL NEEDLE WITH DRI-FIT..."
  chineseSpec: string;          // 中文面料規格 e.g. "面料:全滌 75D/72F小針眼布+吸濕排汗助劑 (布重:135GM/M2)"
  customerPriceUSD: number;     // 客人美金單價 (USD)
  factoryPrice: number;         // 工廠採購單價
  factoryCurrency: 'RMB' | 'USD'; // 工廠單價幣別 (可選 RMB 或 USD)
  unitPriceUSD?: number;        // 相容美金單價
  unitPriceRMB?: number;        // 相容人民幣單價
  updatedAt?: string;
}
