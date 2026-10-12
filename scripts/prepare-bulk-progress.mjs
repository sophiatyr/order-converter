import fs from 'node:fs';
import {build} from 'esbuild';
const input='work/bulk-original-pilot.json',output='public/csq-bulk-progress.json';
const phases=['tp','labDip','trims','careLabel','fabricInHouse','paperPattern','fitSample','pps','fabricTest'];
const text=v=>String(v??'').trim(),date=v=>typeof v==='number'?new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10):text(v);
if(fs.existsSync(input)){
 const source=JSON.parse(fs.readFileSync(input,'utf8')),rows=source.rows.slice(5).flatMap((r,i)=>{
  if(!r[2]||!r[4]||!(Number(r[8])>0))return [];
  const fields={confirmedDate:date(r[7]),orderCompany:text(r[5]),factoryName:text(r[9]),contact:text(r[10]),customerItem:text(r[11]),description:text(r[12])};
  phases.forEach((k,n)=>{fields[k+'Date']=date(r[13+n*2]);fields[k+'Status']=text(r[14+n*2]);});
  for(const [k,col] of [['cutting',32],['sewing',34],['shippingSample',36],['packing',39],['inspection',41],['shipment',43]]){fields[k+'Date']=date(r[col]);fields[k+'Status']=text(r[col+1]);}
  fields.shippingApprovalDate=date(r[38]);fields.shipmentPlannedDate=fields.shipmentDate;
  return [{row:i+6,po:text(r[4]),style:text(r[2]),quantity:Number(r[8]),customerDate:date(r[6]),fields}];
 });
 fs.writeFileSync(output,JSON.stringify({source:source.source,capturedAt:fs.statSync(input).mtime.toISOString(),rows}));
}
if(fs.existsSync(output)&&fs.existsSync('public/csq-workspace-references.json')){
 await build({entryPoints:['src/utils/bulkProgress.ts'],outfile:'work/bulk-progress.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
 const {applyBulkProgress}=await import('../work/bulk-progress.mjs'),snapshot=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')),progress=JSON.parse(fs.readFileSync(output,'utf8')),checked=applyBulkProgress(snapshot.tracking,progress);
 snapshot.tracking=checked.rows;snapshot.bulkProgressAudit={source:progress.source,capturedAt:progress.capturedAt,matched:checked.matched,issues:checked.issues};snapshot.updatedAt=new Date().toISOString();
 fs.writeFileSync('public/csq-workspace-references.json',JSON.stringify(snapshot));fs.writeFileSync('work/bulk-progress-audit.json',JSON.stringify(snapshot.bulkProgressAudit,null,2));
 console.log(`Original Bulk Status: ${checked.matched} styles matched, ${checked.issues.length} differences retained for review.`);
}
