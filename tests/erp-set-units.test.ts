import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {layoutToRows} from '../src/utils/documentLayout';
import {parseGridToOrder} from '../src/utils/localPoParser';
import {applyErpProducts,erpFactoryOrders} from '../src/utils/erpProducts';
import {assignStyleFactories} from '../src/utils/factoryAssignments';
import {buildReferenceDocument} from '../src/utils/referenceDocuments';
import {emptyWorkspace,loadWorkspace} from '../src/utils/workspace';
import {productPriceHistory,withProductFactoryQuotes} from '../src/utils/productPriceHistory';
const erp=JSON.parse(fs.readFileSync('public/erp-products.json','utf8'));
const templates=JSON.parse(fs.readFileSync('public/csq-document-templates.json','utf8'));
const pages=JSON.parse(fs.readFileSync('tests/fixtures/csq-admiral-48119-pages.json','utf8'));
const order=parseGridToOrder(pages.flatMap((p:any)=>[[],...layoutToRows(p)])).order!;
const result=applyErpProducts(order,withProductFactoryQuotes(erp,emptyWorkspace()));assert.equal(result.matched,7);assert.deepEqual(result.issues,[]);
const expected:Record<string,number>={ADW600S27:19.5,ADW605S27:21.8,ADW607S27:21.8,ADW660S27:26.7};
for(const item of result.order.items){assert.equal(item.factoryProduct?.supplierCode,'YLS');assert.equal(item.factoryProduct?.unit,'套');assert.equal(item.unitPriceRMB,expected[item.itemNo]);assert.equal(item.factoryProduct?.quoteDate,'20261002');assert.equal(item.totalQuantity,order.items.find(i=>i.id===item.id)!.totalQuantity);}
assert.equal(result.order.totalAmountUSD,22800);assert.equal(result.order.totalPieces,6500);
const group=erpFactoryOrders(result.order)[0];assert.equal(erpFactoryOrders(result.order).length,1);assert.equal(group.order.factoryQuantityUnit,'套');assert.equal(group.order.totalAmountRMB,132650);
const edited=assignStyleFactories(result.order,{ADW600S27:{supplierCode:'YLS',supplier:'雅麗莎公司',currency:'RMB',price:'19.5',unit:'套',date:'2026-10-02'}});const restored=loadWorkspace(JSON.stringify({...emptyWorkspace(),orders:[edited]}),null);assert.equal(restored.orders[0].items[0].factoryPriceRecord?.unit,'SET');assert.ok(productPriceHistory('ADW600S27',restored,erp).some(q=>q.source==='工作站訂單'&&q.kind==='factory'&&q.unit==='SET'));
const unknown={...order,items:[{...order.items[0],itemNo:'UNCONFIRMED-SET'}]};const master=erp.products.find((p:any)=>p.itemNo==='ADW600S27');assert.equal(applyErpProducts(unknown,{...erp,products:[{...master,itemNo:'UNCONFIRMED-SET'}]}).matched,0,'Unverified SET products must not receive a guessed conversion');assert.equal(applyErpProducts({...order,items:[order.items[0]]},{...erp,products:[{...master,uom:'PC'}]}).matched,0,'Mismatched product/purchase units must remain blocked');
for(const kind of ['factory','quantity'] as const){const book=buildReferenceDocument(templates,kind,group.order,[],erp).book;let all='';book.worksheets.forEach(ws=>ws.eachRow(row=>row.eachCell(c=>all+=c.text+'\n')));assert.ok(all.includes('套'),`${kind} must identify SET units`);if(kind==='factory'){let total:any;book.worksheets[0].eachRow(row=>{if(/^合\s*計|^採購總額/.test(row.getCell(1).text))total=row.getCell(9).value;});assert.equal(total,132650);}const roundtrip=new ExcelJS.Workbook();await roundtrip.xlsx.load(await book.xlsx.writeBuffer());assert.equal(roundtrip.worksheets.length,book.worksheets.length);}
console.log('PASS: actual 26OF048119 / original CS26044203 evidence, YLS SET quotes 19.50/21.80/21.80/26.70, one-to-one 6500 sets/RMB132650, unchanged sale totals, SET history/backups and no guessed conversions.');
