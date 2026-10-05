/**
 * 本機純離線訂單解析引擎 (Local Offline PO Parser)
 * 100% 在瀏覽器端本地運行，不呼叫任何外部 API，不傳輸任何網路封包，保證商業機密安全。
 * 支援 Excel (.xlsx, .xls)、CSV 與剪貼簿純文字。
 */

import { OrderData, OrderItem, Colorway } from '../types/order';
import { matchProductInDatabase } from './productDatabase';

export interface LocalParseResult {
  success: boolean;
  order?: OrderData;
  error?: string;
  detectedHeaders?: string[];
  recognizedFormat?: string;
}

// 常用成衣尺寸清單（大寫比對）
const STANDARD_SIZES = [
  'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', '6XL',
  '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56',
  '28', '30', '32', '34',
  '116', '128', '140', '152', '164', '176',
  'OS', 'FREE', 'ONE SIZE'
];

/**
 * 清理並標準化文字
 */
function clean(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str).trim();
}

/**
 * 本地解析二維陣列（來自 Excel Sheet 或 CSV）
 */
export function parseGridToOrder(rows: any[][], fileName: string = ''): LocalParseResult {
  if (!rows || rows.length === 0) {
    return { success: false, error: '檔案內容為空，未能讀取到任何資料行' };
  }

  // 1. 搜尋訂單檔頭資訊 (PO No, Customer, Date, Terms 等)
  let poNumber = '';
  let customerName = '';
  let customerCode = '';
  let poDate = '';
  let shipmentDate = '';
  let paymentTerms = '';
  let tradeTerms = '';
  let port = 'XIAMEN';

  // 2. 尋找表格標題行 (包含 Style / Item / Codice / Qty / Price 等關鍵字)
  let tableHeaderRowIndex = -1;
  let colMap: Record<string, number> = {};
  let detectedSizes: { size: string; colIndex: number }[] = [];

  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r].map(clean);
    const rowStr = row.join(' ').toUpperCase();

    // 抓取 PO 號碼 (必須加上 \b 邊界，避免誤配 SPORTS 中的 PO)
    if (!poNumber) {
      const poMatch =
        rowStr.match(/\b(?:P\.?O\.?\s*(?:NO\.?|#)?|ORDER\s*(?:NO\.?|#)?|NUMERO\s*ORDINE|COMMANDE)[\s:]*([A-Z0-9\-_/]+)/i) ||
        rowStr.match(/\b(2[5-9]OF\d{4,8})\b/i);
      if (
        poMatch &&
        poMatch[1] &&
        poMatch[1].length >= 3 &&
        !['KITE', 'INTERNATIONAL', 'DATE', 'PRICE'].includes(poMatch[1].toUpperCase())
      ) {
        poNumber = poMatch[1].trim();
      }
    }

    // 抓取客戶名稱
    if (!customerName) {
      if (rowStr.includes('CISALFA')) customerName = 'CISALFA SPORT SPA';
      else if (rowStr.includes('ARENA')) customerName = 'ARENA S.P.A.';
      else if (rowStr.includes('DECATHLON')) customerName = 'DECATHLON S.E.';
      else if (rowStr.includes('REUSCH')) customerName = 'REUSCH INTERNATIONAL';
      else if (rowStr.includes('NIKE')) customerName = 'NIKE EUROPEAN OPERATIONS';
      else {
        const buyerMatch = rowStr.match(/(?:BUYER|CUSTOMER|CLIENTE|SOLD TO|SPETTABILE)[\s:]*([A-Z0-9\s,\.]+)/i);
        if (buyerMatch && buyerMatch[1] && buyerMatch[1].length > 3) {
          customerName = buyerMatch[1].trim();
        }
      }
    }

    // 抓取日期
    if (!poDate) {
      const dateMatch = rowStr.match(/(?:ORDER DATE|DATA ORDINE|DATE)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
      if (dateMatch) poDate = dateMatch[1];
    }

    // 抓取交期
    if (!shipmentDate) {
      const shipMatch = rowStr.match(/(?:DELIVERY DATE|CONSEGNA|SHIPMENT DATE|SHIP DATE)[\s:]*([A-Z0-9\s\/\-\.]+)/i);
      if (shipMatch) shipmentDate = shipMatch[1].trim();
    }

    // 檢測是否為表格 Header 行
    let hasItemCol = false;
    let hasQtyCol = false;
    let tempColMap: Record<string, number> = {};
    let tempSizes: { size: string; colIndex: number }[] = [];

    row.forEach((cell, colIdx) => {
      const c = cell.toUpperCase();
      if (!c) return;

      if (/^(ITEM\s*NO|ITEM|STYLE\s*NO|STYLE|CODICE|MODEL|ARTICLE|ART\b)/.test(c)) {
        tempColMap['itemNo'] = colIdx;
        hasItemCol = true;
      } else if (/^(DESC|DESCRIPTION|DESCRIZIONE|STYLE\s*NAME|品名)/.test(c)) {
        tempColMap['description'] = colIdx;
      } else if (/^(COLOR\s*CODE|COL\.\s*COD|COLORE\s*COD)/.test(c)) {
        tempColMap['colorCode'] = colIdx;
      } else if (/^(COLOR|COLOUR|COLORE|COL\b|顏色)/.test(c)) {
        tempColMap['colorName'] = colIdx;
      } else if (/^(TOTAL\s*QTY|TOT\s*Q\.?TA|TOTAL|QTY|QUANTITY|Q\.?TA|數量|總數)/.test(c)) {
        tempColMap['totalQty'] = colIdx;
        hasQtyCol = true;
      } else if (/^(UNIT\s*PRICE|PRICE|PREZZO|FOB|UNIT\s*USD|單價)/.test(c)) {
        tempColMap['unitPrice'] = colIdx;
      } else if (STANDARD_SIZES.includes(c)) {
        tempSizes.push({ size: c, colIndex: colIdx });
      }
    });

    if (hasItemCol && (hasQtyCol || tempSizes.length >= 2)) {
      tableHeaderRowIndex = r;
      colMap = tempColMap;
      detectedSizes = tempSizes;
      break;
    }
  }

  // 檔名與預設後備
  if (!poNumber) {
    const fnMatch = fileName.match(/(2[5-9]OF\d{4,8}|PO[-_]?\d{4,10})/i);
    poNumber = fnMatch ? fnMatch[1] : 'PO' + new Date().toISOString().slice(2, 10).replace(/-/g, '');
  }
  if (!customerName) customerName = 'INTERNATIONAL BUYER';
  if (!customerCode) {
    customerCode = customerName.includes('CISALFA') ? 'CSQ' : customerName.slice(0, 3).toUpperCase();
  }
  if (!poDate) {
    const now = new Date();
    poDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }
  if (!shipmentDate) {
    shipmentDate = 'BEFORE 90 DAYS AFTER PO';
  }

  let piNumber = 'PI-' + poNumber;
  if (poNumber.startsWith('26OF') || poNumber.startsWith('25OF')) {
    piNumber = 'CS' + poNumber.slice(2);
  }

  // 3. 解析商品明細行
  const items: OrderItem[] = [];
  let isMultiplePackDetected = false;

  const startRow = tableHeaderRowIndex !== -1 ? tableHeaderRowIndex + 1 : 1;
  let currentItem: Partial<OrderItem> | null = null;
  let itemCounter = 1;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r].map(clean);
    if (row.every((c) => !c)) continue; // 跳過全空行

    const rowStr = row.join(' ').toUpperCase();
    if (rowStr.includes('TOTAL') || rowStr.includes('TOTALE') || rowStr.includes('GRAND TOTAL')) {
      continue; // 跳過合計行
    }

    const itemNoVal = colMap['itemNo'] !== undefined ? row[colMap['itemNo']] : '';
    const descVal = colMap['description'] !== undefined ? row[colMap['description']] : '';
    const colorCodeVal = colMap['colorCode'] !== undefined ? row[colMap['colorCode']] : '';
    const colorNameVal = colMap['colorName'] !== undefined ? row[colMap['colorName']] : '';
    const unitPriceVal = colMap['unitPrice'] !== undefined ? parseFloat(row[colMap['unitPrice']]) : NaN;
    const totalQtyVal = colMap['totalQty'] !== undefined ? parseInt(row[colMap['totalQty']], 10) : NaN;

    // 判斷是否為商品行（如果 itemNoVal 有值，或是第一行有款式代碼）
    const effectiveItemNo = itemNoVal || (colMap['itemNo'] === undefined ? row[0] : '');
    if (effectiveItemNo && effectiveItemNo.length >= 3 && !/^(PAGE|NOTE|DATE|REF|NOTE)/i.test(effectiveItemNo)) {
      // 搜尋中英文對照資料庫
      const dbMatch = matchProductInDatabase(effectiveItemNo);

      // 提取各尺寸數量
      const quantitiesBySize: Record<string, number> = {};
      let rowSizeSum = 0;

      if (detectedSizes.length > 0) {
        detectedSizes.forEach(({ size, colIndex }) => {
          const val = parseInt(row[colIndex], 10);
          if (!isNaN(val) && val > 0) {
            quantitiesBySize[size] = val;
            rowSizeSum += val;
          } else {
            quantitiesBySize[size] = 0;
          }
        });
      }

      const finalQty = !isNaN(totalQtyVal) && totalQtyVal > 0 ? totalQtyVal : rowSizeSum;
      const unitUSD = !isNaN(unitPriceVal) && unitPriceVal > 0 ? unitPriceVal : (dbMatch?.customerPriceUSD || dbMatch?.unitPriceUSD || 5.0);
      const unitRMB = dbMatch?.factoryPrice || dbMatch?.unitPriceRMB || 0;

      const sizeList = detectedSizes.length > 0 ? detectedSizes.map((s) => s.size) : ['S', 'M', 'L', 'XL'];
      if (Object.keys(quantitiesBySize).length === 0 && finalQty > 0) {
        const perSize = Math.floor(finalQty / sizeList.length);
        sizeList.forEach((sz, idx) => {
          quantitiesBySize[sz] = idx === 0 ? finalQty - perSize * (sizeList.length - 1) : perSize;
        });
      }

      // 檢測 Multiple Pack (混碼裝袋比例，例如含有 KIT, MULTI, 1:2:2:1 等)
      let ratioString = '';
      let isPrepack = false;
      if (rowStr.includes('KIT') || rowStr.includes('PACK') || rowStr.includes('ASSORT') || rowStr.includes(':')) {
        const ratioMatch = rowStr.match(/(\d+\s*:\s*\d+\s*:\s*\d+(?:\s*:\s*\d+)*)/);
        if (ratioMatch) {
          ratioString = ratioMatch[1].replace(/\s+/g, '');
          isPrepack = true;
          isMultiplePackDetected = true;
        }
      }

      const colorItem: Colorway = {
        id: `c-${itemCounter}-1`,
        colorCode: colorCodeVal || '050',
        colorName: colorNameVal || 'DEFAULT COLOR',
        quantitiesBySize,
        totalQuantity: finalQty > 0 ? finalQty : 100,
        ratioString: ratioString || undefined,
      };

      const newItem: OrderItem = {
        id: `item-${itemCounter}`,
        itemNo: effectiveItemNo,
        styleName: descVal || effectiveItemNo,
        chineseName: dbMatch?.chineseName || '男/女成衣',
        description: descVal || dbMatch?.specEN || '',
        chineseSpec: dbMatch?.chineseSpec || '針織面料',
        sizes: sizeList,
        unitPriceUSD: unitUSD,
        unitPriceRMB: unitRMB,
        totalQuantity: finalQty > 0 ? finalQty : 100,
        totalAmountUSD: (finalQty > 0 ? finalQty : 100) * unitUSD,
        totalAmountRMB: (finalQty > 0 ? finalQty : 100) * unitRMB,
        isPrepack: isPrepack,
        colors: [colorItem],
      };

      items.push(newItem);
      itemCounter++;
    }
  }

  if (items.length === 0) {
    return {
      success: false,
      error: '本機演算法未能在此表格中找到標準成衣明細欄位 (款號/數量/尺寸)。請確認檔案第一列是否有欄位標題，或使用貼上文字模式。',
    };
  }

  // 計算總計
  const totalPieces = items.reduce((sum, it) => sum + it.totalQuantity, 0);
  const totalAmountUSD = items.reduce((sum, it) => sum + it.totalAmountUSD, 0);
  const totalAmountRMB = items.reduce((sum, it) => sum + it.totalAmountRMB, 0);

  const finalOrder: OrderData = {
    orderType: isMultiplePackDetected ? 'prepack_kit' : items.length > 1 ? 'multi_color' : 'single_color',
    packingType: isMultiplePackDetected ? 'MULTIPLE PACK' : 'NORMAL PACK',
    poNumber,
    piNumber,
    customerCode,
    customerName,
    customerAddress: 'Via Boccea, 496 - 00166 Roma, CODICE FISCALE E P.IVA 03535280962',
    poDate,
    piDate: 'JAN 26, 2026',
    shipmentDate,
    factoryShipDate: '出貨前30天備妥',
    paymentTerms: paymentTerms || '100% AMOUNT BY USANCE L/C 90 DAYS',
    tradeTerms: tradeTerms || 'FOB XIAMEN BY SEA',
    port,
    modeOfDelivery: 'BY SEA',
    deliveryAddress: 'MAIN PORT / WAREHOUSE',
    sellerCompany: 'SPORTS KITE INTERNATIONAL CO.,LTD',
    bankInfo: {
      beneficiary: 'SPORTS KITE INTERNATIONAL CO., LTD.',
      bankName: 'MEGA INTERNATIONAL COMMERCIAL BANK CO.,LTD. SUNG NAN BRANCH',
      address: '234, SEC. 5, NANKING EAST RD., TAIPEI, 105, TAIWAN, R.O.C',
      accountNo: '04253004522',
      swiftCode: 'ICBCTWTP042',
    },
    remarks: [
      '1. PLUS 3% IN QUANTITY AND VALUE IS ACCEPTABLE',
      '2. THIRD PARTY DOCUMENT ALSO ACCEPTABLE',
      '3. PARTIAL SHIPMENT ALLOWED',
    ],
    factorySupplier: items[0]?.chineseName ? '泉州協力工廠' : '',
    supplierCode: 'LA',
    factoryTerms:
      '出貨後備齊重量裝箱明細, 請款發票, 本公司於收到此份文件後15日即以美金T/T支付貨款。人民幣貨款, 美金與人民幣匯率以出貨當日水單兌換匯率為憑',
    deliveryPlace: '待通知',
    complianceClause: '****所有主副料均需環保,符合歐洲REACH環保標準****',
    items,
    totalPieces,
    totalAmountUSD,
    totalAmountRMB,
  };

  return {
    success: true,
    order: finalOrder,
    recognizedFormat: isMultiplePackDetected ? 'Multiple Pack (混碼裝袋)' : 'Normal Pack (單碼個別包裝)',
  };
}

/**
 * 本地純文字/剪貼簿解析（支援 TSV、逗點 CSV 或換行分隔表格）
 */
export function parseTextToOrder(rawText: string): LocalParseResult {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { success: false, error: '貼上內容為空' };
  }

  // 判斷分隔符號（優先 Tab，其次逗點或分號）
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(',') ? ',' : ';';

  const rows = lines.map((line) => line.split(delimiter).map((col) => col.trim()));
  return parseGridToOrder(rows, 'pasted_text_order');
}
