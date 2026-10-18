import {canonicalBrand} from './classification';

// ERP has no brand field in this snapshot. Use the actual product name before
// falling back to the two established product-code aliases.
export function inferProductBrand(itemNo:string,name:string){
 const brands=['BEST COMPANY','CARNIELLI','FIREFLY','ADMIRAL','INTERSPORT','MISTRAL','ELLESSE','REUSCH','ARENA','BEAR','FILA','8848','ABC'];
 const upper=name.toUpperCase();
 const brand=brands.find(value=>new RegExp(`\\b${value}\\b`).test(upper));
 if(brand)return canonicalBrand(brand);
 const code=itemNo.toUpperCase();
 return code.startsWith('CRN')?'CARNIELLI':code.startsWith('FF')?'FIREFLY':'';
}

export function matchesProductSearch(row:{itemNo:string;name:string;spec:string;brand:string;series:string;remarks:string},style:string,search:string){
 return row.itemNo.toUpperCase().includes(style.trim().toUpperCase())&&
  [row.itemNo,row.name,row.spec,row.brand,row.series,row.remarks].join(' ').toLowerCase().includes(search.trim().toLowerCase());
}
