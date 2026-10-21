import type { OrderData } from '../types/order';
import { parseGridToOrder } from './localPoParser';
import { normalizeCsqOrder, csqFactoryDate } from './csqAccount';

/** Restore the workstation backup, or read a locally saved SK-KPI CSQ preview. No server is contacted. */
export function readCsqBackup(text: string): OrderData {
  const saved = JSON.parse(text);
  const source = saved?.order;
  if (saved?.account === 'CSQ' && saved?.version === 1 && source?.poNumber && Array.isArray(source.items) && source.items.length) {
    if(source.importedAt!==undefined&&(typeof source.importedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(source.importedAt)||!Number.isFinite(Date.parse(source.importedAt))))throw new Error('訂單匯入日期格式不符。');
    if(source.requiresAntiCounterfeitLabel!==undefined&&typeof source.requiresAntiCounterfeitLabel!=='boolean')throw new Error('防偽標設定格式不符。');
    if(source.normalCartonQuantity!==undefined&&(!Number.isInteger(source.normalCartonQuantity)||source.normalCartonQuantity<1))throw new Error('單色單碼每箱件數須為大於 0 的整數。');
    if(source.corrections!==undefined&&(!Array.isArray(source.corrections)||source.corrections.some((c:any)=>!c||!['itemNo','unitPriceUSD','description'].includes(c.field)||['id','date','itemId','originalValue','correctedValue','reason'].some(k=>typeof c[k]!=='string'))))throw new Error('訂單更正紀錄格式不符。');
    if(['season','brand','series'].some(k=>source[k]!==undefined&&typeof source[k]!=='string')||source.rmbPerUsd!==undefined&&(!Number.isFinite(source.rmbPerUsd)||source.rmbPerUsd<=0))throw new Error('訂單季別或成本匯率格式不符。');
    const checkTerms=(terms:any)=>{if(terms!==undefined&&(!terms||typeof terms!=='object'||Array.isArray(terms)||['payment','trade','place','reference'].some(k=>terms[k]!==undefined&&typeof terms[k]!=='string')))throw new Error('工廠交易條款格式不符。');};
    checkTerms(source.factoryTermsSettings);
    if(source.factoryTradeTerms!==undefined&&typeof source.factoryTradeTerms!=='string')throw new Error('工廠交易條件格式不符。');
    if(source.factoryPurchaseOptions)for(const option of Object.values(source.factoryPurchaseOptions) as any[])checkTerms(option?.terms);
    for (const item of source.items) {
      if(item.erpItemNo!==undefined&&typeof item.erpItemNo!=='string')throw new Error('ERP 尺碼品號格式不符。');
      if(item.factoryText!==undefined&&(!item.factoryText||typeof item.factoryText!=='object'||typeof item.factoryText.chineseName!=='string'||typeof item.factoryText.chineseSpec!=='string'))throw new Error('工廠中文資料格式不符。');
      if(item.composition!==undefined&&typeof item.composition!=='string'||item.compositionSource!==undefined&&!['po','product','erp','manual'].includes(item.compositionSource))throw new Error('訂單面料或來源格式不符。');
      if (!item.itemNo || !Array.isArray(item.sizes) || !Array.isArray(item.colors) || !Number.isFinite(item.totalQuantity) || item.totalQuantity < 0 || !Number.isFinite(item.unitPriceUSD) || item.unitPriceUSD < 0 || !Number.isFinite(item.unitPriceRMB) || item.unitPriceRMB < 0) throw new Error('訂單備份品項格式不完整。');
      for (const color of item.colors) if (!color.quantitiesBySize || !Number.isFinite(color.totalQuantity) || Object.values(color.quantitiesBySize).some(q => typeof q !== 'number' || !Number.isFinite(q) || q < 0)) throw new Error('訂單備份尺碼格式不完整。');
    }
    return normalizeCsqOrder(source);
  }
  const data = source?.template_code === 'CSQ' ? source : saved?.template_code === 'CSQ' ? saved : null;
  if (!data || !data.header?.customer_po || !Array.isArray(data.lines) || !data.lines.length) throw new Error('請選擇 CSQ 工作站訂單備份，或 SK-KPI 保存的 CSQ 解析資料。');
  if (data.header.currency !== 'USD') throw new Error('目前工作站的客戶報價幣別為 USD，此備份幣別需另行核對。');
  const sizes: string[] = [...new Set<string>(data.lines.flatMap((line: any) => line.size_order || []))];
  const parsed = parseGridToOrder([['Item','Color Code','Color',...sizes,'Qty','Price'], ...data.lines.map((line: any) => [line.style, line.color, line.color_name, ...sizes.map(size => line.sizes?.[size] || 0), line.qty, line.unit_price])]);
  if (!parsed.order) throw new Error(parsed.error);
  const order = parsed.order;
  Object.assign(order, { customerCode: 'CSQ', customerName: data.header.customer_name, orderingCompany: data.header.ordering_company || 'CISALFA',
    poNumber: data.header.customer_po, piNumber: data.header.proposed_order_no, poDate: data.header.order_date, shipmentDate: data.header.ship_date,
    factoryShipDate: csqFactoryDate(data.header.ship_date), paymentTerms: data.header.payment_terms || '', tradeTerms: data.header.incoterms || '', port: data.header.port || '',
    sourcePrintedAmount: data.summary?.amount, sourcePrintedQuantity: data.summary?.quantity, reviewWarnings: data.warnings || [],
    packingType: data.header.pack_type === 'multiple' ? 'MULTIPLE PACK' : 'NORMAL PACK' });
  order.items.forEach((item, i) => {
    const line = data.lines[i];
    if (!line.style || !Number.isFinite(line.qty) || line.qty < 0 || !Number.isFinite(line.unit_price) || line.unit_price < 0) throw new Error('SK-KPI 品項數量或單價不完整。');
    item.sizes = line.size_order;
    item.vendorPart = line.vendor_part; item.customerItemCodes = line.customer_item_codes;
    item.styleName = line.desc;
    item.description = typeof line.composition==='string'?line.composition:line.desc;
    if(typeof line.composition==='string')item.composition=line.composition;
    item.colors[0].quantitiesBySize = Object.fromEntries(item.sizes.map(size => [size, line.sizes?.[size] || 0]));
    if (line.pack_type === 'multiple' || data.header.pack_type === 'multiple') {
      item.isPrepack = true; item.kitQty = line.pack_qty; item.piecesPerKit = line.pieces_per_pack; item.kitPriceUSD = line.pack_price; item.kitCode = line.kit_code;
      item.colors[0].ratioBySize = line.pack_sizes; item.colors[0].piecesPerPack = line.pieces_per_pack;
    }
  });
  order.orderType = order.packingType === 'MULTIPLE PACK' ? 'prepack_kit' : 'multi_color';
  return normalizeCsqOrder(order);
}
