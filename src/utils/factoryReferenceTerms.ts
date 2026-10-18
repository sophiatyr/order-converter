import type {OrderData} from '../types/order';
import type {DocumentTemplate,DocumentTemplates} from './referenceDocuments';
import {traditional} from './documentFormatting';
const text=(v:unknown)=>typeof v==='string'?v:'';
export function referenceFactoryTerms(t:DocumentTemplate){
 const cells=t.sheet.cells;
 const field=(pattern:RegExp,multiline=false)=>{
  const label=cells.find(c=>c.c===1&&pattern.test(text(c.v).replace(/\s/g,'')));if(!label)return '';
  const stop=multiline?Math.min(...cells.filter(c=>c.c===1&&c.r>label.r&&text(c.v).trim()).map(c=>c.r),label.r+5):label.r+1;
  return traditional(cells.filter(c=>c.c===2&&c.r>=label.r&&c.r<stop).sort((a,b)=>a.r-b.r).map(c=>text(c.v).trim()).filter(Boolean).join('\n'));
 };
 let payment=field(/^付款方式[:：]/,true);
 const percent=payment.match(/(\d+(?:\.\d+)?)%\s*訂金|訂金\s*(\d+(?:\.\d+)?)%/);
 const depositPercent=Number(percent?.[1]||percent?.[2]||0);
 // Keep the agreement's timing and documents, but never copy an old order's deposit amount.
 if(percent){payment=payment.replace(/\((?:USD|US\$|RMB|CNY|NT\$|\$)\s*[\d,. ]+\s*\)/gi,'（［訂金金額］）');payment=payment.replace(/(?:USD|US\$|RMB|CNY|NT\$|\$)\s*[\d,.]+/gi,'［訂金金額］');payment=payment.replace(percent[0],percent[1]?'［訂金比例］%訂金':'訂金［訂金比例］%');}
 return {payment,trade:field(/^交易條件[:：]/),place:field(/^交貨地點[:：]/),hasDeposit:!!percent,depositPercent};
}
export function factoryTermsReference(data:DocumentTemplates,o:OrderData){
 const candidates=data.templates.filter(t=>t.kind==='factory'&&t.factoryCodes.includes(o.supplierCode));
 const date=(t:DocumentTemplate)=>{
  const value=t.sheet.cells.map(c=>text(c.v)).find(v=>/採購日期/.test(v.replace(/\s/g,'')))||'';
  const d=value.match(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})/);
  return d?`${d[1]}${d[2].padStart(2,'0')}${d[3].padStart(2,'0')}`:'';
 };
 const sorted=[...candidates].sort((a,b)=>Number(b.scNumbers.includes(o.piNumber)||b.poNumbers.includes(o.poNumber))-Number(a.scNumbers.includes(o.piNumber)||a.poNumbers.includes(o.poNumber))||date(b).localeCompare(date(a))||a.file.localeCompare(b.file));
 const source=sorted.find(t=>t.file===o.factoryTermsSettings?.reference)||sorted[0];
 return {source,candidates:sorted,terms:source?referenceFactoryTerms(source):undefined};
}
export function withFactoryReferenceTerms(data:DocumentTemplates,o:OrderData){
 const {source,terms}=factoryTermsReference(data,o),settings=o.factoryTermsSettings;
 if(!terms&&!settings)return o;
 const hasDeposit=o.hasDeposit??terms?.hasDeposit??false,percent=o.depositPercent??terms?.depositPercent??0;
 const amount=o.items.reduce((n,i)=>n+i.totalQuantity*(o.factoryCurrency==='USD'?i.factoryUnitPriceUSD||0:i.unitPriceRMB),0)+(o.factoryExtraFees||[]).reduce((n,f)=>n+f.amount,0);
 let payment=settings?.payment??(terms?.payment||o.factoryTerms);
 if(!hasDeposit&&terms?.hasDeposit&&settings?.payment===undefined)payment=payment.split('\n').filter(line=>!line.includes('［訂金比例］')).join('\n').replace(/^2[.、]\s*/,'').replace(/餘款|餘下貨款/g,'貨款');
 if(hasDeposit&&!terms?.hasDeposit&&settings?.payment===undefined)payment=`1. 下單後支付［訂金比例］%訂金(［訂金金額］).\n2. ${payment.replace(/貨款/g,'餘款')}`;
 payment=payment.replaceAll('［訂金比例］',String(percent)).replaceAll('［訂金金額］',`${o.factoryCurrency||'RMB'} ${(Math.round(amount*percent)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
 return {...o,hasDeposit,depositPercent:percent,factoryTerms:payment,factoryTradeTerms:settings?.trade??(terms?.trade||o.factoryTradeTerms),deliveryPlace:settings?.place??(terms?.place||o.deliveryPlace),factoryTermsSettings:{...settings,reference:source?.file}};
}
