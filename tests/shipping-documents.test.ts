import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {buildShippingDocuments,type ShippingTemplates} from '../src/utils/shippingDocuments';
import {withCartons,packingIssues,type CartonRow} from '../src/utils/shipmentPacking';
import {emptyWorkspace,loadWorkspace,type Shipment,type ShipmentLine} from '../src/utils/workspace';
import {presentWorkbook} from '../src/utils/workbookPresentation';
const templates=JSON.parse(fs.readFileSync('public/csq-shipping-documents.json','utf8')) as ShippingTemplates;
const sizes={XS:0,S:0,M:0,L:0,XL:0,XXL:0,XXXL:0};
const boxes:CartonRow[]=[{id:'a',from:1,to:2,sizes:{XS:1,S:2,M:3,L:4,XL:5,XXL:6,XXXL:7},netWeight:10,grossWeight:11,cbm:0.1,measurement:'50X40X50CM'}];
const line:ShipmentLine=withCartons({id:'l1',itemNo:'TEST-STYLE',description:'TEST FABRIC COMPOSITION 100% POLYESTER',color:'001 WHITE',unit:'PCS',planned:56,sizes,unitPriceUSD:2.35,supplier:'RJ',cartons:0,netWeight:0,grossWeight:0,cbm:0},boxes);
const shipment:Shipment={id:'s1',poNumber:'TEST-PO-001',scNumber:'TEST-SC-001',customer:'TEST CUSTOMER',address:'TEST ADDRESS',invoiceNo:'TEST-INV-001',date:'2026-10-12',vessel:'TEST VESSEL',container:'TEST CONTAINER',fromPort:'XIAMEN',toPort:'GENOVA',remarks:'',confirmed:false,lines:[line],factoryNotice:{lcNumber:'TEST-LC',lcIssueDate:'2026-10-01',lcIssueBank:'TEST BANK'}};
assert.deepEqual(packingIssues(shipment),[]);assert.equal(line.cartons,2);assert.equal(line.sizes.XXXL,14);assert.equal(line.grossWeight,22);
assert.ok(packingIssues({...shipment,lines:[{...line,packingRows:undefined}]}).length);
assert.ok(packingIssues({...shipment,lines:[line,{...line,id:'duplicate'}]}).some(t=>t.includes('箱號重複')));
assert.ok(packingIssues({...shipment,lines:[{...line,cartons:9}]}).some(t=>t.includes('不一致')));
assert.throws(()=>loadWorkspace(JSON.stringify({...emptyWorkspace(),shipments:[{...shipment,lines:[{...line,packingRows:[{...boxes[0],from:null}]}]}]}),null));
for(const kind of ['invoice','packing'] as const){
 const book=presentWorkbook(buildShippingDocuments(shipment,kind,templates));
 const roundtrip=new ExcelJS.Workbook();await roundtrip.xlsx.load(await book.xlsx.writeBuffer());
 const text=roundtrip.worksheets.flatMap(ws=>{const vals:string[]=[];ws.eachRow(r=>r.eachCell(c=>vals.push(JSON.stringify(c.value))));return vals;}).join('\n');
 for(const sample of ['CS251428FA','25OF037927','CS26001262','H3924CI016365','0044025CD00249','JAN. 28, 2026','FALIS'])assert.ok(!text.includes(sample),`Old ${sample} must not leak into ${kind}`);
 assert.ok(text.includes("SPORTS KITE INT'L CO., LTD."));assert.ok(text.includes('TEST-PO-001'));
 assert.equal(book.worksheets[0].pageSetup.fitToWidth,1);
 if(kind==='invoice'){const ws=book.worksheets[0];assert.equal(ws.getCell('A5').value,'COMMERCIAL INVOICE');assert.equal(ws.getCell('F23').value,56);assert.deepEqual(ws.getCell('I23').value,{formula:'F23*H23',result:131.6});assert.equal(ws.getCell('C22').master.address,'C22');assert.equal(ws.getCell('I22').master.address,'C22');}
 else{assert.equal(book.worksheets.length,2);const pk=book.worksheets[0],weight=book.worksheets[1];assert.equal(pk.getCell('M15').value,'XXXL');assert.equal(pk.getCell('D17').value&&typeof pk.getCell('D17').value,'object');assert.deepEqual(pk.getCell('O17').value,{formula:'N17*D17',result:56});assert.equal(weight.getCell('C14').value,56);assert.equal(weight.getCell('E14').value,22);assert.equal(weight.getCell('G14').value,'TEST CONTAINER');}
 await book.xlsx.writeFile(`work/shipping-${kind}-check.xlsx`);
}
const partial={...shipment,lines:[withCartons({...line,packingRows:[]},[{...boxes[0],to:1}])]};
assert.equal(buildShippingDocuments(partial,'invoice',templates).worksheets[0].getCell('F23').value,28,'Invoice uses actual shipped quantities');
const pair={...shipment,lines:[{...line,unit:'PAIRS'}]};assert.equal(buildShippingDocuments(pair,'invoice',templates).worksheets[0].getCell('G23').value,'PAIRS');
console.log('Reference shipment layouts, carton reconciliation, formulas, actual quantities and privacy checks passed.');
