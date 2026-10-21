import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),root='CSQ參考資料/出貨作業';
export const shippingTemplateFiles={
 'cisalfa-single':[`${root}/客人Invoice/PLDOCUMENTS_CS26002273-IN,PK,WEIGHT LIST.xlsx`],
 'cisalfa-multiple':[`${root}/客人Invoice/PLDOCUMENTS_CS25035305-1-IN,PK,WEIGHT LIST.xlsx`],
 'medico-single':[`${root}/客人Invoice/CS038252ME-IN,PK,WEIGHT LIST.xlsx`],
 'premium-single':[`${root}/客人Invoice/CS038252ME-IN,PK,WEIGHT LIST.xlsx`],
 'medico':[`${root}/客人Invoice/CS038216ME-IN,PK,WEIGHT LIST.xlsx`],
 'premium':[`${root}/客人Invoice/CS038216ME-IN,PK,WEIGHT LIST.xlsx`],
 'falis':[`${root}/客人Invoice/CS251428FA-1(25OF037927)-IN.xlsx`,`${root}/客人packing list/CS251428FA-1(25OF037927)-PK.xlsx`,`${root}/客人packing list/CS251428FA-1(25OF037927)-WEIGHT LIST.xlsx`],
 'booking-shanghai':[`${root}/Shipment booking form/10.15-CS26031991(26OF031991)-Shipment Booking Form (SHANGHAI).xlsx`],
 'booking-xiamen':[`${root}/Shipment booking form/08.20-CS26001550(26OF001550)-Shipment Booking Form.xlsx`],
 'ocean-shanghai':[`${root}/Shipment booking form/10.15-SHA Ocean Booking Form-CS26029278,29929,31991.xlsx`],
 'ocean-xiamen':[`${root}/Shipment booking form/08.20-XM Ocean Booking Form-CS25048645,26000006,26001262,26001550.xlsx`],
 'factory-packing':['public/csq-factory-packing-standard.xlsx'],
 'shipment-tracking':[`${root}/Order Tracking/CSQ Shipment Order Tracking Sheet-2026.10.02.xlsx`]
};
export function validateShippingRecipe(p){
 const scalar=v=>v===null||typeof v==='string'&&v.length<=32767||typeof v==='number'&&Number.isFinite(v);
 if(!p||!Object.hasOwn(shippingTemplateFiles,p.template)||!Array.isArray(p.sheets)||!p.sheets.length||p.sheets.length>12)throw Error('出貨原表範本不符。');
 for(const s of p.sheets){
  if(typeof s.name!=='string'||s.name.length>31||!Array.isArray(s.patches)||s.patches.length>20000||s.patches.some(c=>!Array.isArray(c)||c.length!==2||!/^\$?[A-Z]{1,3}\$?[1-9]\d{0,5}$/.test(c[0])||!scalar(c[1])))throw Error('出貨欄位格式不符。');
  if(s.insertColumns&&(!Array.isArray(s.insertColumns)||s.insertColumns.length>2||s.insertColumns.some(c=>!Number.isInteger(c.at)||c.at<7||c.at>40||!Number.isInteger(c.count)||c.count<1||c.count>14)))throw Error('裝箱尺碼欄位不符。');
  if(s.body&&(!Number.isInteger(s.body.start)||s.body.start<1||!Number.isInteger(s.body.end)||s.body.end<s.body.start||!Number.isInteger(s.body.columns)||s.body.columns<1||s.body.columns>100||!Array.isArray(s.body.rows)||s.body.rows.length>3000||s.body.rows.some(r=>!Number.isInteger(r.source)||r.source<s.body.start||r.source>s.body.end||!Array.isArray(r.values)||r.values.length>s.body.columns||!r.values.every(scalar))))throw Error('出貨明細容量或格式不符。');
  if(s.formulas&&(!Array.isArray(s.formulas)||s.formulas.length>30000||s.formulas.some(c=>!Array.isArray(c)||!/^\$?[A-Z]{1,3}\$?[1-9]\d{0,5}$/.test(c[0])||typeof c[1]!=='string'||c[1].length>8000||!/^=[A-Z0-9_!\s\'\"\.,:()+*/%<>=\-$]+$/i.test(c[1])||/\[|\]|https?:|DDE|WEBSERVICE|HYPERLINK|CALL|EXEC|RTD/i.test(c[1]))))throw Error('出貨公式格式不符。');
 }
 return p;
}
export async function exportShippingNative(projectRoot,p){
 validateShippingRecipe(p);const dir=path.join(projectRoot,'work/shipping-native-exports',randomUUID());fs.mkdirSync(dir,{recursive:true});
 const input=path.join(dir,'input.json'),output=path.join(dir,'Shipping.xlsx');fs.writeFileSync(input,JSON.stringify({...p,sources:shippingTemplateFiles[p.template].map(f=>fs.existsSync(path.join(projectRoot,f))?path.join(projectRoot,f):p.template==='factory-packing'?path.join(projectRoot,'offline_package/外貿成衣訂單轉換系統_單機離線完整包/csq-factory-packing-standard.xlsx'):path.join(projectRoot,f))}));
 try{await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(projectRoot,'scripts/export-shipping-native.ps1'),'-InputFile',input,'-OutputFile',output],{windowsHide:true,timeout:900000,maxBuffer:1024*1024});return fs.readFileSync(output);}
 catch(e){fs.writeFileSync(path.join(projectRoot,'work/shipping-native-last-error.txt'),e.stderr||e.message);throw Error('Excel 原表匯出未完成，原檔與作業資料保留。請確認本機 Excel 可開啟範本及出貨資料已核對。');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
