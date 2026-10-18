import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {multiplePackRows} from '../src/utils/multiplePack';
import {buildReferenceDocument} from '../src/utils/referenceDocuments';
import {applyErpProducts,erpFactoryOrders} from '../src/utils/erpProducts';
import {withProductFactoryQuotes} from '../src/utils/productPriceHistory';
import {emptyWorkspace} from '../src/utils/workspace';
const data=JSON.parse(fs.readFileSync('public/csq-document-templates.json','utf8'));
const orders=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')).orders;
const erp=JSON.parse(fs.readFileSync('public/erp-products.json','utf8'));
for(const po of ['26OF029920','26OF029925','26OF029929','26OF029930']){
 const order=orders.find((o:any)=>o.poNumber===po);assert.ok(order);
 const packs=multiplePackRows(order.items);
 assert.equal(packs.reduce((n,p)=>n+p.packs*p.pieces,0),order.totalPieces);
 assert.equal(packs.reduce((n,p)=>n+p.packs,0),order.totalKits);
 const applied=applyErpProducts(order,withProductFactoryQuotes(erp,emptyWorkspace()));
 if(po==='26OF029920'){
  assert.equal(applied.matched,7);assert.equal(applied.issues.length,0);
  assert.equal(erpFactoryOrders(applied.order).length,1);
  const factory=erpFactoryOrders(applied.order)[0].order;assert.equal(factory.supplierCode,'LA');assert.equal(factory.factoryCurrency,'RMB');assert.equal(factory.totalPieces,7682);
  assert.doesNotThrow(()=>buildReferenceDocument(data,'factory',factory,[],erp));
 }
 for(const kind of ['pi','quantity'] as const){
  const book=buildReferenceDocument(data,kind,applied.order,[],erp).book;
  const actual:{code:string;packs:number;ratio:string;sizes:string[];pieces:number;name:string}[]=[];
  for(const ws of book.worksheets){let sizeCols:{size:string;col:number}[]=[],totalCol=0,code='',name='';const ratioRowNumbers:number[]=[];ws.eachRow(row=>{
   if(['COLOR CODE','色碼'].includes(row.getCell(1).text)){
    sizeCols=[];row.eachCell(cell=>{if(/^TTL|^合計（/.test(cell.text))totalCol=Number(cell.col);if(order.items.some((i:any)=>i.sizes.includes(cell.text)))sizeCols.push({size:cell.text,col:Number(cell.col)});});return;
   }
   if(packs.some(p=>p.code===row.getCell(1).text)){code=row.getCell(1).text;name=row.getCell(2).text;}
   const label=row.getCell(2).text;
   if(label.startsWith('RATIO / PACK')||label.startsWith('每包配比\n')){
    ratioRowNumbers.push(row.number);const count=label.match(/([\d,]+)\s*(?:PACKS|包)/);
    actual.push({code,name,packs:Number(count![1].replace(/,/g,'')),pieces:row.getCell(totalCol).value as number,sizes:sizeCols.map(c=>c.size),ratio:sizeCols.map(c=>row.getCell(c.col).value||0).join(':')});
   }
   assert.ok(!row.getCell(1).text.includes('SIZE RATIO (PCS / PACK)'),'No separate ratio table');
  });
  if(kind==='quantity'){const total=ws.getRows(1,ws.rowCount)!.find(row=>row.getCell(1).text==='合計')!;for(const cell of [total.getCell(3),total.getCell(totalCol)]){const formula=(cell.value as any).formula;for(const ratioRow of ratioRowNumbers)assert.ok(!new RegExp(`[A-Z]${ratioRow}(?:,|\\))`).test(formula),'Ratio rows must not enter quantity totals');}}
  }
  assert.equal(actual.length,packs.length,`${po} ${kind} one integrated colour row per pack`);
  for(const pack of packs)assert.ok(actual.some(r=>r.code===pack.code&&r.packs===pack.packs&&r.pieces===pack.pieces&&r.ratio===r.sizes.map(size=>pack.ratio[size]||0).join(':')&&(!pack.kitCode||r.name.includes(pack.kitCode))),`${po} ${kind} ${pack.code} integrated count, ratio and kit`);
  const roundtrip=new ExcelJS.Workbook();await roundtrip.xlsx.load(await book.xlsx.writeBuffer());assert.equal(roundtrip.worksheets.length,book.worksheets.length);
 }
}
const source=orders.find((o:any)=>o.poNumber==='26OF029920');const bad=structuredClone(source.items);bad[0].colors[0].quantitiesBySize.S++;assert.throws(()=>multiplePackRows(bad),/配比與尺碼數量不符/);
console.log('PASS: four actual Multiple Pack POs, per-colour ratios, pack counts and pieces conserved in P/I and quantity XLSX; 26OF029920 exact ERP products yield a valid LA factory PO; invalid edited ratios rejected.');
