import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {createNasServer} from '../server/nasServer.mjs';
import {diffWorkspaces,NasDatabase} from '../server/nasDatabase.mjs';
import {assertRecordPermission,canEditModule,canEditTrackingField} from '../server/workspacePermissions.mjs';

await build({entryPoints:['src/utils/workspace.ts'],outfile:'work/roles-workspace.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {newShipment}=await import('../work/roles-workspace.mjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'csq-role-test-'));
const {app,db}=createNasServer({dataDir:root,webRoot:root,adminUsername:'testadmin',adminPassword:'Admin-test-only-2026'});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;
const call=async(route,cookie='',body,method=body===undefined?'GET':'POST')=>{const r=await fetch(base+route,{method,headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],data:await r.json()};};
try{
 const admin=(await call('/api/shared/login','',{username:'testadmin',password:'Admin-test-only-2026'})).cookie;
 for(const role of ['shipping','assistant','viewer'])assert.equal((await call('/api/shared/users',admin,{username:role,name:role,role,password:'Roles-test-only-2026'})).status,200);
 const cookies={};for(const role of ['shipping','assistant','viewer'])cookies[role]=(await call('/api/shared/login','',{username:role,password:'Roles-test-only-2026'})).cookie;
 const fixture=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')).orders[0];
 let w=db.workspace(),next=structuredClone(w);next.orders=[fixture];next.tracking.row={bulk:{ppsStatus:'APPROVED',shipmentLc:'LC-1'},internalFields:{AM:'2026-11-01'}};
 assert.equal((await call('/api/shared/workspace',admin,{changes:diffWorkspaces(w,next)},'PATCH')).status,200);
 const patch=async(role,edit)=>{const before=db.workspace(),after=structuredClone(before);edit(after);return call('/api/shared/workspace',cookies[role],{changes:diffWorkspaces(before,after)},'PATCH');};
 assert.equal((await patch('shipping',w=>w.orders[0].brand='FORBIDDEN')).status,403);
 assert.equal((await patch('shipping',w=>w.orders=[])).status,403);
 assert.equal((await patch('shipping',w=>w.tracking.row.bulk.ppsStatus='NOT REQUIRED')).status,403);
 assert.equal((await patch('shipping',w=>w.productNotes.x={brand:'ABC',season:'SS27',remarks:''})).status,403);
 assert.equal((await patch('shipping',w=>w.shipments.push(newShipment(fixture,'ship-1')))).status,200);
 assert.equal((await patch('shipping',w=>{w.tracking.row.bulk.shipmentLc='LC-2';w.tracking.row.bulk.shipmentCartons='5';w.shipments[0].factoryNotice={lcNumber:'LC-2'};})).status,200);
 assert.equal((await patch('assistant',w=>w.orders[0].brand='ABC')).status,200);
 assert.equal((await patch('assistant',w=>w.tracking.row.bulk.ppsStatus='NOT REQUIRED')).status,200);
 assert.equal((await patch('assistant',w=>w.tracking.new={bulk:{ppsStatus:'APPROVED'},internalFields:{AD:'2026-10-30'}})).status,200);
 for(const edit of [w=>w.shipments[0].container='FORBIDDEN',w=>w.shipments=[],w=>w.tracking.row.bulk.shipmentLc='BAD',w=>delete w.tracking.row,w=>w.tracking.row.internalFields.AM='2027-01-01'])assert.equal((await patch('assistant',edit)).status,403);
 const before=db.workspace(),revision=db.revision(),audit=db.db.prepare('SELECT count(*) n FROM audit').get().n;
 // A permitted change and a forbidden change must roll back together.
 assert.equal((await patch('shipping',w=>{w.shipments[0].container='ROLLBACK';w.tracking.row.bulk.ppsStatus='BAD';})).status,403);
 assert.deepEqual(db.workspace(),before);assert.equal(db.revision(),revision);assert.equal(db.db.prepare('SELECT count(*) n FROM audit').get().n,audit);
 // A client cannot forge a stored baseline or re-send an entire object to gain access.
 const forged={...before.tracking.row,bulk:{...before.tracking.row.bulk,ppsStatus:'BAD'}};
 assert.equal((await call('/api/shared/workspace',cookies.shipping,{changes:[{kind:'tracking',id:'row',before:forged,after:forged}]},'PATCH')).status,200);assert.deepEqual(db.workspace(),before,'Forged unchanged baseline cannot overwrite stored values');
 for(const role of ['shipping','assistant','viewer']){
  assert.equal((await call('/api/shared/workspace',cookies[role])).status,200);
  assert.equal((await call('/api/shared/restore',cookies[role],{changes:[]})).status,403);
  assert.equal((await call('/api/shared/users',cookies[role])).status,403);
 }
 assert.equal((await patch('viewer',w=>w.tracking.row.bulk.ppsStatus='BAD')).status,403);
 for(const module of ['orders','tracking','development','products','data'])assert.equal(canEditModule('shipping',module),false);
 assert.equal(canEditModule('shipping','shipping'),true);assert.equal(canEditModule('assistant','shipping'),false);
 assert.equal(canEditTrackingField('assistant','internalFields','AM'),false);assert.equal(canEditTrackingField('shipping','bulk','shipmentLc'),true);
 assert.throws(()=>assertRecordPermission('unknown','shipments',null,{id:'x'}),e=>e.code==='FORBIDDEN');
 const ship=db.users().find(u=>u.role==='shipping');assert.equal((await call('/api/shared/users/'+ship.id,admin,{role:'assistant'},'PATCH')).status,200);
 assert.equal((await call('/api/shared/workspace',cookies.shipping)).status,401,'Role changes revoke old sessions');
 // Legacy members become assistants without changing their password or workspace.
 db.db.prepare("UPDATE users SET role='member' WHERE username='assistant'").run();const retained=db.workspace();
 await new Promise(r=>server.close(r));db.close();const restarted=new NasDatabase(root,w=>w);
 assert.equal(restarted.users().find(u=>u.username==='assistant').role,'assistant');assert.ok(restarted.login('assistant','Roles-test-only-2026'));assert.deepEqual(restarted.workspace(),retained);restarted.close();
 console.log('PASS role permissions: shipping/assistant boundaries, shared tracking fields, forged requests, atomic rollback, admin access, session revocation and legacy migration.');
}finally{if(server.listening)await new Promise(r=>server.close(r));try{db.close();}catch{}fs.rmSync(root,{recursive:true,force:true});}
