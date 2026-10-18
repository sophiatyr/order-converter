import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {layoutToRows,type PositionedText} from '../src/utils/documentLayout';
import {parseGridToOrder} from '../src/utils/localPoParser';
import {withErpPiMaterials} from '../src/utils/piMaterials';
import {buildReferenceDocument} from '../src/utils/referenceDocuments';
import {applyErpProducts,erpFactoryOrders} from '../src/utils/erpProducts';
const pages:PositionedText[][]=JSON.parse(fs.readFileSync('tests/fixtures/csq-admiral-47481-pages.json','utf8'));
const rows:{style:string;category:string;text:string}[]=JSON.parse(fs.readFileSync('tests/fixtures/csq-admiral-material-erp.json','utf8'));
const original=parseGridToOrder(pages.flatMap(page=>[[],...layoutToRows(page)])).order!;
const raw=JSON.stringify(original),snapshot=JSON.parse(fs.readFileSync('public/erp-products.json','utf8'));
const templates=JSON.parse(fs.readFileSync('public/csq-document-templates.json','utf8'));
const result=buildReferenceDocument(templates,'pi',withErpPiMaterials(original,snapshot));
const restored=new ExcelJS.Workbook();await restored.xlsx.load(await result.book.xlsx.writeBuffer());
for(const sheet of [result.book.worksheets[0],restored.worksheets[0]]){
 const headers:number[]=[];sheet.eachRow(row=>{if(original.items.some(i=>i.itemNo===row.getCell(2).value))headers.push(row.number);});
 assert.equal(headers.length,11);
 for(const header of headers){
  const style=sheet.getCell(header,2).text,expected=rows.filter(row=>row.style===style&&row.category==='M').map(row=>row.text);
  const actual:string[]=[];let line=header+1;while(line<=sheet.rowCount&&sheet.getCell(line,1).value!=='COLOR CODE'){const cell=sheet.getCell(line,4);if(!cell.isMerged||cell.master.address===cell.address)if(cell.text)actual.push(cell.text);line++;}
  assert.deepEqual(actual,expected,`${style}: P/I must retain the exact ERP material lines`);
 }
}
assert.equal(JSON.stringify(original),raw);assert.equal(original.totalPieces,27212);assert.equal(original.totalAmountUSD,100860.5);
const refs=JSON.parse(fs.readFileSync('public/csq-reference-products.json','utf8')).records;
const quantity=buildReferenceDocument(templates,'quantity',original,refs,snapshot).book;
assert.equal(quantity.worksheets.length,11);
for(const sheet of quantity.worksheets){const actual:string[]=[];sheet.eachRow(row=>{if(/^面料/.test(row.getCell(1).text))actual.push(row.getCell(2).text);});assert.deepEqual(actual,rows.filter(row=>row.style===sheet.name&&row.category==='M').map(row=>row.text),`${sheet.name}: quantity material`);}
const assigned=applyErpProducts(original,snapshot).order;let factoryStyles=0;
for(const group of erpFactoryOrders(assigned)){
 const sheet=buildReferenceDocument(templates,'factory',group.order,refs,snapshot).book.worksheets[0];
 sheet.eachRow(row=>{const style=row.getCell(2).value;if(typeof row.getCell(1).value==='number'&&typeof style==='string'&&original.items.some(item=>item.itemNo===style)){factoryStyles++;assert.deepEqual(sheet.getCell(row.number+1,3).text.split(/\r?\n/),rows.filter(row=>row.style===style&&row.category==='M').map(row=>row.text),`${style}: factory material`);}});
}
assert.equal(factoryStyles,11);
console.log('PASS: all 11 styles / 22 ERP material lines match P/I preview and XLSX export verbatim, including BODY / WOVEN BODY and complete LINING; original PO unchanged.');
