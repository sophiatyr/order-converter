import type {TrackingRecord,Workspace} from './workspace';

export const progressColumns:Record<string,string>={tp:'W',labDip:'AA',fitSample:'AB',shippingSample:'AF',inspection:'AH'};
export function sharedProgressFields(record:TrackingRecord){
 const fields={...record.internalFields},bulk=record.bulk||{};
 for(const [phase,col]of Object.entries(progressColumns))if(Object.hasOwn(bulk,phase+'Date'))fields[col]=bulk[phase+'Date'];
 if(Object.hasOwn(bulk,'ppsDate'))fields.AC=bulk.ppsDate;
 if(Object.hasOwn(bulk,'ppsApprovalDate'))fields.AD=bulk.ppsApprovalDate;
 return fields;
}
export function updateTrackingInput(workspace:Workspace,record:TrackingRecord,group:'bulk'|'internalFields',key:string,value:string):Workspace{
 const prior=workspace.tracking[record.id]||{},bulk={...prior.bulk},internalFields={...prior.internalFields};
 const linked:Record<string,string>={A:'scNumber',B:'poNumber',C:'season',D:'brand',E:'series',F:'company',J:'supplier',T:'customerDate',U:'factoryDate'};
 if(group==='bulk'){
  bulk[key]=value;
  const phase=Object.keys(progressColumns).find(phase=>key===phase+'Date');if(phase)internalFields[progressColumns[phase]]=value;
  if(key==='ppsDate')internalFields.AC=value;
  if(key==='ppsApprovalDate'){internalFields.AD=value;bulk.ppsStatus=value?'APPROVED':'';}
  if(key==='ppsStatus'&&value!=='APPROVED'){bulk.ppsApprovalDate='';internalFields.AD='';}
 }else{
  internalFields[key]=value;
  if(['H','L','M','N'].includes(key))internalFields['_scope'+key]=record.id;
  const phase=Object.keys(progressColumns).find(phase=>progressColumns[phase]===key);if(phase)bulk[phase+'Date']=value;
  if(key==='AC')bulk.ppsDate=value;
  if(key==='AD'){bulk.ppsApprovalDate=value;bulk.ppsStatus=value?'APPROVED':'';}
 }
 const tracking={...workspace.tracking,[record.id]:{...prior,...(group==='internalFields'&&linked[key]?{[linked[key]]:value}:{}),bulk,internalFields}};
 const changed=new Set(group==='bulk'?[key]:Object.keys(bulk).filter(k=>bulk[k]!==prior.bulk?.[k]));
 if(key==='ppsStatus'&&value!=='APPROVED')changed.add('ppsApprovalDate');
 for(const id of Object.keys(tracking).filter(id=>id.startsWith(record.id+':colour:'))){const child=tracking[id];tracking[id]={...child,bulk:{...child.bulk,...Object.fromEntries([...changed].filter(k=>Object.hasOwn(bulk,k)).map(k=>[k,bulk[k]]))}};}
 return {...workspace,tracking};
}
