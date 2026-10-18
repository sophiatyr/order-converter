import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {NasDatabase} from '../server/nasDatabase.mjs';
await build({entryPoints:['src/utils/orderProductPrices.ts'],outfile:'work/order-price-test.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
await build({entryPoints:['src/utils/productPriceHistory.ts'],outfile:'work/history-price-test.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {applyProductPrice}=await import('../work/order-price-test.mjs');const {productPriceHistory,withProductFactoryQuotes}=await import('../work/history-price-test.mjs');
const q=(id,kind,party,price,currency='USD',unit='PC')=>({id,kind,party,price,currency,unit,date:'2026-01-01',remarks:'test',createdAt:'2026-01-01T00:00:00Z'});
const a=q('a','factory','RJ',2),b=q('b','factory','LA',15,'RMB'),c=q('c','customer','CISALFA',5);
const style='TESTS27',w={version:1,orders:[],tracking:{},developments:[],shipments:[],productNotes:{[style]:{brand:'ABC',season:'SS27',remarks:'',prices:[a,b,c]}}};
const erp={account:'CSQ',updatedAt:'2026-10-13',products:[{itemNo:style,chineseName:'Test',chineseSpec:'Fabric',supplierCode:'RJ',factorySupplier:'RJ',factoryCurrency:'USD',factoryPrice:2,uom:'PC',issue:'',quoteDate:'20260101',quotes:[]}]};
const order={piNumber:'CS26000001',poNumber:'26OF000001',poDate:'2026-01-01',orderingCompany:'CISALFA',customerName:'CISALFA',totalPieces:10,totalAmountUSD:30,items:[{id:'item',itemNo:style,styleName:'Test',description:'Fabric',chineseName:'Test',chineseSpec:'Fabric',sizes:['M'],colors:[{id:'white',colorCode:'001',colorName:'WHITE',quantitiesBySize:{M:10},totalQuantity:10}],totalQuantity:10,unitPriceUSD:3,totalAmountUSD:30,unitPriceRMB:0,totalAmountRMB:0}]};
const old=JSON.stringify(order);const first=applyProductPrice(order,style,'a',w,erp);const next=applyProductPrice(first,style,'b',w,erp);
assert.equal(first.items[0].factoryProduct.supplierCode,'RJ');assert.equal(first.items[0].factoryProduct.price,2);assert.equal(next.items[0].factoryProduct.supplierCode,'LA');assert.equal(next.items[0].factoryProduct.currency,'RMB');assert.equal(next.items[0].factoryProduct.price,15);assert.equal(first.items[0].factoryProduct.price,2);assert.equal(JSON.stringify(order),old);
const priced=applyProductPrice(next,style,'c',w,erp);assert.equal(priced.items[0].unitPriceUSD,5);assert.equal(priced.totalAmountUSD,50);assert.equal(priced.items[0].customerPriceRecord.id,'c');assert.equal(priced.corrections.length,1);
assert.equal(productPriceHistory(style,w,erp).filter(p=>p.source!=='ERP 工廠報價').length,3);
const withdrawn={...w,productNotes:{[style]:{...w.productNotes[style],withdrawnPrices:{b:'wrong supplier'}}}};assert.throws(()=>applyProductPrice(first,style,'b',withdrawn,erp),/作廢/);assert.ok(productPriceHistory(style,withdrawn,erp).some(p=>p.id==='b'));
const future=q('future','factory','ZZ',99);future.date='2099-01-01';const fw={...w,productNotes:{[style]:{...w.productNotes[style],prices:[a,b,c,future]}}};assert.throws(()=>applyProductPrice(first,style,'future',fw,erp),/尚未生效/);assert.ok(!withProductFactoryQuotes(erp,fw).products[0].quotes.some(p=>p.supplierCode==='ZZ'));
const wrong=q('wrong','customer','CISALFA',20,'RMB');const wrongUnit=q('pack','customer','CISALFA',20,'USD','PACK');const bad={...w,productNotes:{[style]:{...w.productNotes[style],prices:[wrong,wrongUnit]}}};assert.throws(()=>applyProductPrice(order,style,'wrong',bad,erp),/換算/);assert.throws(()=>applyProductPrice(order,style,'pack',bad,erp),/換算/);
// Saved purchase prices survive a later ERP refresh without explicit selection.
await build({entryPoints:['src/utils/erpProducts.ts'],outfile:'work/erp-price-test.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {applyErpProducts}=await import('../work/erp-price-test.mjs');assert.deepEqual(applyErpProducts(first,{...erp,products:[{...erp.products[0],factoryPrice:999}]}).order.items[0].factoryProduct,first.items[0].factoryProduct);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'price-history-test-'));const db=new NasDatabase(dir,v=>v);const user={id:1,role:'admin'};
try{const note={brand:'ABC',season:'SS27',remarks:'',prices:[a]};db.apply([{kind:'productNotes',id:style,before:null,after:note}],user);const left={...note,prices:[a,b]},right={...note,prices:[a,c]};db.apply([{kind:'productNotes',id:style,before:note,after:left}],user);db.apply([{kind:'productNotes',id:style,before:note,after:right}],user);const saved=db.workspace().productNotes[style];assert.equal(saved.prices.length,3);assert.throws(()=>db.apply([{kind:'productNotes',id:style,before:saved,after:{...saved,prices:[{...a,price:999},b,c]}}],user),/不能修改/);assert.throws(()=>db.apply([{kind:'productNotes',id:style,before:saved,after:{...saved,prices:[]}}],user),/不能修改/);assert.equal(db.workspace().productNotes[style].prices[0].price,2);assert.throws(()=>db.apply([], {id:2,role:'viewer'}),/只能查看/);}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
console.log('Supplier changes, all price versions, explicit order price selection, currency/unit/date guards, saved-order protection, concurrent quote append and history immutability passed.');
