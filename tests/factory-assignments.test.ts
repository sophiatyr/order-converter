import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import {parseGridToOrder} from '../src/utils/localPoParser';
import {layoutToRows,type PositionedText} from '../src/utils/documentLayout';
import {assignStyleFactories,type FactoryAssignment} from '../src/utils/factoryAssignments';
import {erpFactoryOrders,applyErpProducts,type ErpSnapshot} from '../src/utils/erpProducts';
import {emptyWorkspace} from '../src/utils/workspace';
import {productPriceHistory} from '../src/utils/productPriceHistory';
import {localToday} from '../src/utils/trackingAutomation';
import {readCsqBackup} from '../src/utils/csqBackup';
import {buildReferenceDocument,type DocumentTemplates} from '../src/utils/referenceDocuments';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {StyleFactoryAssignments} from '../src/components/StyleFactoryAssignments';
import {withErpPiMaterials} from '../src/utils/piMaterials';
const pages:PositionedText[][]=JSON.parse(fs.readFileSync('tests/fixtures/csq-admiral-47481-pages.json','utf8'));
const order=parseGridToOrder(pages.flatMap(page=>[[],...layoutToRows(page)])).order!;
const snapshot:ErpSnapshot=JSON.parse(fs.readFileSync('public/erp-products.json','utf8'));
const drafts:Record<string,FactoryAssignment>={};
for(const style of new Set(order.items.map(i=>i.itemNo))){const p=snapshot.products.find(p=>p.itemNo===style),q=p!.purchasePrices!.find(q=>q.remarks.includes(order.piNumber));assert.ok(q);drafts[style]={supplierCode:q.party,supplier:q.partyName||q.party,currency:q.currency as 'USD'|'RMB',price:String(q.price),date:q.date,unit:'件'};}
// LAN HTTP browsers expose getRandomValues but may not expose randomUUID.
const assigned=(()=>{
 const descriptor=Object.getOwnPropertyDescriptor(crypto,'randomUUID');
 Object.defineProperty(crypto,'randomUUID',{configurable:true,value:undefined});
 try{return assignStyleFactories(order,drafts);}
 finally{if(descriptor)Object.defineProperty(crypto,'randomUUID',descriptor);else delete (crypto as unknown as {randomUUID?:unknown}).randomUUID;}
})();
assert.equal(new Set(assigned.items.map(i=>i.factoryPriceRecord!.id)).size,Object.keys(drafts).length);
assert.ok(assigned.items.every(i=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(i.factoryPriceRecord!.id)));
const groups=erpFactoryOrders(assigned);
assert.equal(groups.length,2);assert.equal(groups.find(g=>g.order.supplierCode==='XHX')!.order.totalPieces,9002);assert.equal(groups.find(g=>g.order.supplierCode==='YLS')!.order.totalPieces,18210);
assert.equal(groups.find(g=>g.order.supplierCode==='XHX')!.order.factoryCurrency,'USD');assert.equal(groups.find(g=>g.order.supplierCode==='YLS')!.order.factoryCurrency,'RMB');
assert.equal(assigned.totalPieces,order.totalPieces);assert.equal(assigned.totalAmountUSD,order.totalAmountUSD);
for(const item of assigned.items){assert.ok(item.factoryProduct);assert.equal(item.unitPriceUSD,order.items.find(i=>i.id===item.id)!.unitPriceUSD);}
const changed=assignStyleFactories(assigned,{ADB623S27:{supplierCode:'NEW',supplier:'新工廠',currency:'USD',price:'2.99',date:localToday(),unit:'件'}});
assert.equal(changed.items.filter(i=>i.itemNo==='ADB623S27'&&i.factoryProduct?.supplierCode==='NEW').length,2);
assert.equal(erpFactoryOrders(changed).length,3);
assert.ok(changed.items.filter(i=>i.itemNo==='ADB623S27').every(i=>i.factoryPriceHistory!.length===2));
const w={...emptyWorkspace(),orders:[changed]};const history=productPriceHistory('ADB623S27',w,null);assert.ok(history.some(q=>q.party==='YLS'&&q.price===14.8));assert.ok(history.some(q=>q.party==='NEW'&&q.price===2.99));
assert.deepEqual(readCsqBackup(JSON.stringify({account:'CSQ',version:1,order:changed})).items[0].factoryPriceHistory,changed.items[0].factoryPriceHistory);
assert.deepEqual(applyErpProducts(changed,{account:'CSQ',updatedAt:'',products:[]}).order.items.map(i=>i.factoryProduct),changed.items.map(i=>i.factoryProduct));
assert.throws(()=>assignStyleFactories(order,{ADB623S27:{...drafts.ADB623S27,price:'0'}}));
const templates:DocumentTemplates=JSON.parse(fs.readFileSync('public/csq-document-templates.json','utf8'));
const quantityZip=new JSZip();
for(const group of groups){
 const book=buildReferenceDocument(templates,'quantity',group.order,[],snapshot).book;
 assert.deepEqual(book.worksheets.map(sheet=>sheet.name),[...new Set(group.order.items.map(item=>item.itemNo))]);
 let total=0;for(const sheet of book.worksheets)sheet.eachRow(row=>{if(row.getCell(1).text==='合計')total+=Number((row.getCell(sheet.columnCount).value as ExcelJS.CellFormulaValue).result);});assert.equal(total,group.order.totalPieces);
 quantityZip.file(`${group.order.supplierCode}_數量明細.xlsx`,await book.xlsx.writeBuffer());
}
const restoredZip=await JSZip.loadAsync(await quantityZip.generateAsync({type:'uint8array'}));assert.deepEqual(Object.keys(restoredZip.files).sort(),['XHX_數量明細.xlsx','YLS_數量明細.xlsx']);
for(const [name,count] of [['XHX_數量明細.xlsx',4],['YLS_數量明細.xlsx',7]] as const){const book=new ExcelJS.Workbook();await book.xlsx.load(await restoredZip.file(name)!.async('arraybuffer'));assert.equal(book.worksheets.length,count);}
const yls=groups.find(group=>group.order.supplierCode==='YLS')!.order;
const plain=buildReferenceDocument(templates,'factory',yls).book.worksheets[0];
const textOf=(sheet:import('exceljs').Worksheet)=>{const text:string[]=[];sheet.eachRow(row=>row.eachCell(cell=>{if(!cell.isMerged||cell.master.address===cell.address)text.push(cell.text);}));return text.join('\n');};
assert.ok(!/小[缸缶]/.test(textOf(plain)));
const withFee=buildReferenceDocument(templates,'factory',{...yls,factoryExtraFees:[{id:'small-vat',description:'小缸費',amount:100}]}).book.worksheets[0];assert.equal((textOf(withFee).match(/小缸費/g)||[]).length,1);assert.ok(textOf(withFee).includes('額外費用：小缸費'));
const piOrder=withErpPiMaterials(assigned,snapshot);
assert.equal(piOrder.items.find(i=>i.itemNo==='ADB606S27')!.description,snapshot.products.find(p=>p.itemNo==='ADB606S27')!.chineseSpec);
assert.ok(assigned.items.find(i=>i.itemNo==='ADB606S27')!.description.includes('REFERENCE STYLE'));
assert.equal(piOrder.totalPieces,assigned.totalPieces);assert.equal(piOrder.totalAmountUSD,assigned.totalAmountUSD);assert.deepEqual(piOrder.items.map(i=>i.factoryProduct),assigned.items.map(i=>i.factoryProduct));
assert.equal(withErpPiMaterials(assigned,{account:'CSQ',updatedAt:'',products:[]}).items[0].description,assigned.items[0].description);
const pi=buildReferenceDocument(templates,'pi',assigned).book.worksheets[0];let juniorHeader=0;pi.eachRow(row=>{if(row.getCell(2).text==='ADB623S27')juniorHeader=row.number;});while(pi.getCell(juniorHeader,1).text!=='COLOR CODE')juniorHeader++;
assert.deepEqual([4,5,6,7,8].map(col=>pi.getCell(juniorHeader,col).text),['6A','8A','10A','12A','14A']);
for(const offset of [1,2])assert.deepEqual([4,5,6,7,8].map(col=>pi.getCell(juniorHeader+offset,col).value),[300,354,399,444,453]);
assert.deepEqual(assigned.items.find(item=>item.vendorPart==='ADB623S27-AOP1')!.sizes,['6A','10A','14A','8A','12A']);
const small=templates.templates.filter(t=>t.kind==='overview').sort((a,b)=>a.sheet.rowCount-b.sheet.rowCount)[0];
const overview=buildReferenceDocument({...templates,templates:[small]},'overview',assigned).book.worksheets[0];
const overviewRows:{sequence:number;style:string;quantity:number}[]=[];
overview.eachRow(row=>{if(!row.hidden&&typeof row.getCell(1).value==='number'&&row.getCell(2).text)overviewRows.push({sequence:Number(row.getCell(1).value),style:row.getCell(2).text,quantity:Number(row.getCell(4).value)});});
assert.equal(overviewRows.length,11);assert.deepEqual(overviewRows.map(row=>row.sequence),Array.from({length:11},(_,i)=>i+1));assert.deepEqual(overviewRows.map(row=>row.style),[...new Set(assigned.items.map(i=>i.itemNo))]);assert.equal(overviewRows.reduce((n,row)=>n+row.quantity,0),27212);
const manualGroup=erpFactoryOrders(changed).find(group=>group.order.supplierCode==='NEW')!;assert.ok(buildReferenceDocument(templates,'factory',manualGroup.order).book.worksheets.length);
const quantities=buildReferenceDocument(templates,'quantity',assigned).book;assert.equal(quantities.worksheets.length,11);
for(const sheet of quantities.worksheets){const texts:string[]=[];sheet.eachRow(row=>row.eachCell(cell=>{if(!cell.isMerged||cell.master.address===cell.address)texts.push(cell.text);}));const text=texts.join('\n');assert.ok(text.includes('單色單碼裝'));assert.ok(!/混碼|ARN-T006|同款單色單碼一個配比|無需貼條碼/.test(text));}
const customPacking=buildReferenceDocument(templates,'quantity',{...assigned,normalCartonQuantity:40,requiresAntiCounterfeitLabel:true}).book.worksheets[0],packingText:string[]=[];customPacking.eachRow(row=>row.eachCell(cell=>{if(!cell.isMerged||cell.master.address===cell.address)packingText.push(cell.text);}));assert.ok(packingText.includes('40件/單色單碼入箱/天地蓋/七層外箱.(箱規固定)'));assert.ok(packingText.includes('1件/商標/防偽標/防盜標/主吊牌/條碼吊牌/PE袋/電腦條碼/納米乾燥劑'));assert.ok(packingText.includes('具體配色看作工圖要求'));assert.equal(readCsqBackup(JSON.stringify({account:'CSQ',version:1,order:{...assigned,normalCartonQuantity:40}})).normalCartonQuantity,40);
const html=renderToStaticMarkup(createElement(StyleFactoryAssignments,{order,w:emptyWorkspace(),erp:snapshot,onChange:()=>{}}));assert.ok(html.includes('各款下單工廠與採購價'));assert.equal((html.match(/aria-label="[^"]+ 工廠代號"/g)||[]).length,11);
console.log('PASS: ERP 26OF047481 two factories / separate currencies, direct manual factory assignment, all style colours, unchanged sales, append-only price history and backup round trip.');
