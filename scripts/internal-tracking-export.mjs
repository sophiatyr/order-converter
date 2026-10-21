import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile);
export function validateInternalPayload(payload){
 const scalar=v=>v===null||typeof v==='string'&&v.length<=32767||typeof v==='number'&&Number.isFinite(v);
 if(!payload||!Array.isArray(payload.rows)||!payload.rows.length||payload.rows.length>3000)throw Error('請選擇 1 至 3000 筆內部追蹤明細。');
 const ids=new Set();
 for(const r of payload.rows){
  if(['id','sc','po','style','factory','currency'].some(k=>typeof r[k]!=='string'||r[k].length>1000)||!r.id||!r.sc||!r.po||!r.style||ids.has(r.id)||!Array.isArray(r.aliases)||!r.aliases.length||r.aliases.some(a=>typeof a!=='string'||a.length>1000)||!Array.isArray(r.values)||r.values.length!==46||!r.values.every(scalar)||!r.scopes||['H','L','M','N'].some(k=>typeof r.scopes[k]!=='string'||r.scopes[k].length>2000)||r.rate!==null&&(!Number.isFinite(r.rate)||r.rate<=0))throw Error('內部原表資料或欄位格式不符。');
  ids.add(r.id);
 }
 return payload;
}
export async function exportInternalTracking(projectRoot,payload){
 validateInternalPayload(payload);
 const dir=path.join(projectRoot,'work/internal-tracking-exports',randomUUID());fs.mkdirSync(dir,{recursive:true});
 const input=path.join(dir,'input.json'),output=path.join(dir,'Order_Progress.xlsx');fs.writeFileSync(input,JSON.stringify(payload));
 try{await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(projectRoot,'scripts/export-internal-tracking.ps1'),'-InputFile',input,'-OutputFile',output],{windowsHide:true,timeout:900000,maxBuffer:1024*1024});return fs.readFileSync(output);}
 catch{throw Error('無法透過 Excel 匯出「訂單進度」原表。請確認本機 Excel 能正常開啟原檔；原表與作業資料沒有變更。');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
