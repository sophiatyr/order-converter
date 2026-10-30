import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export async function exportCustomerBulk(projectRoot,payload,withPreview=false){
 if(!payload||!Array.isArray(payload.rows)||payload.rows.length>995||!Number.isFinite(payload.week)||payload.rows.some(row=>!Array.isArray(row)||row.length!==45||row.some(v=>!(v===null||typeof v==='string'&&v.length<=32767||typeof v==='number'&&Number.isFinite(v)))))throw Error('客戶原表最多 995 筆，請檢查資料與篩選範圍。');
 const dir=path.join(projectRoot,'work/customer-bulk-exports',randomUUID());fs.mkdirSync(dir,{recursive:true});
 const input=path.join(dir,'input.json'),output=path.join(dir,'CSQ_Bulk_Status.xlsx'),previewFile=path.join(dir,'preview.json');
 fs.writeFileSync(input,JSON.stringify(payload));
 try{await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(projectRoot,'scripts/export-customer-bulk.ps1'),'-InputFile',input,'-OutputFile',output,...(withPreview?['-PreviewFile',previewFile]:[])],{windowsHide:true,timeout:120000,maxBuffer:1024*1024});const bytes=fs.readFileSync(output);return withPreview?{bytes:bytes.toString('base64'),preview:JSON.parse(fs.readFileSync(previewFile,'utf8').replace(/^\uFEFF/,''))}:bytes;}
 catch{throw Error('無法透過 Excel 匯出原表。請確認本機 Excel 可正常開啟客戶原檔，並關閉 Excel 彈出的登入或提示視窗後重試。原有資料與保護設定未變更。');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
