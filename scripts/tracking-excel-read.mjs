import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export async function readTrackingExcelNative(root,bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>20*1024*1024)throw Error('Excel 檔案大小不符。');
 const dir=path.join(root,'work/tracking-imports',randomUUID());fs.mkdirSync(dir,{recursive:true});
 const input=path.join(dir,'input.xlsx'),output=path.join(dir,'read.json');fs.writeFileSync(input,bytes);
 try{await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/read-tracking-excel.ps1'),'-InputFile',input,'-OutputFile',output],{windowsHide:true,timeout:120000,maxBuffer:1024*1024});return JSON.parse(fs.readFileSync(output,'utf8').replace(/^\uFEFF/,''));}
 catch{throw Error('Excel 無法讀取此檔案。請確認目前 Windows 帳號的 Excel 可開啟此檔案，並關閉登入提示後重試；原檔未修改。');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
