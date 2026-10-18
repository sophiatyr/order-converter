import fs from 'node:fs';
import path from 'node:path';
import {createNasServer} from '../server/nasServer.mjs';
export function createLocalSystem(root=path.resolve(import.meta.dirname,'..')){
 const webRoot=path.join(root,'work/shared-preview-web');
 fs.mkdirSync(webRoot,{recursive:true});
 // No private snapshots are copied into this account-testing database.
 return createNasServer({webRoot,dataDir:path.join(root,'work/shared-preview-data'),adminUsername:'previewadmin',adminPassword:'Local-preview-only-2026',preview:true,cookieName:'csq_local_preview',cookiePath:'/api/local-system'});
}
