import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildReferenceDocument} from '../src/utils/referenceDocuments';
import {readCsqBackup} from '../src/utils/csqBackup';
import {applyErpProducts,erpFactoryOrders} from '../src/utils/erpProducts';
const templates=JSON.parse(fs.readFileSync('public/csq-document-templates.json','utf8'));
const orders=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')).orders;
const erp=JSON.parse(fs.readFileSync('public/erp-products.json','utf8'));
for(const po of ['26OF028471','26OF029920','26OF031991']){
 const order=orders.find((o:any)=>o.poNumber===po);
 for(const required of [true,false,undefined]){
  const selected={...order,requiresAntiCounterfeitLabel:required};
  const restored=readCsqBackup(JSON.stringify({account:'CSQ',version:1,order:selected}));assert.equal(restored.requiresAntiCounterfeitLabel,required);
  const applied=applyErpProducts(restored,erp).order;for(const group of erpFactoryOrders(applied))assert.equal(group.order.requiresAntiCounterfeitLabel,required);
  const book=buildReferenceDocument(templates,'quantity',applied,[],erp).book;
  for(const ws of book.worksheets){let label='',lines:string[]=[];ws.eachRow(row=>{if(row.getCell(1).text==='防偽標：')label=row.getCell(2).text;lines.push(row.getCell(1).text);});assert.equal(label,required===true?'需要防偽標':required===false?'不需要防偽標':'待確認（請在訂單核對頁選擇）');if(required!==true)assert.ok(!lines.some(line=>/^1件\//.test(line)&&line.includes('/防偽標/')),'Packing instructions must not contradict the order setting');}
 }
 assert.equal(order.requiresAntiCounterfeitLabel,undefined,'Never guess the requirement for old orders');
 assert.throws(()=>readCsqBackup(JSON.stringify({account:'CSQ',version:1,order:{...order,requiresAntiCounterfeitLabel:'no'}})),/防偽標設定格式不符/);
}
console.log('PASS: required / not required / unconfirmed anti-counterfeit labels on every quantity sheet; normal, Multiple Pack and socks; no contradictory packing notes, backup persistence and factory grouping.');
