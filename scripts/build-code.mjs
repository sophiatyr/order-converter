import fs from 'node:fs';
import path from 'node:path';
import {build} from 'vite';
await import('./prepare-offline-assets.mjs');
// Build independently of company reference folders, snapshots and credentials.
const output=path.resolve('work/program-build');
await build({publicDir:false,build:{outDir:output,emptyOutDir:true}});
for(const name of ['vendor','manifest.json','sw.js','icon-192.png','icon-512.png','apple-touch-icon.png']){
 const file=path.join('public',name);
 if(fs.existsSync(file))fs.cpSync(file,path.join(output,name),{recursive:true});
}
await import('./build-nas-server.mjs');
console.log('Program-only build ready: work/program-build (no company snapshots).');
