/**
 * 本機純離線訂單解析引擎 (Local Offline PO Parser)
 * 在瀏覽器端解析資料，不呼叫外部 API。
 * 支援 Excel、CSV、PDF／OCR 擷取表格與剪貼簿純文字。
 */

import { OrderData, OrderItem, Colorway } from '../types/order';
import { matchProductInDatabase } from './productDatabase';
import { detectCsqCompany, csqOrderNumber, csqFactoryDate } from './csqAccount';
import {readMultipleKits} from './csqMultipleParser';

export interface LocalParseResult {
  success: boolean;
  order?: OrderData;
  error?: string;
  detectedHeaders?: string[];
  recognizedFormat?: string;
  warnings?: string[];
}

// 常用成衣尺寸清單（大寫比對）
const STANDARD_SIZES = [
  'UNI', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL', '6XL',
  '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56',
  '28', '30', '32', '34',
  '116', '128', '140', '152', '164', '176',
  'OS', 'FREE', 'ONE SIZE', '6A', '8A', '10A', '12A', '14A', '16A'
];
const isSize = (value: string) => STANDARD_SIZES.includes(value.toUpperCase()) || /^\d{1,3}A$/i.test(value);

function readNumber(value: unknown): number {
  // Internal spaces indicate distinct tokens, not a single quantity.
  let text = clean(value).replace(/(?:USD|RMB|EUR|US\$|[$€¥])/gi, '').trim();
  if (!/^-?\d[\d.,]*$/.test(text)) return NaN;
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (text.includes(',')) {
    text = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.');
  }
  return Number(text);
}

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

  const sourceText=rows.map(row=>row.join(' ')).join('\n');
  if (/Falis\s+2014|PREMIUM SPORTS TRADING|MEDICO FAR EAST LIMITED/i.test(sourceText)) return {success:false,error:'此客戶 PO 須保留原始 PDF 欄位座標，請直接上傳原始 PDF；純文字不能安全核對尺碼與金額。'};

  if (rows.some(row => /VENDOR\s+PART\s+NUMBER/i.test(row.join(' ')))) return parseVendorPo(rows, fileName);

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
  const warnings: string[] = [];

  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r].map(clean);
    const rowStr = row.join(' ').toUpperCase();

    // 抓取 PO 號碼 (必須加上 \b 邊界，避免誤配 SPORTS 中的 PO)
    if (!poNumber) {
      const poMatch =
        rowStr.match(/\b(2[5-9]OF\d{4,8})\b/i) ||
        rowStr.match(/\b(?:P\.?O\.?\s*(?:NO\.?|#)?|ORDER\s*(?:NUMBER|NO\.?|#)?|NUMERO\s*ORDINE|COMMANDE)[\s:]*([A-Z0-9_/-]+)/i);
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
      const c = cell.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/_/g, ' ').replace(/Q[.\s]*T[.\s]*A\b/g, 'QTA');
      if (!c) return;

      if (/^(ITEM\s*NO|ITEM|STYLE\s*NO|STYLE|CODICE|COD\.?\s*ART|MODEL|ARTICLE|ARTICOLO|ART\b|SKU|款號|產品編號)/.test(c)) {
        tempColMap['itemNo'] = colIdx;
        hasItemCol = true;
      } else if (/^(DESC|DESCRIPTION|DESCRIZIONE|STYLE\s*NAME|品名)/.test(c)) {
        tempColMap['description'] = colIdx;
      } else if (/^(COLOR\s*CODE|COL\.\s*COD|COLORE\s*COD)/.test(c)) {
        tempColMap['colorCode'] = colIdx;
      } else if (/^(COLOR|COLOUR|COLORE|COL\b|VARIANTE|顏色)/.test(c)) {
        tempColMap['colorName'] = colIdx;
      } else if (/^(TOTAL\s*QTY|TOT\s*Q\.?TA|TOTAL|QTY|QUANTITY|QUANTITA|QUANTITE|Q\.?TA|PIECES|PCS|數量|總數)/.test(c)) {
        tempColMap['totalQty'] = colIdx;
        hasQtyCol = true;
      } else if (/^(UNIT\s*PRICE|PRICE|PREZZO|FOB|UNIT\s*USD|單價)/.test(c)) {
        tempColMap['unitPrice'] = colIdx;
      } else if (isSize(c)) {
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

  if (tableHeaderRowIndex === -1) {
    return { success: false, error: '已讀取文字，但找不到明確的款號及數量／尺碼欄位。請在辨識文字中核對欄位標題，或貼上包含 Item、Qty、Price 等標題的表格。' };
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
  let itemCounter = 1;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r].map(clean);
    if (row.every((c) => !c)) continue; // 跳過全空行

    const rowStr = row.join(' ').toUpperCase();
    if (row.some(c => /^(?:GRAND\s+TOTAL|TOTAL|TOTALE|合計|總計)\s*[:：]?$/i.test(c))) {
      continue; // 跳過合計行
    }

    const itemNoVal = colMap['itemNo'] !== undefined ? row[colMap['itemNo']] : '';
    const descVal = colMap['description'] !== undefined ? row[colMap['description']] : '';
    const colorCodeVal = colMap['colorCode'] !== undefined ? row[colMap['colorCode']] : '';
    const colorNameVal = colMap['colorName'] !== undefined ? row[colMap['colorName']] : '';
    const unitPriceVal = colMap['unitPrice'] !== undefined ? readNumber(row[colMap['unitPrice']]) : NaN;
    const totalQtyVal = colMap['totalQty'] !== undefined ? readNumber(row[colMap['totalQty']]) : NaN;

    // 判斷是否為商品行（如果 itemNoVal 有值，或是第一行有款式代碼）
    const effectiveItemNo = itemNoVal || (colMap['itemNo'] === undefined ? row[0] : '');
    if (/^(ITEM\s*(?:NO)?|STYLE\s*(?:NO)?|CODICE|ARTICLE|ARTICOLO|SKU|款號|產品編號)$/i.test(effectiveItemNo)) continue;
    if (effectiveItemNo && effectiveItemNo.length >= 3 && !/^(PAGE|NOTE|DATE|REF|NOTE)/i.test(effectiveItemNo)) {
      // 搜尋中英文對照資料庫
      const dbMatch = matchProductInDatabase(effectiveItemNo);

      // 提取各尺寸數量
      const quantitiesBySize: Record<string, number> = {};
      let rowSizeSum = 0;

      if (detectedSizes.length > 0) {
        detectedSizes.forEach(({ size, colIndex }) => {
          const val = readNumber(row[colIndex]);
          if (!isNaN(val) && val > 0) {
            quantitiesBySize[size] = val;
            rowSizeSum += val;
          } else {
            quantitiesBySize[size] = 0;
          }
        });
      }

      const finalQty = !isNaN(totalQtyVal) && totalQtyVal > 0 ? totalQtyVal : rowSizeSum;
      const unitUSD = !isNaN(unitPriceVal) && unitPriceVal >= 0 ? unitPriceVal : (dbMatch?.customerPriceUSD || 0);
      const unitRMB = dbMatch?.factoryCurrency === 'RMB' ? dbMatch.factoryPrice : dbMatch?.unitPriceRMB || 0;
      if (!finalQty) warnings.push(`${effectiveItemNo}：未辨識到數量，保留 0 件，請填寫。`);
      if (!unitUSD) warnings.push(`${effectiveItemNo}：未辨識到客戶單價，保留 0，請核對。`);
      if (rowSizeSum && totalQtyVal > 0 && totalQtyVal !== rowSizeSum) warnings.push(`${effectiveItemNo}：總數 ${totalQtyVal} 與尺碼合計 ${rowSizeSum} 不一致。`);

      const sizeList = detectedSizes.length > 0 ? detectedSizes.map((s) => s.size) : ['未分碼'];
      if (detectedSizes.length === 0) {
        quantitiesBySize['未分碼'] = finalQty;
        warnings.push(`${effectiveItemNo}：沒有尺碼明細，數量保留在「未分碼」，未自動平均分配。`);
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
        colorCode: colorCodeVal || '',
        colorName: colorNameVal || '',
        quantitiesBySize,
        totalQuantity: finalQty,
        ratioString: ratioString || undefined,
        ratioBySize: ratioString && ratioString.split(':').length === sizeList.length ? Object.fromEntries(sizeList.map((size, index) => [size, Number(ratioString.split(':')[index])])) : undefined,
        piecesPerPack: ratioString ? ratioString.split(':').reduce((sum, value) => sum + Number(value), 0) : undefined,
      };

      const newItem: OrderItem = {
        id: `item-${itemCounter}`,
        itemNo: effectiveItemNo,
        styleName: descVal || effectiveItemNo,
        chineseName: dbMatch?.chineseName || '',
        description: descVal || dbMatch?.specEN || '',
        chineseSpec: dbMatch?.chineseSpec || '',
        sizes: sizeList,
        unitPriceUSD: unitUSD,
        unitPriceRMB: unitRMB,
        totalQuantity: finalQty,
        totalAmountUSD: finalQty * unitUSD,
        totalAmountRMB: finalQty * unitRMB,
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
    customerAddress: '',
    poDate,
    piDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase(),
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
    factorySupplier: matchProductInDatabase(items[0]?.itemNo)?.factorySupplier || '',
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
    warnings: [...new Set(warnings)],
  };
}

/**
 * 本地純文字/剪貼簿解析（支援 TSV、逗點 CSV 或換行分隔表格）
 */
export function parseTextToOrder(rawText: string, fileName = 'pasted_text_order'): LocalParseResult {
  const lines = rawText.split(/\r?\n/);
  if (!rawText.trim()) {
    return { success: false, error: '貼上內容為空' };
  }

  // 判斷分隔符號（優先 Tab，其次逗點或分號）
  const delimiter = rawText.includes('\t') ? '\t' : lines.some(line => line.includes(';')) ? ';' : lines.some(line => line.includes(',')) ? ',' : null;
  const rows = lines.map(line => {
    if (delimiter) {
      // Preserve quoted CSV cells (commas in prices/descriptions are not delimiters).
      const cells: string[] = [];
      let cell = '', quoted = false;
      for (let index = 0; index < line.length; index++) {
        const character = line[index];
        if (character === '"') {
          if (quoted && line[index + 1] === '"') { cell += '"'; index++; }
          else quoted = !quoted;
        } else if (character === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
        else cell += character;
      }
      cells.push(cell.trim());
      return cells;
    }
    return line.trim().replace(/\b(ITEM|STYLE)\s+NO\.?\b/gi, '$1').replace(/\bCOLOR\s+CODE\b/gi, 'COLOR_CODE').replace(/\bUNIT\s+PRICE\b/gi, 'PRICE').replace(/\bTOTAL\s+QTY\b/gi, 'QTY').split(/\s{2,}|\t|\s+/);
  });
  return parseGridToOrder(rows, fileName);
}

function parseMultiplePo(rows:string[][],fileName:string):LocalParseResult{
 try{
  const kits=readMultipleKits(rows),text=rows.map(row=>row.join('\t')).join('\n');
  const sizes=[...new Set(kits.flatMap(kit=>Object.keys(kit.sizes)))];
  const metadata=rows.slice(0,rows.findIndex(row=>/Vendor part number/i.test(row.join(' ')))).filter(row=>!/^Item\b/i.test(row[0]||''));
  const parsed=parseGridToOrder([...metadata,['Item','Description','Color Code','Color',...sizes,'Qty','Price'],...kits.map(kit=>[kit.style,kit.description,kit.color,kit.colorName,...sizes.map(size=>kit.sizes[size]||0),kit.packs*kit.perPack,Math.round(kit.packPrice/kit.perPack*1e6)/1e6])],fileName);
  if(!parsed.order)return parsed;const order=parsed.order;
  if(order.items.length!==kits.length)throw new Error('混碼包裝明細被合併，需核對 Kit 分列');
  const pos=[...new Set([...text.matchAll(/\b\d{2}OF\d{6}\b/g)].map(m=>m[0]))];if(pos.length!==1)throw new Error('客戶 PO 號碼缺少或同檔含不同訂單');
  order.poNumber=pos[0];order.orderingCompany=detectCsqCompany(text);order.customerCode='CSQ';order.customerName=order.orderingCompany==='CISALFA'?'CISALFA SPORT SPA.':order.orderingCompany;order.piNumber=csqOrderNumber(order.poNumber,order.orderingCompany,order.poDate);
  order.shipmentDate=text.match(/Ship\s+(?:date\s+on\s+board|on\s+board)[:\s\t]+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i)?.[1]||order.shipmentDate;order.factoryShipDate=csqFactoryDate(order.shipmentDate);
  order.port=text.match(/\bPort[\t ]+([A-Z]+)/i)?.[1]||order.port;order.modeOfDelivery=text.match(/Mode\s+of\s+delivery[\t ]+(BY\s+(?:SEA|AIR))/i)?.[1]||'BY SEA';order.tradeTerms=text.match(/Delivery\s+terms[\t ]+([A-Z]+)/i)?.[1]||order.tradeTerms;order.paymentTerms=text.match(/Terms\s+of\s+payment[\t :]+([^\t\n]+)/i)?.[1]||order.paymentTerms;
  order.packingType='MULTIPLE PACK';order.orderType='prepack_kit';order.totalKits=kits.reduce((sum,kit)=>sum+kit.packs,0);
  for(const [i,item] of order.items.entries()){const kit=kits[i];item.vendorPart=kit.vendor;item.customerItemCodes=[kit.code,kit.component];item.kitCode=kit.code;item.kitDescription=kit.description;item.isPrepack=true;item.kitQty=kit.packs;item.piecesPerKit=kit.perPack;item.kitPriceUSD=kit.packPrice;item.sizes=Object.keys(kit.sizes);item.totalAmountUSD=kit.amount;item.ratioString=Object.entries(kit.ratios).map(([size,ratio])=>`${size}:${ratio}`).join(' / ');for(const color of item.colors){color.quantitiesBySize={...kit.sizes};color.ratioBySize={...kit.ratios};color.piecesPerPack=kit.perPack;color.ratioString=item.ratioString;} }
  order.totalAmountUSD=Math.round(kits.reduce((sum,kit)=>sum+kit.amount,0)*100)/100;
  const printedPacks=readNumber(text.match(/Total\s+Pieces\s*:\s*([\d.,]+)/i)?.[1]);if(!Number.isFinite(printedPacks)||printedPacks!==order.totalKits)throw new Error('PO 列印包數與 Kit 包數合計不符');
  const amounts=rows.filter(row=>row[0]==='USD');if(amounts.length!==1||Math.abs(readNumber(amounts[0].at(-1))-order.totalAmountUSD)>.005)throw new Error('PO 列印總金額與 Kit 金額合計不符');
  order.sourcePrintedPackQuantity=printedPacks;delete order.sourcePrintedQuantity;order.sourcePrintedAmount=order.totalAmountUSD;
  return {...parsed,order,warnings:[],recognizedFormat:'CSQ Multiple Pack（包數／配比／件數已交叉核對）'};
 }catch(error){return {success:false,error:`CSQ 混碼包裝：${error instanceof Error?error.message:'解析失敗'}`};}
}

/** CSQ normal PO: style, size, order multiple and color quantity use separate rows. */
function parseVendorPo(rows: any[][], fileName: string): LocalParseResult {
  const text = rows.map(row => row.map(clean).join('	')).join('\n');
  const pages=[...text.matchAll(/\bPage\s+(\d+)\s*of\s*(\d+)\b/gi)];
  if(pages.length){
    const expected=Number(pages[0][2]),seen=new Set(pages.map(p=>Number(p[1])));
    if(pages.some(p=>Number(p[2])!==expected||Number(p[1])<1||Number(p[1])>expected)||seen.size!==expected)return {success:false,error:`CSQ PO 頁數不完整（讀取 ${seen.size}／${expected} 頁），請提供全部頁面；未匯入不完整訂單。`};
  }
  if (/Kit\s+composition/i.test(text)) return parseMultiplePo(rows.map(row=>row.map(clean)),fileName);
  const metadata = rows.slice(0, Math.max(0, rows.findIndex(row => /VENDOR\s+PART\s+NUMBER/i.test(row.join(' ')))));
  type Record = { style: string; vendorPart: string; description: string; color: string; colorName: string; sizes: string[]; values: string[]; quantity: string; price: string; amount: number; codes: string[]; multiples: number[]; unresolved: boolean };
  const records: Record[] = [];
  let vendorPart = '', description = '', sizes: string[] = [], multiples: number[] = [], codes: string[] = [];
  let waitingColor = false, readingDescription = false, readingColorName = false;
  for (const source of rows) {
    const row = source.map(clean);
    // CSQ prints numbered AOP colours as either AOP2 or AOP 2, including
    // the vendor suffix. Keep the number inside the colour code so it
    // cannot shift the colour name and the following size quantities.
    if(row[0])row[0]=row[0].replace(/^((?:[A-Z][A-Z0-9-]*-)?AOP)\s+(\d+)(?=\s|$)/i,'$1$2');
    // PDF words close to a long part number or colour can share one text cell.
    // Recover those boundaries before changing parser state; otherwise the next
    // quantity can be attached to the preceding style or silently skipped.
    const combinedPart = row[0]?.match(/^((?=[A-Z0-9-]*\d)[A-Z][A-Z0-9-]{3,}(?:\/\d+)?)\s+(.+)$/);
    const combinedColor = row[0]?.match(/^((?:\d+(?:\/\d+)*|AOP\d*))\s+(.+)$/);
    if (combinedPart || combinedColor) {
      const split = (combinedPart || combinedColor)!;
      row.splice(0, 1, split[1], split[2]);
    }
    const line = row.join(' ');
    if (!line.trim() || /^(PAGE|VENDOR|ORDER|DATE|ITEM|BRAND|TOTAL|SALES|TERMS|DELIVERY|PORT|CURRENCY)/i.test(line.trim())) readingColorName = false;
    if (/^(?=.*\d)[A-Z][A-Z0-9-]{3,}(?:\/\d+)?$/.test(row[0] || '') && !/^S\d+$/.test(row[0]) && !/^AOP\d*$/i.test(row[0]) && row.length > 1) {
      vendorPart = row[0]; description = row.slice(1).join(' '); multiples = []; codes = [];
      readingColorName = false;
      waitingColor = vendorPart.endsWith('-'); readingDescription = true;
      const found = line.match(/\bS\d+\b/g); if (found) codes.push(...found);
      continue;
    }
    if (waitingColor && /^(?:\d+(?:\/\d+)*|AOP\d*)$/.test(row[0] || '')) {
      vendorPart += row[0]; waitingColor = false;
      description += ' ' + row.slice(1).filter(cell => !/^S\d+$/.test(cell)).join(' ');
      codes.push(...(line.match(/\bS\d+\b/g) || []));
      continue;
    }
    const nonempty = row.filter(Boolean);
    if (nonempty.length >= 1 && nonempty.every(isSize)) {
      sizes = nonempty.map(cell => cell.toUpperCase()); readingDescription = false; continue;
    }
    if (/^(MULTIPLO|MULTIPLE|RATIO)/i.test(row[0] || '')) { multiples = row.slice(1).map(readNumber); continue; }
    if (readingDescription && vendorPart && !/^(PAGE|VENDOR|ORDER|DATE|ITEM|BRAND|TOTAL|SALES|TERMS|DELIVERY|PORT)/i.test(line)) {
      codes.push(...(line.match(/\bS\d+\b/g) || []));
      description += ' ' + row.filter(cell => !/^S\d+$/.test(cell)).join(' '); continue;
    }
    if (readingColorName && records.length && nonempty.length === 1 && /^[+＋]?\s*[A-Z][A-Z .()+\/-]*$/i.test(line.trim()) && !/^(TOTAL|SALES|CURRENCY|AMOUNT|DISCOUNT|CHARGES|ROUND)/i.test(line.trim())) {
      const continuation=line.trim();
      records[records.length - 1].colorName += (/^[+＋]/.test(continuation)?'\n':' ') + continuation; continue;
    }
    if (!vendorPart || waitingColor || !sizes.length || !/^(?:\d+(?:\/\d+)*|AOP\d*)$/.test(row[0] || '')) continue;
    let marker = row.findIndex(cell => /^\d[\d.,]*\s*(?:PZ|PCS|PC|EA)\b/i.test(cell));
    let quantity = '', price = '', amount = NaN;
    if (marker >= 0) { quantity = row[marker].match(/^\d[\d.,]*/)?.[0] || ''; price = row[marker + 1] || ''; amount = readNumber(row[marker + 2]); }
    else { marker = row.findIndex(cell => /^(PZ|PCS|PC|EA)$/i.test(cell)); if (marker >= 1) { quantity = row[marker - 1]; price = row[marker + 1] || ''; amount = readNumber(row[marker + 2]); marker--; } }
    if (marker < 0 || !Number.isFinite(readNumber(quantity))) continue;
    const values = row.slice(2, marker), unresolved = values.length !== sizes.length || values.some(value => value !== '' && !Number.isFinite(readNumber(value)));
    const style = vendorPart.replace(/-(?:\d+(?:\/\d+)*|AOP\d*)$/, '');
    records.push({ style, vendorPart, description, color: row[0], colorName: row[1] || '', sizes: [...sizes], values, quantity, price, amount, codes: [...new Set(codes)], multiples: [...multiples], unresolved });
    readingColorName = true;
  }
  if (!records.length) return { success: false, error: '已讀取 CSQ PO 文字，但未找到完整款號／尺碼／PZ 數量列。請保留原表格换行，核對辨識文字。' };
  const allSizes = [...new Set(records.flatMap(record => record.sizes))];
  const normalized = records.map(record => [record.style, record.description, record.color, record.colorName,
    ...allSizes.map(size => { const index = record.sizes.indexOf(size); return index < 0 || record.unresolved ? '' : record.values[index]; }), record.quantity, record.price]);
  const result = parseGridToOrder([...metadata.filter(row => !/^ITEM\b/i.test(row[0] || '')), ['Item','Description','Color Code','Color',...allSizes,'Qty','Price'], ...normalized], fileName);
  if (!result.order) return result;
  const order = result.order;
  const pos = [...new Set([...text.matchAll(/\b\d{2}OF\d{6}\b/gi)].map(match => match[0].toUpperCase()))];
  if (pos.length > 1) return { success: false, error: '這份檔案含不同客戶 PO，請按訂單分開匯入。' };
  order.poNumber = pos[0] || order.poNumber;
  order.orderingCompany = detectCsqCompany(text); order.customerCode = 'CSQ';
  order.customerName = order.orderingCompany === 'CISALFA' ? 'CISALFA SPORT SPA.' : order.orderingCompany;
  order.piNumber = csqOrderNumber(order.poNumber, order.orderingCompany, order.poDate);
  order.shipmentDate = text.match(/Ship\s+(?:date\s+on\s+board|on\s+board)[:\s\t]+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i)?.[1] || order.shipmentDate;
  order.factoryShipDate = csqFactoryDate(order.shipmentDate);
  order.tradeTerms = text.match(/Delivery\s+terms[\s\t]+([A-Z]+)/i)?.[1] || order.tradeTerms;
  order.paymentTerms = text.match(/Terms\s+of\s+payment[\s\t:]+([^\t\n]+)/i)?.[1] || order.paymentTerms;
  order.items.forEach((item, index) => {
    const source = records[index];
    item.sizes = source.sizes; item.vendorPart = source.vendorPart; item.customerItemCodes = source.codes;
    const composition=source.description.match(/^(.*?)\s*-?\s*Products?\s+compo(?:sition|tion)\s*:\s*([\s\S]+)$/i);
    if(composition){item.styleName=composition[1].trim();item.description=composition[2].trim();item.composition=item.description;item.compositionSource='po';}
    item.colors.forEach(color => { color.quantitiesBySize = Object.fromEntries(source.sizes.map(size => [size, color.quantitiesBySize[size] || 0])); });
    item.isPrepack = false;
    if (source.multiples.length === source.sizes.length && source.multiples.every(value => Number.isFinite(value) && value > 0)) item.orderMultipleBySize = Object.fromEntries(source.sizes.map((size, i) => [size, source.multiples[i]]));
    if (source.unresolved) result.warnings?.push(item.itemNo + '：PDF 缺少空白尺碼欄位，已保留總數，請核對每個尺碼的件數。');
    if (Number.isFinite(source.amount) && Math.abs(item.totalAmountUSD - source.amount) > 0.01) result.warnings?.push(item.itemNo + '：數量乘單價與 PO 印製金額不符。');
    const db = matchProductInDatabase(item.itemNo); if (db?.factoryCurrency === 'USD') item.factoryUnitPriceUSD = db.factoryPrice;
  });
  order.packingType = 'NORMAL PACK'; order.orderType = order.items.length > 1 ? 'multi_color' : 'single_color';
  const printedTotal = readNumber(text.match(/Total\s+Pieces\s*:\s*([\d.,]+)/i)?.[1]);
  if (Number.isFinite(printedTotal)) order.sourcePrintedQuantity = printedTotal;
  if (Number.isFinite(printedTotal) && printedTotal !== order.totalPieces) return {success:false,error:`CSQ PO 明細僅讀到 ${order.totalPieces} 件，與原始 PO ${printedTotal} 件不符，請提供完整原始 PO；未匯入不完整訂單。`};
  const totals = [...text.matchAll(/\bUSD\s+([\d.,]+(?:[\t ]+[\d.,]+)*)/gi)];
  if (totals.length === 1) { order.sourcePrintedAmount = readNumber(totals[0][1].trim().split(/\s+/).at(-1)); if (Math.abs(order.totalAmountUSD - order.sourcePrintedAmount) > 0.01) return {success:false,error:'CSQ PO 明細與原始 PO 總金額不符，請核對完整頁數；未匯入不完整訂單。'}; }
  if(records.some(record=>/-AOP\d*$/.test(record.vendorPart)&&(record.unresolved||record.values.reduce((sum,value)=>sum+(value?readNumber(value):0),0)!==readNumber(record.quantity))))return {success:false,error:'CSQ 印花款色的尺碼件數與 PO 列印件數不符，請核對原始尺碼欄位；未匯入不完整訂單。'};
  result.recognizedFormat = 'CSQ 款色／尺碼分列 PO';
  return result;
}
