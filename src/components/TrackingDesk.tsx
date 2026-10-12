import {useState} from 'react';
import type {Workspace,TrackingRecord} from '../utils/workspace';
import {bulkPhases,internalLabels,columnKey,overallCheck} from '../utils/trackingFields';
import {customerRows,internalValues,buildCustomerBulk,buildInternalTracking} from '../utils/trackingDocuments';
import {saveWorkbookToFile} from '../utils/excelExport';
import {applyTrackingStage} from '../utils/trackingAutomation';

export function TrackingDesk({rows,workspace,onChange,onDownload}:{rows:TrackingRecord[];workspace:Workspace;onChange:(w:Workspace)=>void;onDownload:(f:{url:string;filename:string})=>void}){
 const [mode,setMode]=useState<'internal'|'customer'>('internal'),[season,setSeason]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0),[week,setWeek]=useState(new Date().toLocaleDateString('en-CA')),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const base=rows.filter(r=>(!season||r.season===season)&&[r.poNumber,r.scNumber,r.itemNo,r.brand,r.supplier].join(' ').toLowerCase().includes(search.toLowerCase()));
 const list=mode==='customer'?customerRows(base,workspace.orders,workspace.tracking):base;
 const update=(r:TrackingRecord,group:'bulk'|'internalFields',key:string,value:string)=>{
  const prior=workspace.tracking[r.id]||{};
  const linked:Record<string,string>={A:'scNumber',B:'poNumber',C:'season',E:'brand',F:'company',J:'supplier',T:'customerDate',U:'factoryDate'};
  const next={...workspace,tracking:{...workspace.tracking,[r.id]:{...prior,...(group==='internalFields'&&linked[key]?{[linked[key]]:value}:{}),[group]:{...prior[group],[key]:value,...(group==='internalFields'&&['H','L','M','N'].includes(key)?{['_scope'+key]:r.id}: {})}}}};
  if(group==='internalFields'&&key==='AD'){onChange(applyTrackingStage(next,[r],'pps',value,value?'APPROVED':''));return;}
  if(group==='bulk'&&/^pps(Date|Status)$/.test(key)){onChange(applyTrackingStage(next,[r],'pps',key==='ppsDate'?value:r.bulk?.ppsDate||'',key==='ppsStatus'?value:r.bulk?.ppsStatus||''));return;}
  onChange(next);
 };
 const exportFile=async()=>{setBusy(true);setError('');try{const wb=mode==='customer'?buildCustomerBulk(list,[],week):buildInternalTracking(base);onDownload(await saveWorkbookToFile(wb,`${mode==='customer'?'CSQ_Bulk_Status':'CSQ_內部訂單追蹤'}_${week}.xlsx`));}catch{setError('匯出失敗，請重試。');}finally{setBusy(false);}};
 const field=(r:TrackingRecord,group:'bulk'|'internalFields',key:string,label:string,value:string,type='text')=>{const imported=workspace.orders.some(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber);const automatic=group==='internalFields'&&(key==='V'||['AK','AO','AP','AQ'].includes(key)||(imported&&['A','B','H','I','J','K','O','P','R','S','T','U'].includes(key)));return <label className="desk-field" key={key}><span>{label}{automatic?'（自動）':''}</span><input aria-label={`${r.poNumber} ${r.itemNo} ${label}`} type={type} value={value} readOnly={automatic} onChange={e=>update(r,group,key,e.target.value)}/></label>;};
 return <>
  <div className="desk-tabs"><button className={mode==='internal'?'active':''} onClick={()=>{setMode('internal');setPage(0);}}>內部訂單追蹤</button><button className={mode==='customer'?'active':''} onClick={()=>{setMode('customer');setPage(0);}}>客戶 Bulk Status</button></div>
  <div className="desk-toolbar"><input aria-label="搜尋追蹤訂單" placeholder="搜尋 PO、品號、工廠" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/><select aria-label="追蹤季別" value={season} onChange={e=>{setSeason(e.target.value);setPage(0);}}><option value="">所有季別</option>{[...new Set(['SS27',...rows.map(r=>r.season).filter(Boolean)])].sort().map(s=><option key={s}>{s}</option>)}</select><label>每週報告日期 <input aria-label="每週報告日期" type="date" value={week} onChange={e=>setWeek(e.target.value)}/></label><span>{list.length} 筆</span><button className="desk-button" disabled={busy||!list.length||!week} onClick={()=>void exportFile()}>匯出{mode==='internal'?'內部追蹤':'客戶 Bulk Status'} Excel</button></div>
  <p className="desk-hint">{mode==='internal'?'內部模式含原始進度表全部 46 欄、價格及利潤。合併金額維持原始群組，未填資料留白，幣別或匯率未確認時不另計算利潤。':'客戶模式匯出 45 欄進度及每週 CONTROL，不含成本、利潤、收付款及本機來源。每階段分開填日期與狀態，未經確認不會自動完成。'} SS27 初始為尚未出貨；預計船期不代表實際出貨。</p>
  {error&&<p role="alert" className="csq-alert">{error}</p>}
  {list.slice(page*15,page*15+15).map(r=><section className="csq-panel" key={r.id}><div className="csq-panel-heading"><h2>{r.itemNo} {r.color||''}</h2><span>{r.poNumber} · {r.scNumber} · {r.quantity.toLocaleString()} {r.unit} · {r.season} {mode==='customer'?overallCheck(r.bulk):r.status}</span></div>
   {mode==='internal'?<details><summary>查看及維護全部內部欄位</summary><div className="csq-field-grid">{internalLabels.map((label,i)=>{const key=columnKey(i);return field(r,'internalFields',key,label,internalValues(r)[key]||'');})}</div><p className="desk-hint">資料來源：{r.source}。價格及利潤可能為訂單或工廠合計，非每款單價。</p></details>:<>
    <div className="csq-field-grid">{[['supplierName','Supplier Name',"SPORTS KITE INT'L CO., LTD."],['brand','Brand',r.brand],['color','Colour',r.color||''],['orderCompany','Order Company',r.internalFields?.G||r.company],['customerDate','ETD on PO',r.customerDate],['confirmedDate','ETD Confirmed',''],['factoryName','Factory Name (BSCI)',r.internalFields?.K||r.supplier],['contact','Cisalfa Product Contact',''],['customerItem','Item Number',r.customerItem||''],['description','Product Description',r.description||'']].map(([key,label,fallback])=>field(r,'bulk',key,label,r.bulk?.[key]??fallback))}</div>
    <details><summary>維護生產、測試與出貨進度</summary><div className="csq-field-grid">{bulkPhases.map(([key,label,,statuses])=><div key={key} className="csq-panel">{field(r,'bulk',key+'Date',label+' Date',r.bulk?.[key+'Date']||'','date')}<label className="desk-field"><span>{label} Status</span><select aria-label={`${r.poNumber} ${r.itemNo} ${label} Status`} value={r.bulk?.[key+'Status']||''} onChange={e=>update(r,'bulk',key+'Status',e.target.value)}><option value="">待填</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>{key==='shippingSample'&&field(r,'bulk','shippingApprovalDate','Cisalfa Approval Date',r.bulk?.shippingApprovalDate||'','date')}</div>)}</div></details><p className="desk-hint">面料測試必須核准才能 READY。Shipping Sample 匯出時同款只顯示一次，請在該款第一筆維護。</p>
   </>}
  </section>)}
  {!list.length&&<p className="desk-empty">沒有符合條件的訂單。可切換季別或先匯入 PO。</p>}
  <div className="desk-pagination"><button disabled={!page} onClick={()=>setPage(page-1)}>上一頁</button><span>{page+1} / {Math.max(1,Math.ceil(list.length/15))}</span><button disabled={(page+1)*15>=list.length} onClick={()=>setPage(page+1)}>下一頁</button></div>
 </>;
}
