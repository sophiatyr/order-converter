import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {NasDatabase} from '../server/nasDatabase.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'csq-erp-reference-')),db=new NasDatabase(dir,w=>w);
try{
 const old={account:'CSQ',updatedAt:'2026-10-07T00:00:00Z',products:[{itemNo:'ADB622S27',chineseSpec:'OLD'}]},next={...old,updatedAt:'2026-10-21T00:00:00Z',products:[{itemNo:'ADB622S27',chineseSpec:'BODY: 80% POLIAMMIDE 20% ELASTANE'}]};
 db.seed('erp-products.json',old);db.db.prepare('INSERT INTO records VALUES(?,?,?)').run('orders','26OF048122',JSON.stringify({poNumber:'26OF048122',factoryProduct:{price:14.8,supplierCode:'YLS'},compositionSource:'manual'}));
 const before=db.db.prepare('SELECT * FROM records').all(),revision=db.revision();
 const result=db.seed('erp-products.json',next,{refreshNewer:true});assert(result.updated);assert(fs.existsSync(result.backup));assert.deepEqual(db.reference('erp-products.json'),next);assert.deepEqual(db.db.prepare('SELECT * FROM records').all(),before);assert.equal(db.revision(),revision);
 assert.equal(db.seed('erp-products.json',old,{refreshNewer:true}).updated,false);assert.equal(db.seed('erp-products.json',next,{refreshNewer:true}).updated,false);
 assert.throws(()=>db.seed('erp-products.json',{...next,updatedAt:'2026-10-22T00:00:00Z',products:[]},{refreshNewer:true}));assert.deepEqual(db.reference('erp-products.json'),next);
 db.seed('csq-workspace-references.json',{updatedAt:old.updatedAt,tracking:[{quantity:5}]});db.seed('csq-workspace-references.json',{updatedAt:next.updatedAt,tracking:[]},{refreshNewer:true});assert.equal(db.reference('csq-workspace-references.json').tracking[0].quantity,5);
 assert.equal(db.db.prepare("SELECT COUNT(*) n FROM audit WHERE kind='references'").get().n,1);
 console.log('PASS NAS ERP refresh: newer snapshot backed up and audited; orders, factory prices, manual edits and other references untouched; older/invalid snapshots rejected.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
