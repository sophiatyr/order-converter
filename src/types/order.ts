export interface Colorway {
  id: string;
  colorCode: string; // e.g. "050" or "001/050"
  colorName: string; // e.g. "BLACK" or "16-6264 TSX Green Spring/Black"
  quantitiesBySize: Record<string, number>; // size -> quantity
  totalQuantity: number;
  ratioBySize?: Record<string, number>; // for prepack, e.g. { S: 1, M: 2, L: 2, XL: 1 }
  ratioString?: string; // e.g. "1:2:2:1:1" or "S:1 / M:2 / L:2 / XL:1"
  piecesPerPack?: number; // e.g. 6 or 7
}

export interface OrderItem {
  erpQuoteKey?: string;
  factoryProduct?: {supplier:string; supplierCode:string; currency:'RMB'|'USD'; price:number; unit:string; quoteDate:string};
  vendorPart?: string;
  customerItemCodes?: string[];
  orderMultipleBySize?: Record<string, number>;
  id: string;
  itemNo: string; // e.g. "AFB831W26", "RCL010", or "ABCRM1039S26"
  styleName: string; // e.g. "TSHIRT ARENA B" or "T-SHIRT ABC RUN SS"
  chineseName: string; // e.g. "ARENA男童T恤" or "ABC男士短袖跑步T恤"
  description: string; // e.g. "100%POLYESTER 75D/72F INTERLOCK DRY FIT, 145 GSM"
  chineseSpec: string; // e.g. "面料:全滌75D/72F普通雙面布+吸濕排汗助劑(務必做到), 布重:145GM/M2"
  sizes: string[]; // e.g. ["6A", "8A", "10A", "12A", "14A"] or ["XS", "S", "M", "L", "XL"]
  unitPriceUSD: number; // e.g. 2.30 (or piece price $2.10)
  unitPriceRMB: number; // e.g. 13.50
  factoryUnitPriceUSD?: number;
  colors: Colorway[];
  totalQuantity: number; // total garment pieces
  totalAmountUSD: number;
  totalAmountRMB: number;

  // Prepack / Multiplo (單色混碼) specific fields:
  isPrepack?: boolean;
  kitCode?: string; // e.g. "S4147822"
  kitDescription?: string; // e.g. "MULTIPLO S4147746 T-SHIRT ABC RUN SS ORANGE M"
  kitQty?: number; // e.g. 163 packs
  piecesPerKit?: number; // e.g. 6 pcs/pack
  kitPriceUSD?: number; // e.g. 12.60 USD / pack
  kitPriceRMB?: number; // e.g. 80.00 RMB / pack
  ratioString?: string; // e.g. "S:1 / M:2 / L:2 / XL:1"
}

export interface BankInfo {
  beneficiary: string;
  bankName: string;
  address: string;
  accountNo: string;
  swiftCode: string;
}

export interface OrderData {
  corrections?: {id:string;date:string;itemId:string;field:'itemNo'|'unitPriceUSD'|'description';originalValue:string;correctedValue:string;reason:string}[];
  season?: string;
  brand?: string;
  series?: string;
  rmbPerUsd?: number;
  factoryPurchaseOptions?: Record<string, {chineseName?:string; extraFees:{id:string;description:string;amount:number}[];hasDeposit:boolean;depositPercent:number}>;
  factoryExtraFees?: {id:string;description:string;amount:number}[];
  erpFactoryApplied?: boolean;
  factoryQuantityUnit?: '件'|'雙';
  orderingCompany?: 'CISALFA' | 'FALIS' | 'PREMIUM SPORTS' | 'ITALIAN FITNESS' | 'INTERSPORT' | 'MEDICO';
  sourceFileName?: string;
  sourceReferencePo?: string;
  sourceDiscountPercent?: number;
  sourceDiscountAmount?: number;
  sourceNetAmount?: number;
  reviewWarnings?: string[];
  sourcePrintedAmount?: number;
  sourcePrintedQuantity?: number;
  sourcePrintedPackQuantity?: number;
  orderType?: 'single_color' | 'multi_color' | 'prepack_kit';
  packingType?: 'NORMAL PACK' | 'MULTIPLE PACK';

  // Company letterhead
  companyHeader?: {
    name: string;
    address: string;
    tel: string;
    fax: string;
    web: string;
    managerDirector: string;
  };

  // Order Identification
  poNumber: string; // e.g. "26OF002273" or "25OF025310"
  piNumber: string; // e.g. "CS26002273" or "CS25025310"
  customerCode: string; // e.g. "CSQ"
  customerName: string; // e.g. "CISALFA SPORT SPA"
  customerAddress: string;

  // Dates
  poDate: string; // "23/01/2026" or "02/07/2025"
  piDate: string; // "JAN 26, 2026" or "JUL 02, 2025"
  shipmentDate: string; // "BEFORE MAY. 15, 2026" or "BEFORE OCT. 29, 2025"
  factoryShipDate: string; // "2026年04月30日前出貨" or "2025年10月15日前出貨"

  // Terms
  paymentTerms: string; // "100% AMOUNT BY USANCE L/C 90 DAYS"
  tradeTerms: string; // "FOB XIAMEN BY SEA"
  port: string; // "XIAMEN"
  modeOfDelivery: string; // "BY SEA"
  deliveryAddress: string;

  // Bank & Company
  sellerCompany: string;
  bankInfo: BankInfo;
  remarks: string[];

  // Factory PO details
  factorySupplier: string; // "晉江市蜀諾服裝有限公司"
  supplierCode: string; // "LA"
  factoryTerms: string;
  deliveryPlace: string; // "待通知"
  factoryCurrency?: 'RMB' | 'USD'; // "RMB" 或 "USD" 可選取
  hasDeposit?: boolean;
  depositPercent?: number; // e.g. 20 (20%)
  depositAmount?: number;
  complianceClause?: string; // "****所有主副料均需環保,符合歐洲REACH環保標準****"
  factoryClauses?: string[]; // 採購單備註條款

  // Items
  items: OrderItem[];
  totalPieces: number; // total garment pieces
  totalKits?: number; // total prepack kits (if prepack)
  totalAmountUSD: number;
  totalAmountRMB: number;
}
