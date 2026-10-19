import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {createNasSyncRelay} from '../scripts/nas-sync-relay.mjs';
import {createNasServer} from '../server/nasServer.mjs';

await build({entryPoints:['src/utils/nasSync.ts'],outfile:'work/nas-sync-plan.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {planNasSync,syncChanges}=await import('../work/nas-sync-plan.mjs');
const empty=()=>({version:1,orders:[],tracking:{},developments:[],shipments:[],productNotes:{}});
const local={...empty(),orders:[{poNumber:'NEW'},{poNumber:'BOTH',items:['local']}],tracking:{same:{tp:'2026-10-19',pps:'2026-10-20'},changed:{tp:'local'}}};
const remote={...empty(),orders:[{poNumber:'NAS-ONLY'},{poNumber:'BOTH',items:['nas']}],tracking:{same:{pps:'2026-10-20',tp:'2026-10-19'},changed:{tp:'nas'}}};
const plan=planNasSync(local,remote),selected=new Set(plan.filter(p=>p.conflict).map(p=>p.key));
assert.equal(plan.length,3);assert.equal(plan.filter(p=>p.conflict).length,2);
assert.deepEqual(syncChanges(plan,new Set()).map(c=>c.id),['NEW']);
assert.equal(syncChanges(plan,selected).length,3);assert.ok(!plan.some(p=>p.id==='NAS-ONLY'));
assert.equal(planNasSync(local,structuredClone(local)).length,0);

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'csq-sync-'));
const {app,db}=createNasServer({dataDir:dir,webRoot:dir,adminUsername:'syncadmin',adminPassword:'Sync-test-only-2026'});
const nas=app.listen(0,'127.0.0.1');await new Promise(r=>nas.once('listening',r));
const relay=http.createServer(createNasSyncRelay({target:`http://127.0.0.1:${nas.address().port}`}));relay.listen(0,'127.0.0.1');await new Promise(r=>relay.once('listening',r));
const url=`http://127.0.0.1:${relay.address().port}`,request=async(route,body,cookie='',headers={})=>{const r=await fetch(url+'/api/nas-sync'+route,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {r,data:await r.json()};};
try{
 assert.equal((await request('/workspace')).r.status,401);
 assert.equal((await request('/login',{username:'syncadmin',password:'bad'})).r.status,401);
 assert.equal((await request('/login',{},'',{Origin:'http://untrusted.example'})).r.status,403);
 assert.equal((await request('/login',{},'',{'Content-Type':'text/plain'})).r.status,415);
 const login=await request('/login',{username:'syncadmin',password:'Sync-test-only-2026'}),cookie=login.r.headers.get('set-cookie').split(';')[0];
 assert.equal(login.r.status,200);assert.ok(login.r.headers.get('set-cookie').includes('HttpOnly'));assert.ok(!JSON.stringify(login.data).includes('token'));
 assert.equal((await request('/status',undefined,cookie)).data.connected,true);
 const c={kind:'tracking',id:'sync-test',before:null,after:{tp:'2026-10-19'}};
 assert.equal((await request('/apply',{changes:[c]},cookie)).r.status,200);
 assert.equal(db.workspace().tracking['sync-test'].tp,'2026-10-19');
 const backups=fs.readdirSync(path.join(dir,'backups'));assert.equal(backups.length,1);
 // A stale reviewed value must not overwrite a colleague's subsequent edit.
 db.apply([{kind:'tracking',id:c.id,before:c.after,after:{tp:'2026-10-20'}}],db.users()[0]);
 const conflict=await request('/apply',{changes:[{...c,before:c.after,after:{tp:'2026-10-21'}}]},cookie);
 assert.equal(conflict.r.status,409);assert.equal(db.workspace().tracking[c.id].tp,'2026-10-20');
 assert.equal((await request('/apply',{changes:[{...c,after:null}]},cookie)).r.status,400);
 db.addUser({username:'syncmember',name:'Member',role:'member',password:'Member-test-only-2026'});
 assert.equal((await request('/login',{username:'syncmember',password:'Member-test-only-2026'})).r.status,403);
 const prior=db.revision(),backup=db.backup.bind(db);db.backup=()=>{throw new Error('test disk failure');};
 assert.equal((await request('/apply',{changes:[{...c,id:'blocked'}]},cookie)).r.status,500);assert.equal(db.revision(),prior);db.backup=backup;
 assert.equal((await request('/logout',{},cookie)).r.status,200);assert.equal((await request('/workspace',undefined,cookie)).r.status,401);
 console.log('PASS NAS sync: defaults preserve existing NAS records; explicit conflicts, no deletions, admin login, CSRF, backup-before-write, failed backup protection and concurrent edit rejection.');
}finally{await new Promise(r=>relay.close(r));await new Promise(r=>nas.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true});}
