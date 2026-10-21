import type {WorkSheet} from 'xlsx';
import {utils} from 'xlsx';
/** Ignore the hundreds of unused styled columns/rows in historical Excel templates. */
export function shippingPreviewBounds(sheet:WorkSheet){
 let rows=0,columns=0;
 for(const [address,cell]of Object.entries(sheet)){if(address.startsWith('!')||!cell||cell.v===undefined||cell.v===null||cell.v==='')continue;const p=utils.decode_cell(address);rows=Math.max(rows,p.r+1);columns=Math.max(columns,p.c+1);}
 for(const m of sheet['!merges']||[]){const master=sheet[utils.encode_cell(m.s)];if(master?.v!==undefined&&master.v!==null&&master.v!==''){rows=Math.max(rows,m.e.r+1);columns=Math.max(columns,m.e.c+1);}}
 return {rows,columns};
}
