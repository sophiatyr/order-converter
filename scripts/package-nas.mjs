import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
const root='nas_package/CSQ_NAS_共用工作站';fs.mkdirSync(root,{recursive:true});
for(const [source,target] of [['dist','dist'],['server','server'],['package.json','package.json'],['package-lock.json','package-lock.json'],['deploy/nas/Dockerfile','Dockerfile'],['deploy/nas/compose.yaml','compose.yaml'],['deploy/nas/.env.example','.env.example'],['deploy/nas/.dockerignore','.dockerignore'],['deploy/nas/部署說明.txt','部署說明.txt']])fs.cpSync(source,path.join(root,target),{recursive:true});
const zip=new JSZip();function add(dir,prefix=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name),n=prefix+e.name;if(e.isDirectory())add(p,n+'/');else zip.file(n,fs.readFileSync(p));}}add(root,'CSQ_NAS_共用工作站/');fs.writeFileSync('nas_package/CSQ_NAS_共用工作站.zip',await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));console.log('NAS deployment package prepared.');
