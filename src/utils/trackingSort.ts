import type {TrackingRecord,Workspace} from './workspace';

const poOrder=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
/** Keep stable style order within a PO; unknown historical import dates sort last. */
export function sortTrackingRows(rows:TrackingRecord[],workspace:Workspace){
 const dates=new Map(workspace.orders.map(o=>[JSON.stringify([o.piNumber,o.poNumber]),o.importedAt]));
 const imported=(r:TrackingRecord)=>{const value=dates.get(JSON.stringify([r.scNumber,r.poNumber]))||r.importedAt;const time=value?Date.parse(value):NaN;return Number.isFinite(time)?time:Number.MAX_SAFE_INTEGER;};
 return [...rows].sort((a,b)=>poOrder.compare(a.poNumber.trim(),b.poNumber.trim())||imported(a)-imported(b)||poOrder.compare(a.scNumber,b.scNumber));
}
