import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
const root=path.resolve('CSQ參考資料');
function walk(p){return !fs.existsSync(p)?[]:fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);}
const files=walk(root).filter(f=>!path.basename(f).startsWith('~$')).map(f=>({path:path.relative(root,f).replaceAll('\\','/'),name:path.basename(f),module:path.relative(root,f).split(path.sep)[0]}));
const tracking=[],warnings=[],schemas=[];
const text=v=>String(v??'').trim();
const date=v=>typeof v==='number'?new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10):text(v);
function read(file){try{return XLSX.readFile(path.join(root,file.path),{cellNF:true});}catch{warnings.push({file:file.path,reason:'檔案受保護或格式無法讀取，尚未匯入內容'});return null;}}
const progress=files.find(f=>f.path==='訂單追蹤/訂單進度.xlsx');
if(progress){const book=read(progress);if(book){const sheet=book.Sheets[book.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});let header={};
  for(let r=4;r<rows.length;r++){const line=rows[r];if(text(line[0]).startsWith('CS'))header={scNumber:text(line[0]),poNumber:text(line[1]),season:text(line[2]),brand:text(line[4])||text(line[3]),company:text(line[5]),customerDate:date(line[19]),factoryDate:date(line[20])};
    const itemNo=text(line[14]);if(!header.scNumber||!/^([A-Z][A-Z0-9-]*\d[A-Z0-9-]*)$/.test(itemNo)||!(Number(line[15])>0))continue;
    const internalFields={};for(let c=0;c<46;c++){const key=XLSX.utils.encode_col(c);const merge=sheet['!merges']?.find(m=>r>=m.s.r&&r<=m.e.r&&c>=m.s.c&&c<=m.e.c);const cell=sheet[XLSX.utils.encode_cell(merge?merge.s:{r,c})];if(merge&&['H','L','M','N'].includes(key))internalFields['_scope'+key]=XLSX.utils.encode_cell(merge.s);internalFields[key]=cell?.t==='n'&&/yy|dd/i.test(cell.z||cell.w||'')?date(cell.v):text(cell?.v);if([17,18,19,20,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,42,43,44,45].includes(c)&&typeof cell?.v==='number'&&cell.v>30000&&cell.v<70000)internalFields[key]=date(cell.v);}
    const anchorCell=col=>{const c=XLSX.utils.decode_col(col);const m=sheet['!merges']?.find(m=>r>=m.s.r&&r<=m.e.r&&c>=m.s.c&&c<=m.e.c);return sheet[XLSX.utils.encode_cell(m?m.s:{r,c})];};const profitFormula=anchorCell('N')?.f||'',conversionFormula=anchorCell('M')?.f||'';if(/H\d+\s*-\s*L\d+/i.test(profitFormula))internalFields._costCurrency='USD';const rate=conversionFormula.match(/L\d+\s*\/\s*([\d.]+)/i);if(rate&&Number(rate[1])>0){internalFields._costCurrency='RMB';internalFields._rmbPerUsd=rate[1];}if(profitFormula)internalFields._profitFormula=profitFormula;
    const bulk={};for(const [key,col] of [['tp','W'],['labDip','AA'],['fitSample','AB'],['pps','AC'],['shippingSample','AF'],['inspection','AH']]){if(/^\d{4}-\d{2}-\d{2}$/.test(internalFields[col]))bulk[key+'Date']=internalFields[col];}if(header.season==='SS27')bulk.shipmentStatus='PLANNED';
    tracking.push({...header,id:`reference:${progress.path}:${r+1}`,internalFields,bulk,itemNo,quantity:Number(line[15]),unit:text(line[16]),supplier:text(line[9]),status:header.season==='SS27'?'尚未出貨':'參考待核對',tp:date(line[22]),labDip:date(line[26]),fitSample:date(line[27]),pps:date(line[29]),fabricTestDate:'',fabricTestStatus:'待安排',cutting:'',sewing:'',shippingSample:date(line[31]),inspection:date(line[33]),packing:'',remarks:'',source:`${progress.path} / ${book.SheetNames[0]} / 第 ${r+1} 列`});
  }
  schemas.push({module:'訂單追蹤',name:progress.name,fields:['S/C','PO','季別','品牌','下單公司','品號','工廠','數量','客人交期','工廠交期','色卡','FIT SAMPLE','PPS','面料測試','中驗','Final','船樣']});
}}
for(const file of files.filter(f=>f.module==='訂單追蹤'&&f!==progress&&/\.xlsx?$/i.test(f.name))){const book=read(file);if(!book)continue;const s=book.Sheets['CURRENT BULK'];if(s){const rows=XLSX.utils.sheet_to_json(s,{header:1,defval:''});schemas.push({module:'訂單追蹤',name:file.name,fields:(rows[4]||[]).map(text).filter(Boolean)});}}
const selected=files.filter(f=>f.module==='出貨作業'&&(/Order Tracking/.test(f.path)||/01261-(PK|WEIGHT)/.test(f.name))&&/\.xlsx?$/i.test(f.name));
const seen=new Set();for(const file of selected){if(seen.has(file.name))continue;seen.add(file.name);const book=read(file);if(!book)continue;const rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:''});const row=rows.find(r=>r.some(c=>/TOTAL CTNS|CARTON NR|S\/C NO\./.test(text(c))));schemas.push({module:'出貨作業',name:file.name,fields:(row||[]).map(text).filter(Boolean)});}
const existing=fs.existsSync('public/csq-workspace-references.json')?JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')):{};
const snapshot={completedShipmentOrders:existing.completedShipmentOrders||[],version:1,updatedAt:new Date().toISOString(),files,tracking,schemas,warnings};
if(fs.existsSync(root))fs.writeFileSync('public/csq-workspace-references.json',JSON.stringify(snapshot));
console.log(`Workspace references: ${files.length} files, ${tracking.length} progress lines, ${warnings.length} unreadable files.`);

await import('./prepare-bulk-progress.mjs');
