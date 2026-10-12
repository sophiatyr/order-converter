import {execFileSync} from 'node:child_process';
if(process.platform==='win32')try{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File','scripts/read-bulk-progress.ps1'],{stdio:'pipe',windowsHide:true,timeout:60000});}catch{console.warn('Original customer Bulk Status could not be refreshed; retaining the previously verified progress snapshot.');}
await import('./prepare-csq-references.mjs');
await import('./prepare-workspace-references.mjs');
import './prepare-document-templates.mjs';
import './prepare-shipment-template.mjs';
import './prepare-shipping-documents.mjs';
import './prepare-factory-notice.mjs';
await import('./prepare-tracking-po.mjs');
import { cpSync, existsSync } from 'node:fs';
for(const filename of ['csq-reference-products.json','csq-workspace-references.json','csq-bulk-progress.json','csq-document-templates.json','csq-shipment-template.json','csq-shipping-documents.json','csq-factory-notice.docx','csq-factory-notice.json']) {
 const source=`public/${filename}`;
 for (const folder of ['dist', 'offline_package/外貿成衣訂單轉換系統_單機離線完整包']) {
  if (existsSync(folder) && existsSync(source)) cpSync(source, `${folder}/${filename}`);
 }
}
console.log('Reference compositions updated. Click 重新讀取參考成份 in the workstation.');
