import type {Workspace,TrackingRecord} from '../utils/workspace';
import {bulkPhases,internalLabels,columnKey} from '../utils/trackingFields';
import {internalValues} from '../utils/trackingDocuments';
import {updateTrackingInput} from '../utils/trackingProgress';

const progressLabels:Record<string,string>={tp:'TP 最終資料',labDip:'色卡',trims:'配件 Trim',careLabel:'洗標',fabricInHouse:'面料入庫',paperPattern:'紙樣',fitSample:'Fit Sample',pps:'產前樣 PPS',fabricTest:'面料測試',cutting:'裁剪',sewing:'車縫',shippingSample:'船樣',packing:'包裝',inspection:'Final 驗貨',shipment:'出貨'};
const duplicated=new Set(['W','AA','AB','AC','AD','AF','AH']);
export function TrackingDesk({rows,workspace,onChange}:{rows:TrackingRecord[];workspace:Workspace;onChange:(w:Workspace)=>void;onDownload?:(f:{url:string;filename:string})=>void}){
 const edit=(r:TrackingRecord,group:'bulk'|'internalFields',key:string,value:string)=>onChange(updateTrackingInput(workspace,r,group,key,value));
 return <>{rows.map(r=><div key={r.id}>
  <p className="desk-hint">進度只填一次，內部追蹤、客戶進度表及兩種原表匯出同步帶入。已確認出貨由出貨作業自動更新。</p>
  <div className="tracking-unified-progress">{bulkPhases.filter(([phase])=>phase!=='shipment').map(([phase,,,statuses])=><section className="tracking-progress-field" key={phase}>
   <strong>{progressLabels[phase]}</strong>
   <label className="desk-field"><span>{phase==='pps'?'寄樣日期':'日期'}</span><input aria-label={`${r.poNumber} ${r.itemNo} ${progressLabels[phase]}日期`} type="date" value={r.bulk?.[phase+'Date']||''} onChange={e=>edit(r,'bulk',phase+'Date',e.target.value)}/></label>
   <label className="desk-field"><span>狀態</span><select aria-label={`${r.poNumber} ${r.itemNo} ${progressLabels[phase]}狀態`} value={r.bulk?.[phase+'Status']||''} onChange={e=>edit(r,'bulk',phase+'Status',e.target.value)}><option value="">待填</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
   {phase==='pps'&&r.bulk?.ppsStatus==='APPROVED'&&<label className="desk-field"><span>確認日期</span><input type="date" aria-label={`${r.poNumber} ${r.itemNo} PPS確認日期`} value={r.bulk?.ppsApprovalDate||r.internalFields?.AD||''} onChange={e=>edit(r,'bulk','ppsApprovalDate',e.target.value)}/></label>}
   {phase==='shippingSample'&&<label className="desk-field"><span>客人核准日期</span><input type="date" aria-label={`${r.poNumber} ${r.itemNo} 船樣核准日期`} value={r.bulk?.shippingApprovalDate||''} onChange={e=>edit(r,'bulk','shippingApprovalDate',e.target.value)}/></label>}
  </section>)}</div>
  <details className="desk-source"><summary>客戶專用資料</summary><div className="csq-field-grid">{[['confirmedDate','確認出貨日'],['factoryName','Factory Name（英文）'],['contact','客戶聯絡人'],['customerItem','Item Number'],['description','Product Description']].map(([key,label])=><label className="desk-field" key={key}><span>{label}</span><input aria-label={label} value={r.bulk?.[key]||''} onChange={e=>edit(r,'bulk',key,e.target.value)}/></label>)}</div></details>
  <details className="desk-source"><summary>其他內部欄位（含金額與收付款）</summary><div className="csq-field-grid">{internalLabels.map((label,i)=>{const key=columnKey(i);if(duplicated.has(key))return null;const automatic=['A','B','H','I','J','K','O','P','R','S','T','U','V','AK','AO','AP','AQ'].includes(key);return <label className="desk-field" key={key}><span>{label}{automatic?'（自動）':''}</span><input aria-label={`${r.poNumber} ${r.itemNo} ${label}`} readOnly={automatic} value={internalValues(r)[key]||''} onChange={e=>edit(r,'internalFields',key,e.target.value)}/></label>;})}</div></details>
 </div>)}</>;
}
