import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {layoutToRows,type PositionedText} from '../src/utils/documentLayout';
import {parseGridToOrder,parseTextToOrder} from '../src/utils/localPoParser';
import {buildReferenceDocument} from '../src/utils/referenceDocuments';
import {normalizeCsqOrder} from '../src/utils/csqAccount';
const pages:PositionedText[][]=JSON.parse(fs.readFileSync('tests/fixtures/csq-admiral-48119-pages.json','utf8'));
const rows=pages.flatMap(page=>[[],...layoutToRows(page)]);
// Independently read from both rendered pages of the original PO.
const expected=[
 ['ADW600S27','302/57','ROSE GLITTER\n+VIOLET SOLID',[200,260,240,160,140],3.35],
 ['ADW600S27','304/75','SALVIA GLITTER\n+BLACK GLITTER',[300,420,390,240,150],3.35],
 ['ADW600S27','315/311','ROYAL GLITTER\n+VIOLET GLITTER',[300,420,390,240,150],3.35],
 ['ADW600S27','75/309','BLACK GLITTER\n+ACQUA GLITTER',[200,280,260,160,100],3.35],
 ['ADW605S27','AOP','ANIMALIER',[80,110,140,90,80],3.75],
 ['ADW607S27','AOP','ZEBRA',[80,110,140,90,80],3.75],
 ['ADW660S27','AOP','SNAKE WHITE\n+BLACK',[80,110,140,90,80],4.6],
] as const;
const templates=JSON.parse(fs.readFileSync('public/csq-document-templates.json','utf8'));
const erp=JSON.parse(fs.readFileSync('public/erp-products.json','utf8'));
for(const result of [parseGridToOrder(rows),parseTextToOrder(rows.map(r=>r.join('\t')).join('\n')),parseGridToOrder(rows.map(r=>r.map(c=>c.replace(/26OF048119/g,'26OF048120'))))]){
 assert.equal(result.success,true,result.error);assert.deepEqual(result.warnings,[]);const order=result.order!;assert.equal(order.items.length,7);assert.equal(order.totalPieces,6500);assert.equal(order.totalAmountUSD,22800);
 order.items.forEach((item,n)=>{const [style,code,name,values,price]=expected[n];assert.equal(item.itemNo,style);assert.equal(item.colors[0].colorCode,code);assert.equal(item.colors[0].colorName,name);assert.equal(item.unitPriceUSD,price);assert.deepEqual(item.sizes.map(s=>item.colors[0].quantitiesBySize[s]),values);});
 if(order.poNumber!=='26OF048119')continue;
 for(const kind of ['pi','quantity'] as const){const book=buildReferenceDocument(templates,kind,order,[],erp).book;const restored=new ExcelJS.Workbook();await restored.xlsx.load(await book.xlsx.writeBuffer());for(const doc of [book,restored])for(const [,code,name] of expected){let found=false;for(const ws of doc.worksheets)ws.eachRow(row=>{if(row.getCell(1).text===code&&row.getCell(2).text===name){found=true;if(name.includes('\n'))assert.ok(row.height!>=36,'Two-line colour names need visible row height');}});assert.ok(found,`${kind}: ${code} ${name} must render as one complete colour`);}}
 const truncated={...order,items:order.items.map(item=>({...item,colors:item.colors.map(c=>({...c,colorName:c.colorName.split('\n')[0]}))}))};
 const repaired=normalizeCsqOrder(truncated);assert.deepEqual(repaired.items.map(i=>i.colors[0].colorName),expected.map(e=>e[2]));assert.equal(repaired.totalPieces,6500);assert.equal(repaired.totalAmountUSD,22800);assert.deepEqual(normalizeCsqOrder(repaired),repaired);
 const manual={...truncated,items:truncated.items.map((i,n)=>n?i:{...i,colors:i.colors.map(c=>({...c,colorName:'CUSTOM CONFIRMED COLOUR'}))})};assert.equal(normalizeCsqOrder(manual).items[0].colors[0].colorName,'CUSTOM CONFIRMED COLOUR');assert.equal(normalizeCsqOrder({...truncated,poNumber:'26OF048120'}).items[0].colors[0].colorName,'ROSE GLITTER');
}
console.log('PASS: original 26OF048119 seven colour lines including five + continuations; general parser support, preview and XLSX line breaks/heights, 6500 pieces/USD22800, narrowly scoped repair preserving manual edits.');
