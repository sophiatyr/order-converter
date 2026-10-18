import type {OrderData} from '../types/order';
import {normalizeClassification} from './classification';

const compact=(text:string)=>text.normalize('NFKC').toUpperCase().replace(/[\s\p{P}]/gu,'');
export function orderMatches(order:OrderData,query:string,season='',brand='',company=''){
 const o=normalizeClassification(order);
 if(season&&!o.season?.split(' / ').includes(season)||brand&&o.brand!==brand||company&&(o.orderingCompany||o.customerName)!==company)return false;
 const fields=[o.poNumber,o.piNumber,o.customerName,o.orderingCompany||'',o.brand||'',o.series||'',o.season||'',...o.items.flatMap(item=>[item.itemNo,...(item.customerItemCodes||[])])].map(compact);
 return query.trim().split(/\s+/).map(compact).filter(Boolean).every(term=>fields.some(field=>field.includes(term)));
}
function dateKey(value:string){
 const match=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(match)return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
 return /^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';
}
export function recentOrders(a:OrderData,b:OrderData){return dateKey(b.poDate).localeCompare(dateKey(a.poDate))||b.poNumber.localeCompare(a.poNumber,'en',{numeric:true});}
