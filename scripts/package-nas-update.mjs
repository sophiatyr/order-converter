import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';

const buildRoot='work/program-build';
if(!fs.existsSync(path.join(buildRoot,'index.html')))throw new Error('請先執行 npm run build:code');
const zip=new JSZip(),files=[];
function file(source,target){const bytes=fs.readFileSync(source);zip.file(target,bytes);files.push({path:target,sha256:createHash('sha256').update(bytes).digest('hex')});}
function tree(source,target){if(!fs.existsSync(source))return;for(const entry of fs.readdirSync(source,{withFileTypes:true})){const p=path.join(source,entry.name),out=target+'/'+entry.name;if(entry.isDirectory())tree(p,out);else if(entry.isFile())file(p,out);}}
// Only program files. No data/, .env, compose changes, company snapshots or templates.
file(path.join(buildRoot,'index.html'),'dist/index.html');
const release=JSON.parse(fs.readFileSync(path.join(buildRoot,'release.json'),'utf8'));
if(!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release.version))throw Error('缺少有效版號');
file(path.join(buildRoot,'release.json'),'dist/release.json');
for(const name of ['assets','vendor','branding'])tree(path.join(buildRoot,name),'dist/'+name);
for(const name of ['csq-factory-packing-standard.xlsx','manifest.json','sw.js','icon-192.png','icon-512.png','apple-touch-icon.png'])if(fs.existsSync(path.join(buildRoot,name)))file(path.join(buildRoot,name),'dist/'+name);
for(const name of ['nasServer.mjs','nasDatabase.mjs','workspace-validation.mjs'])file('server/'+name,'server/'+name);
for(const name of ['package.json','package-lock.json'])file(name,name);
file('deploy/nas/Dockerfile','Dockerfile');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
zip.file('更新說明.txt',`CSQ NAS 程式更新 ${date}

適用既有 CSQ NAS / Container Manager 專案。這是程式更新包，不是全新安裝包。
更新前請確認沒有同事正在編輯，並在 NAS「系統管理」下載資料庫備份。

1. 記下目前 Container Manager 的 CSQ 專案目錄；先另存一份原程式作回復用。
2. 將本更新包解壓縮到既有專案目錄，合併資料夾、覆蓋同名檔案。
   不能先刪除原目錄或 dist，否則原有公司參考資料會遺失。
   不可更動 data/、.env、compose.yaml 或現有掛載設定。
3. 在 Container Manager 對既有 CSQ 專案執行重新建置並重新建立服務。
   只重新啟動容器不會更新映像檔中的伺服器程式。
   若由管理員使用終端機，於既有專案目錄執行：
   docker compose build csq
   docker compose up -d --no-deps csq
4. 確認服務健康後，開啟 NAS 網址並強制重新整理（Ctrl+F5）。
   檢查登入、訂單筆數、近期匯入 PO、出貨紀錄，再測試匯出。

本包不含訂單資料、帳號密碼、ERP/追蹤快照、原始 PO 或正式公司範本。
既有資料庫繼續使用 NAS 原本的 data/；資料同步和程式升級分開操作。
若要更新參考/ERP 快照，需另行處理，單純更新本包不會刷新資料庫快照。
升級失敗時還原先前程式並重新建置；保留目前 data/，不要直接以舊資料庫覆蓋。
`);
zip.file('程式版本.json',JSON.stringify({...release,files},null,2));
const forbidden=Object.keys(zip.files).filter(n=>n!=='dist/csq-factory-packing-standard.xlsx'&&/(^|\/)(data|\.env)(\/|$)|\.sqlite|csq-.*\.json$|erp-products\.json$|\.pdf$|\.xlsx?$/i.test(n));
if(forbidden.length)throw new Error('更新包包含非程式檔案：'+forbidden.join(','));
fs.mkdirSync('releases',{recursive:true});const output=`releases/CSQ_NAS_程式更新_${release.version}.zip`;
fs.writeFileSync(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
console.log(JSON.stringify({output,files:files.length,bytes:fs.statSync(output).size,sha256:createHash('sha256').update(fs.readFileSync(output)).digest('hex')}));
