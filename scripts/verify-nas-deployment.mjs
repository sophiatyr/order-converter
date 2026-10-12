import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadWorkspace,trackingRows} from '../server/workspace-validation.mjs';
import {diffWorkspaces} from '../server/nasDatabase.mjs';
const base=process.argv[2]||'http://192.168.1.6:8888';
const env=Object.fromEntries(fs.readFileSync('work/nas-initial.env','utf8').trim().split(/\r?\n/).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
const login=await fetch(base+'/api/shared/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:env.NAS_ADMIN_USER,password:env.NAS_ADMIN_PASSWORD})});
assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie').split(';')[0];
const get=async p=>{const r=await fetch(base+p,{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();};
try{
 const {workspace,revision}=await get('/api/shared/workspace'),refs=await get('/csq-workspace-references.json'),erp=await get('/erp-products.json');
 const expected=loadWorkspace(fs.readFileSync('work/NAS移轉前完整工作站備份.json','utf8'),null);
 assert.equal(diffWorkspaces(expected,workspace).length,0,'本機作業資料與 NAS 必須一致');
 const rows=trackingRows(workspace,refs,erp).filter(r=>r.season==='SS27');
 const report={verifiedAt:new Date().toISOString(),url:base,revision,orders:new Set(rows.map(r=>r.poNumber)).size,quantity:rows.reduce((n,r)=>n+r.quantity,0),styles:rows.length,localDataMatches:true,unauthenticatedStatus:(await fetch(base+'/api/shared/workspace')).status};
 assert.equal(report.orders,93);assert.equal(report.quantity,644397);assert.equal(report.unauthenticatedStatus,401);
 const response=await fetch(base+'/api/shared/backup',{method:'POST',headers:{Cookie:cookie}});assert.equal(response.status,200);const backup=Buffer.from(await response.arrayBuffer());assert.equal(backup.subarray(0,15).toString(),'SQLite format 3');fs.writeFileSync('work/NAS部署後資料庫備份.sqlite',backup);
 fs.writeFileSync('work/nas-live-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await fetch(base+'/api/shared/logout',{method:'POST',headers:{Cookie:cookie}});}
