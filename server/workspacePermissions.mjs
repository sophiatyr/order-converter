// Shared by the browser and server. Authorization uses the stored record, never
// a client-supplied 'before' snapshot, so forged baselines cannot grant access.
export const roleLabels={admin:'管理員',shipping:'船務',assistant:'業務助理',viewer:'瀏覽者'};
export const roleLabel=role=>roleLabels[effectiveRole(role)]||'瀏覽者';
export const effectiveRole=role=>role==='member'?'assistant':role;
export const validRoles=Object.keys(roleLabels);
export function canEditModule(role,module){
 role=effectiveRole(role);
 if(role==='admin'||role===undefined)return true; // An offline workstation has no account gate.
 if(role==='shipping')return module==='shipping';
 if(role==='assistant')return ['orders','tracking','development','products'].includes(module);
 return false;
}
const shippingBulk=new Set(['shipmentOriginalDate','shipmentEstimatedDate','shipmentCartons','shipmentGrossWeight','shipmentCbm','shipmentLc']);
const shippingInternal=new Set(['AK','AL','AM','AN','AO','AP','AQ','_shipmentClosed']);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function changedPaths(before,after,prefix=[]){
 if(Object.is(before,after))return [];
 if(object(before)||object(after))return [...new Set([...Object.keys(object(before)?before:{}),...Object.keys(object(after)?after:{})])].flatMap(k=>changedPaths(before?.[k],after?.[k],[...prefix,k]));
 return JSON.stringify(before)===JSON.stringify(after)?[]:[prefix];
}
export function canEditTrackingField(role,group,key){
 role=effectiveRole(role);
 if(role==='admin'||role===undefined)return true;
 if(role==='shipping')return group==='bulk'&&shippingBulk.has(key);
 if(role==='assistant')return !(group==='bulk'&&key.startsWith('shipment')||group==='internalFields'&&shippingInternal.has(key));
 return false;
}
export function assertRecordPermission(role,kind,before,after){
 role=effectiveRole(role);
 const paths=changedPaths(before,after);
 if(!paths.length||role==='admin')return;
 let allowed=false;
 if(role==='shipping')allowed=kind==='shipments'||kind==='tracking'&&paths.every(p=>p.length===2&&canEditTrackingField(role,p[0],p[1]));
 if(role==='assistant')allowed=['orders','developments','productNotes','productMappings','classificationOptions','removedOrders'].includes(kind)||kind==='tracking'&&paths.every(p=>canEditTrackingField(role,p[0],p[1]||''));
 if(!allowed){const e=new Error(role==='shipping'?'船務只能修改出貨作業及出貨追蹤欄位。':role==='assistant'?'業務助理不能修改出貨作業及出貨追蹤欄位。':'此帳號只能瀏覽，沒有修改權限。');e.code='FORBIDDEN';throw e;}
}
