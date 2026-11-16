import type {Shipment} from './workspace';
export const lcDocumentFields=[['20','信用狀號碼'],['50','申請人／Consignee'],['59','受益人／Shipper 地址'],['45A','貨品說明／產地證敘述'],['46A','文件需求（擷取 NOTIFY TO）'],['47A','附加條款（擷取 FORWARDING AGENT）']] as const;
export type LcSwiftFields=Record<string,string>;
const labels=/^(?:DOCUMENTARY CREDIT NUMBER|APPLICANT|BENEFICIARY|DESCRIPTION OF GOODS AND\/OR SERVICES|DOCUMENTS REQUIRED|ADDITIONAL CONDITIONS|DATE OF ISSUE)\s*$/i;
export function parseLcSwift(text:string){
 const fields:LcSwiftFields={};let tag='',lines:string[]=[];const flush=()=>{if(!tag)return;const value=lines.filter((s,i)=>i!==0||!labels.test(s.trim())).join('\n').trim();if(fields[tag]&&fields[tag]!==value)throw Error('檔案含有重複且不同的 :'+tag+' 欄位，請分開讀取每張信用狀。');fields[tag]=value;};
 const cleaned=text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(s=>!/^\d+\s*\/\s*\d+(?:\s+\d+\s*\/\s*\d+)*$/.test(s)).join('\n');
 for(const line of cleaned.split('\n')){const m=line.match(/^\s*:?(\d{2}[A-Z]?)\s*:\s*(.*)$/i);if(m){flush();tag=m[1].toUpperCase();lines=[m[2]];}else if(tag)lines.push(line);}flush();
 if(!fields['20']?.trim())throw Error('找不到 :20 信用狀號碼，請核對辨識文字或貼上含欄位代碼的信用狀內容。');
 const number=fields['20'].trim();if(/[\r\n]/.test(number))throw Error(':20 含多行內容，請在辨識文字中修正信用狀號碼。');
 const rawDate=fields['31C']?.trim(),date=rawDate&&/^\d{6}$/.test(rawDate)?'20'+rawDate.slice(0,2)+'-'+rawDate.slice(2,4)+'-'+rawDate.slice(4,6):rawDate&&/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?rawDate:'';
 return {fields,number,date,bank:fields['52A']||fields['52D']||cleaned.split('\n').slice(0,cleaned.split('\n').findIndex(l=>/^:27:/.test(l))).filter(l=>/^(?=.*\b(?:BANK|BANCA)\b)[A-Z0-9 .,&'()-]+$/i.test(l)&&!/THROUGH|ISSUING|BENEFICIARY|DOCUMENTS|CHARGES/i.test(l)).at(-1)||'',coveredPos:lcCoveredOrders(fields),missing:lcDocumentFields.filter(([key])=>!fields[key]).map(([key])=>':'+key)};
}
export function storedLcFields(s:Shipment):LcSwiftFields{try{const p=JSON.parse(s.factoryNotice?.lcSwiftFields||'{}');return p&&typeof p==='object'&&!Array.isArray(p)?Object.fromEntries(lcDocumentFields.flatMap(([k])=>typeof p[k]==='string'?[[k,p[k]]]:[])):{};}catch{return {};}}
export const toOrderOf=(value:string)=>/^TO THE ORDER OF\b/i.test(value.trim())?value.trim():'TO THE ORDER OF '+value.trim();
const mapped=(p:LcSwiftFields)=>Object.fromEntries([['shipperAddress',p['59']],['consignee',p['50']?toOrderOf(p['50']):''],['notify',lcNotify(p)],['forwarder',lcForwarder(p)],['originDescription',p['45A']]].filter(([,v])=>v).map(([k,v])=>[k,v!]));
export function clearLcDocument(s:Shipment):Shipment{const f={...s.factoryNotice},prior=mapped(storedLcFields(s));for(const [key,value]of Object.entries(prior))if(f[key]===value)delete f[key];delete f.lcSwiftFields;return {...s,factoryNotice:f};}
export function applyLcDocument(s:Shipment,fields:LcSwiftFields):Shipment{for(const [k,v]of Object.entries(fields))if(!/^\d{2}[A-Z]?$/.test(k)||typeof v!=='string'||v.length>32767)throw Error('信用狀欄位格式不符。');const cleaned=clearLcDocument(s);return {...cleaned,factoryNotice:{...cleaned.factoryNotice,...mapped(fields),lcSwiftFields:JSON.stringify(fields),customerDocumentsExported:''}};}
export function automaticShippingMarks(s:Shipment){return [s.customer.trim(),'ORDER NUMBER: '+s.poNumber,'ITEM NAME:','CUSTOMER STYLE:','COLOUR:','SIZE:',"Q'TY:",'NWT:      KGS','GWT:      KGS','MEASUREMENT:','MADE IN CHINA'].join('\n');}
export function shippingMarks(s:Shipment){const f=s.factoryNotice||{};return f.shippingMarks&&(!f.shippingMarksCustomer||f.shippingMarksCustomer===s.customer)?f.shippingMarks:automaticShippingMarks(s);}
export function knownHsCode(s:Shipment,sku:string,all:Shipment[]=[]){const explicit=s.factoryNotice?.['hsCode:'+sku];if(explicit!==undefined)return explicit;const values=[...new Set(all.filter(x=>!x.factoryNotice?.batchDeletedAt).map(x=>x.factoryNotice?.['hsCode:'+sku]).filter((v):v is string=>!!v))];return values.length===1?values[0]:'';}
export function factoryRecipient(code:string,current:Shipment[],all:Shipment[]=[]){const key='recipient:'+code;return current.map(s=>s.factoryNotice?.[key]).find(v=>v!==undefined)??[...all].sort((a,b)=>Number(b.factoryNotice?.['recipientUpdatedAt:'+code]||0)-Number(a.factoryNotice?.['recipientUpdatedAt:'+code]||0)).map(s=>s.factoryNotice?.[key]).find(Boolean)??'';}

export function lcNotify(p:LcSwiftFields){const raw=p['46A']||'',m=raw.match(/NOTIFY(?:\s+TO)?\s*:\s*([\s\S]*?)(?=\n(?:HBL|B\/L|BILL OF LADING)\b|\n\s*\.\s*(?:\n|$)|$)/i);return m?m[1].trim():/COMMERCIAL INVOICE|FULL SET|BENEFICIARY'S DECLARATION/i.test(raw)?'':raw.trim();}
export function lcForwarder(p:LcSwiftFields){const raw=p['47A']||'',m=raw.match(/FORWARDING AGENT\s*:\s*([\s\S]*?)(?=\n\s*\.\s*(?:\n|$)|$)/i);return m?m[1].trim():/DOCUMENTS MUST|DISCREPANCY|PENAL(?:TIES|ITIES)|NO DRAFT/i.test(raw)?'':raw.trim();}
export function lcCoveredOrders(p:LcSwiftFields){return [...new Set([...((p['45A']||'').matchAll(/\bORDER\s+(?:N\.?|NO\.?|NUMBER)\s*[:.]?\s*([A-Z0-9/-]+)/gi))].map(m=>m[1].toUpperCase()))];}
