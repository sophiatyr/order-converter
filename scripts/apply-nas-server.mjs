import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {versionedCompose} from './nas-image-version.mjs';
const root='\\\\192.168.1.6\\docker\\Cisalfa';
const release=JSON.parse(fs.readFileSync('work/program-build/release.json','utf8'));
if(!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release.version))throw Error('無效版號');
const stage=path.join(root,'program-updates',release.version);
if(JSON.parse(fs.readFileSync(path.join(stage,'release.json'),'utf8')).version!==release.version)throw Error('NAS 更新包版號不符');
const names=['server/nasServer.mjs','server/nasDatabase.mjs','server/workspace-validation.mjs','package.json','package-lock.json','Dockerfile'];
const compose=fs.readFileSync(path.join(root,'compose.yaml'),'utf8'),nextCompose=versionedCompose(compose,release.version);
const backup=path.join(root,'program-backups',`${release.version}-${Date.now()}`);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Back up the entire allowlist before replacing anything. Never read or overwrite the live database.
for(const name of [...names,'compose.yaml']){const from=path.join(root,name);if(!fs.existsSync(from))throw Error('原程式檔案不完整：'+name);fs.mkdirSync(path.dirname(path.join(backup,name)),{recursive:true});fs.copyFileSync(from,path.join(backup,name));}
try{
 for(const name of names){const bytes=fs.readFileSync(path.join(stage,name));fs.writeFileSync(path.join(root,name),bytes);if(hash(fs.readFileSync(path.join(root,name)))!==hash(bytes))throw Error('套用核對失敗：'+name);}
 fs.writeFileSync(path.join(root,'compose.yaml'),nextCompose);
 if(fs.readFileSync(path.join(root,'compose.yaml'),'utf8')!==nextCompose)throw Error('映像檔版號核對失敗');
 fs.writeFileSync(path.join(backup,'report.json'),JSON.stringify({...release,sourceApplied:true,rebuildRequired:true,databaseUntouched:true},null,2));
 console.log(JSON.stringify({...release,backup,sourceApplied:true,rebuildRequired:true,databaseUntouched:true},null,2));
}catch(error){for(const name of [...names,'compose.yaml'])fs.copyFileSync(path.join(backup,name),path.join(root,name));throw error;}
