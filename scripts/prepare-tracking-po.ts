import fs from 'node:fs';
import path from 'node:path';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {layoutToRows} from '../src/utils/documentLayout';
import {parseGridToOrder} from '../src/utils/localPoParser';
import {parseCsqCompanyPdf} from '../src/utils/csqCompanyPdf';
import {normalizeCsqOrder} from '../src/utils/csqAccount';
import {normalizeClassification} from '../src/utils/classification';
import {normalizeTrackingFactories} from '../src/utils/factoryDirectory';
import {pricingCode} from '../src/utils/sizeVariants';
import {verifiedTrackingStyle,verifiedPoTotals} from '../src/utils/verifiedTrackingStyles';
const snapshotPath='public/csq-workspace-references.json';
const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
snapshot.tracking=snapshot.tracking.map((r:any)=>{const cleaned=normalizeClassification({...r,brand:r.internalFields?.D||r.brand,series:r.series||r.internalFields?.E||r.brand});return {...cleaned,internalFields:{...r.internalFields,E:cleaned.series}};});
if(fs.existsSync('public/erp-products.json'))snapshot.tracking=normalizeTrackingFactories(snapshot.tracking,JSON.parse(fs.readFileSync('public/erp-products.json','utf8')));
const orders=new Map(),issues:any[]=[],seen=new Set();
const files=snapshot.files.filter((f:any)=>f.path.includes('訂單資料-數量明細表')&&!/給工廠|工廠採購|意见|意見/.test(f.path)&&/\.pdf$/i.test(f.name)&&/26OF|25OF|PO#MFEL|SPORTS KITE - #|^37\d+_tennis/i.test(f.name)&&!/^\(X\)/i.test(f.name));
for(const f of files){
 if(seen.has(f.name))continue;seen.add(f.name);
 let pdf:any;
 try{
  pdf=await getDocument({data:new Uint8Array(fs.readFileSync(path.join('CSQ參考資料',f.path))),isEvalSupported:false,verbosity:0}).promise;
  const pages:any[]=[],rows:string[][]=[],layoutContext={};
  for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent();const words=content.items.filter((i:any)=>'str'in i).map((i:any)=>({text:i.str,x:i.transform[4],y:-i.transform[5],width:i.width,height:Math.max(i.height,8)}));pages.push(words);rows.push([],...layoutToRows(words,layoutContext));}
  const parsed=parseCsqCompanyPdf(pages,f.name)||parseGridToOrder(rows,f.name);
  if(!parsed.success||!parsed.order){issues.push({file:f.path,reason:parsed.error||'未辨識 PO'});continue;}
  const order=normalizeCsqOrder(parsed.order),refs=snapshot.tracking.filter((r:any)=>r.poNumber===order.poNumber);
  if(!refs.length)continue;
  const actual=new Map<string,number>();for(const i of order.items)actual.set(pricingCode(i),(actual.get(pricingCode(i))||0)+i.colors.reduce((n,c)=>n+c.totalQuantity,0));
  // Only the specifically audited original POs may replace the old spreadsheet figures.
  // A partial size read or a different PO revision must still remain unresolved.
  if(verifiedPoTotals[order.poNumber]===order.totalPieces&&order.items.every(i=>i.totalQuantity===i.colors.reduce((n,c)=>n+Object.values(c.quantitiesBySize).reduce((a,b)=>a+b,0),0))){
   for(const r of refs){const sku=verifiedTrackingStyle(r.poNumber,r.itemNo);if(actual.has(sku)){r.itemNo=sku;r.quantity=actual.get(sku);r.internalFields={...r.internalFields,O:sku,P:String(r.quantity)};}}
  }
  const expected=new Map<string,number>();for(const r of refs)expected.set(r.itemNo,(expected.get(r.itemNo)||0)+r.quantity);
  if(expected.size!==actual.size||[...expected].some(([sku,q])=>actual.get(sku)!==q)){issues.push({file:f.path,po:order.poNumber,reason:'部分款號或數量與追蹤表不符；相符款式導入，其餘待核對',expected:[...expected],actual:[...actual]});}
  order.piNumber=refs[0].scNumber;order.season=refs[0].season;order.brand=refs[0].internalFields?.D||'';order.series=refs[0].internalFields?.E||refs[0].brand;order.sourceFileName=f.path;
  const key=order.poNumber;
  if(orders.has(key)&&JSON.stringify(orders.get(key).items.map((i:any)=>[i.itemNo,i.colors]))!==JSON.stringify(order.items.map(i=>[i.itemNo,i.colors]))){issues.push({file:f.path,po:key,reason:'同 PO 有不同版本，須核對後匯入'});orders.delete(key);continue;}
  orders.set(key,order);
 }catch(e){issues.push({file:f.path,reason:String(e)});}finally{await pdf?.destroy();}
}
snapshot.orders=[...orders.values()].map(normalizeClassification);snapshot.poImportIssues=issues;snapshot.updatedAt=new Date().toISOString();
fs.writeFileSync(snapshotPath,JSON.stringify(snapshot));
fs.writeFileSync('work/tracking-po-audit.json',JSON.stringify({scanned:seen.size,imported:orders.size,issues},null,2));
const ss=snapshot.tracking.filter((r:any)=>r.season==='SS27');
console.log(JSON.stringify({scanned:seen.size,importedPO:orders.size,SS27MatchedRows:ss.filter((r:any)=>orders.has(r.poNumber)).length,SS27TotalRows:ss.length,issues:issues.length}));
