import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inferProductBrand,matchesProductSearch} from '../src/utils/productCatalog';

// A newly created ERP product has no imported PO or manually maintained brand.
const row={itemNo:'ADB604S27',name:'BOXER ADMIRAL B',spec:'BODY: 100% POLYESTER 50D',brand:inferProductBrand('ADB604S27','BOXER ADMIRAL B'),series:'',remarks:''};
assert.equal(row.brand,'ADMIRAL');
assert.ok(matchesProductSearch(row,' adb604 ','polyester'));
assert.ok(matchesProductSearch(row,'S27',''));
assert.ok(!matchesProductSearch(row,'ADB606',''));
assert.ok(!matchesProductSearch(row,'ADB604','cotton'));
assert.equal(inferProductBrand('UNKNOWN','UNCONFIRMED PRODUCT'),'');
assert.equal(inferProductBrand('CRN100S27','運動上衣'),'CARNIELLI');
assert.equal(inferProductBrand('OTHER','BEARDED PRODUCT'),'');

const snapshot=JSON.parse(fs.readFileSync('public/erp-products.json','utf8'));
const recent=['ADB604S27','ADB606S27','ADB608S27','ADB615S27','ADB622S27','ADB623S27','ADG600S27','ADG610S27','ADG621S27','ADG623S27','ADG636S27'];
for(const code of recent){
 const product=snapshot.products.find((p:{itemNo:string})=>p.itemNo===code);
 assert.ok(product,`${code} must be present in the ERP snapshot`);
 assert.equal(inferProductBrand(code,product.chineseName),'ADMIRAL',`${code} must remain visible under the ADMIRAL filter without a PO`);
}
assert.equal(recent.filter(code=>snapshot.products.find((p:{itemNo:string})=>p.itemNo===code).supplierCode==='XHX').length,4);
assert.equal(recent.filter(code=>snapshot.products.find((p:{itemNo:string})=>p.itemNo===code).supplierCode==='YLS').length,7);
console.log('PASS: all 11 recent ERP styles have brand classification; case-insensitive partial style search and combined keyword search.');
