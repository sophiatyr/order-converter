import type {Workspace} from './workspace';
export const syncKinds=['orders','tracking','developments','shipments','productNotes','productMappings','classificationOptions','removedOrders'] as const;
export interface SyncRecord {key:string;kind:string;id:string;before:unknown;after:unknown;conflict:boolean}
const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function planNasSync(local:Workspace,remote:Workspace):SyncRecord[]{
 const records=(w:Workspace)=>syncKinds.flatMap(kind=>{const value=w[kind];return Array.isArray(value)?value.map(v=>({kind,id:kind==='orders'?(v as {poNumber:string}).poNumber:(v as {id:string}).id,value:v})):Object.entries(value||{}).map(([id,v])=>({kind,id,value:v}));});
 const target=new Map(records(remote).map(r=>[JSON.stringify([r.kind,r.id]),r.value]));
 return records(local).flatMap(r=>{const key=JSON.stringify([r.kind,r.id]),before=target.get(key);return stable(before)===stable(r.value)?[]:[{key,kind:r.kind,id:r.id,before:before??null,after:r.value,conflict:before!==undefined}];});
}
export function syncChanges(plan:SyncRecord[],selected:Set<string>){return plan.filter(r=>!r.conflict||selected.has(r.key)).map(({kind,id,before,after})=>({kind,id,before,after}));}
const fieldNames:Record<string,string>={poNumber:'客戶 PO',piNumber:'S/C',items:'款式',id:'編號',itemNo:'款號',styleName:'英文品名',description:'說明',chineseName:'中文品名',chineseSpec:'中文規格',composition:'成分',compositionSource:'成分來源',totalPieces:'總數量',totalQuantity:'數量',totalAmountUSD:'客戶金額 USD',totalAmountRMB:'金額 RMB',unitPriceUSD:'售價 USD',unitPriceRMB:'單價 RMB',colors:'顏色',colorCode:'色碼',colorName:'色名',quantitiesBySize:'尺碼數量',sizes:'尺碼',packingType:'包裝方式',paymentTerms:'付款條件',shipmentDate:'客戶交期',factoryShipDate:'工廠交期',poDate:'下單日期',piDate:'製單日期',requiresAntiCounterfeitLabel:'防偽標',factoryProduct:'採購資料',supplier:'工廠',factorySupplier:'工廠',supplierCode:'工廠代碼',factoryTerms:'工廠條款',factoryTermsSettings:'工廠條款設定',factoryText:'工廠文件說明',unit:'單位',price:'價格',prices:'報價紀錄',currency:'幣別',date:'日期',name:'名稱',spec:'規格',remarks:'備註',sourceFileName:'來源檔案',tradeTerms:'交易條件',port:'港口',brand:'品牌',series:'系列',season:'季別',status:'狀態',bulk:'生產進度',internalFields:'內部作業欄位',tp:'TP',pps:'PPS',labDip:'色卡',fitSample:'Fit Sample',fabricTestDate:'面料測試日期',fabricTestStatus:'面料測試狀態',cutting:'裁剪',sewing:'車縫',packing:'包裝',inspection:'驗貨',shippingSample:'船樣',confirmed:'確認出貨',lines:'出貨明細',invoiceNo:'發票號碼',colorTranslations:'中文色名',createdFromPo:'建立來源 PO',productNotes:'產品備註',customerPrice:'客戶價格',factoryPrice:'工廠價格'};
export function describeSyncDifferences(before:unknown,after:unknown,path=''): {field:string;nas:string;local:string}[]{
 if(stable(before)===stable(after))return [];
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 if(object(before)&&object(after))return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(k=>describeSyncDifferences(before[k],after[k],[path,fieldNames[k]||k].filter(Boolean).join(' / ')));
 if(Array.isArray(before)&&Array.isArray(after))return Array.from({length:Math.max(before.length,after.length)},(_,i)=>describeSyncDifferences(before[i],after[i],`${path} / 第 ${i+1} 筆`)).flat();
 const show=(v:unknown):string=>v===undefined||v===null||v===''?'未填':typeof v==='boolean'?v?'是':'否':Array.isArray(v)?v.map(show).join('、'):object(v)?Object.entries(v).map(([k,x])=>`${fieldNames[k]||k}：${show(x)}`).join('；'):String(v);
 return [{field:path||'內容',nas:show(before),local:show(after)}];
}
