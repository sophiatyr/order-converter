import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createNasServer} from '../server/nasServer.mjs';
import {diffWorkspaces} from '../server/nasDatabase.mjs';
import {loadWorkspace} from '../server/workspace-validation.mjs';

const source=process.argv[2],destination=path.resolve(process.argv[3]||'work/nas-initial-data');
if(!source)throw new Error('請指定本機完整工作站備份');
if(fs.existsSync(path.join(destination,'csq.sqlite')))throw new Error('已有資料庫，停止以免覆蓋');
const workspace=loadWorkspace(fs.readFileSync(source,'utf8'),null);
const password=randomBytes(24).toString('base64url');
const {db}=createNasServer({dataDir:destination,webRoot:'dist',adminUsername:'csqadmin',adminPassword:password});
try{
 const user=db.users().find(u=>u.username==='csqadmin');
 db.apply(diffWorkspaces(db.workspace(),workspace),user);
 db.backup();
 const refs=db.reference('csq-workspace-references.json'),rows=refs.tracking.filter(r=>r.season==='SS27');
 const report={createdAt:new Date().toISOString(),source:path.resolve(source),referenceOrders:new Set(rows.map(r=>r.poNumber)).size,referenceQuantity:rows.reduce((n,r)=>n+r.quantity,0),importedOrders:workspace.orders.length,progressOverrides:Object.keys(workspace.tracking).length,shipments:workspace.shipments.length,productMappings:workspace.productMappings?.length||0};
 if(report.referenceOrders!==93||report.referenceQuantity!==644397)throw new Error('SS27 基準數量核對失敗');
 fs.writeFileSync('work/nas-migration-report.json',JSON.stringify(report,null,2));
 fs.writeFileSync('work/nas-initial.env',`NAS_ADMIN_USER=csqadmin\nNAS_ADMIN_PASSWORD=${password}\n`);
 console.log(JSON.stringify(report));
}finally{db.close();}
