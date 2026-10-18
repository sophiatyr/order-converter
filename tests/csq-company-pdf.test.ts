import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseCsqCompanyPdf} from '../src/utils/csqCompanyPdf';import {csqIssues} from '../src/utils/csqAccount';
import {repairMedicoComposition} from '../src/utils/compositionReferences';
import {correctOrderItems} from '../src/utils/orderCorrections';
const files=JSON.parse(fs.readFileSync('tests/fixtures/csq-company-pdf-pages.json','utf8'));
const expected=JSON.parse(fs.readFileSync('tests/fixtures/csq-company-sk-kpi-expected.json','utf8'));
let verified=0;
for(const f of files){const reference=expected.find((r:any)=>r.file===f.file);const result=parseCsqCompanyPdf(f.pages,f.file)!;if(reference.error){
 assert.equal(result.success,true,`${f.file}: ${result.error}`);const o=result.order!,multi=f.file.includes('37144');
 assert.equal(o.poNumber,multi?'26OF031773':'26OF031761');assert.equal(o.totalPieces,multi?1200:1800);assert.equal(o.totalAmountUSD,multi?4830:7245);assert.deepEqual(csqIssues(o),[]);
 assert.deepEqual(o.items.map(i=>i.itemNo),['FTM081S27','FTM091S27']);assert.deepEqual(o.items.map(i=>i.unitPriceUSD),[4.1,3.95]);
 for(const i of o.items){assert.deepEqual(Object.fromEntries(Object.entries(i.colors[0].quantitiesBySize).filter(([,q])=>q)),multi?{S:100,M:200,L:200,XL:100}:{S:125,M:250,L:325,XL:200});if(multi){assert.equal(i.kitQty,100);assert.equal(i.piecesPerKit,6);assert.deepEqual(i.colors[0].ratioBySize,{S:1,M:2,L:2,XL:1});}}
 continue;}
assert.equal(result.success,true,`${f.file}: ${result.error}`);const order=result.order!,e=reference.expected;assert.equal(order.poNumber,e.header.customer_po);assert.equal(order.piNumber,e.header.proposed_order_no);assert.equal(order.poDate,e.header.order_date);assert.equal(order.shipmentDate,e.header.ship_date);assert.equal(order.totalPieces,e.summary.quantity);assert.equal(order.totalAmountUSD,e.summary.amount);assert.equal(order.items.length,e.lines.length);assert.deepEqual(csqIssues(order),[]);
 for(const [i,item] of order.items.entries()){const line=e.lines[i];assert.equal(item.itemNo,line.style);assert.equal(item.totalQuantity,line.qty);assert.equal(item.unitPriceUSD,line.unit_price);assert.deepEqual(Object.fromEntries(Object.entries(item.colors[0].quantitiesBySize).filter(([,q])=>q)),Object.fromEntries(Object.entries(line.sizes).filter(([,q])=>q)));if(order.orderingCompany!=='FALIS'){assert.equal(item.colors[0].colorCode,line.color);assert.deepEqual(item.customerItemCodes,line.customer_item_codes);}if(line.pack_type==='multiple'){assert.equal(item.kitQty,line.pack_qty);assert.equal(item.piecesPerKit,line.pieces_per_pack);assert.equal(item.kitPriceUSD,line.pack_price);assert.deepEqual(item.colors[0].ratioBySize,line.pack_sizes);}}
 verified++;
}
// Actual FALIS has a separate source line number before the colour, which must
// never be prefixed onto the colour code even if extraction joins nearby words.
const falis=parseCsqCompanyPdf(files.find((f:any)=>f.file.includes('#1779')).pages)!.order!;assert.deepEqual(falis.items.map(i=>i.colors[0].colorCode),['050','519A','619A','519A','795']);
const medico=files.find((f:any)=>f.file.endsWith('111-SOLID-SPORT KITE.pdf'));
const revised=files.find((f:any)=>f.file.endsWith('112-SOLID-SPORT KITE-REVISED.pdf'));
const original=files.find((f:any)=>f.file.endsWith('112-SOLID-SPORT KITE.pdf'));
const revisedOrder=parseCsqCompanyPdf(revised.pages,revised.file)!.order!;
const originalOrder=parseCsqCompanyPdf(original.pages,original.file)!.order!;
for(const item of revisedOrder.items){assert.equal(item.styleName,'SHORT FILA W');assert.equal(item.composition,'KNIT - INTERLOCK 100% POLYESTER 75D/72F DRY FIT, 145 GSM');assert.equal(item.description,item.composition);}
assert.ok(originalOrder.items.every(i=>i.composition!.includes('RECYCLED POLYESTER')));
const references=[revisedOrder,originalOrder].map(o=>({poNumber:o.poNumber,date:o.poDate,fileName:o.sourceFileName!.split(/[\\/]/).pop()!,quantity:o.totalPieces,amount:o.totalAmountUSD,items:o.items.map(i=>({itemNo:i.itemNo,description:i.styleName,composition:i.composition!,quantity:i.totalQuantity,colors:i.colors.map(c=>({code:c.colorCode,quantity:c.totalQuantity}))}))}));
const legacy={...revisedOrder,items:revisedOrder.items.map(i=>({...i,composition:undefined,description:i.styleName}))};
const repaired=repairMedicoComposition(legacy,references);assert.ok(repaired.items.every(i=>i.composition===revisedOrder.items[0].composition));assert.equal(repaired.totalAmountUSD,legacy.totalAmountUSD);assert.equal(repaired.totalPieces,legacy.totalPieces);
assert.equal(repairMedicoComposition({...legacy,sourceFileName:undefined},references).items[0].composition,undefined,'ambiguous original/revised material must not be guessed');
const manuallyCorrected=correctOrderItems(legacy,[legacy.items[0].id],{description:'CONFIRMED COMPOSITION'},'客戶確認','2026-10-13');assert.equal(repairMedicoComposition(manuallyCorrected,references).items[0].composition,'CONFIRMED COMPOSITION');
for(const [label,alter] of [
 ['size',(p:any[][])=>{p[0].find(w=>w.text==='41').text='42';}],
 ['amount',(p:any[][])=>{p[0].find(w=>w.text==='$1,156.40').text='$1,156.41';}],
 ['discount',(p:any[][])=>{p[0].find(w=>w.text==='-$23.13').text='-$23.12';}],
 ['date',(p:any[][])=>{p[0].find(w=>w.text==='21-Jan-27').text='31-Feb-27';}],
 ['PO',(p:any[][])=>{const w=p[0].find(w=>w.text.includes('26OF031571'));w.text=w.text.replace('26OF031571','MFEL-26-111');}],
] as const){const pages=structuredClone(medico.pages);alter(pages);assert.equal(parseCsqCompanyPdf(pages)!.success,false,label);}
console.log(`PASS: ${verified} real FALIS/BEAR, PREMIUM FILA and MEDICO solid/MULTI PDFs cross-checked against SK-KPI; two additional PREMIUM layouts verified against original PDF figures; five corrupt cases rejected; FALIS row numbers separated from colours.`);
