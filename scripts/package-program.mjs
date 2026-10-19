import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
const buildRoot='work/program-build';
if(!fs.existsSync(path.join(buildRoot,'index.html')))throw new Error('請先執行 npm run build:code');
const zip=new JSZip(),prefix='CSQ_程式包/';
function add(dir,target){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())add(file,target+e.name+'/');else zip.file(target+e.name,fs.readFileSync(file));}}
add(buildRoot,prefix+'offline_package/外貿成衣訂單轉換系統_單機離線完整包/');
for(const name of ['local-server.mjs','nas-sync-relay.mjs','customer-bulk-export.mjs','export-customer-bulk.ps1','start-local.ps1','stop-local.ps1'])zip.file(prefix+'scripts/'+name,fs.readFileSync('scripts/'+name));
for(const name of ['啟動訂單系統.bat','停止訂單系統.bat'])zip.file(prefix+name,fs.readFileSync(name));
zip.file(prefix+'使用說明.txt','CSQ 工作站程式包\n\n需要先安裝 Node.js 24 或以上。\n解壓縮後雙擊「啟動訂單系統.bat」，使用 http://localhost:8888。\n這份程式包不含公司的 PO、ERP 價格、追蹤資料、正式文件範本或登入密碼。\n既有作業資料請在原工作站下載完整備份，再由使用者於新工作站匯入。\n正式參考資料與範本需由公司內部另外提供。\nNAS 版部署請使用原始碼內 deploy/nas 的設定，保留正式 data 資料夾。\n');
fs.mkdirSync('releases',{recursive:true});
const releaseDate=process.env.CSQ_RELEASE_DATE||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate))throw new Error('更新包日期須為 YYYY-MM-DD');
const release=JSON.parse(fs.readFileSync(path.join(buildRoot,'release.json'),'utf8'));
const file=`releases/CSQ_程式包_${release.version}.zip`;
fs.writeFileSync(file,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
console.log('Program package prepared: '+file);
