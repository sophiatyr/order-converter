import {useEffect,useMemo,useState} from 'react';
import type {TrackingRecord,Workspace} from '../utils/workspace';
import {internalTemplatePayload} from '../utils/internalTrackingTemplate';
import {internalLabels} from '../utils/trackingFields';

const views=[
 {id:'order',label:'訂單與交期',cols:[0,1,14,15,16,2,3,4,9,10,19,20,21]},
 {id:'sample',label:'樣品與生產',cols:[1,14,...Array.from({length:14},(_,i)=>22+i)]},
 {id:'shipment',label:'出貨與收付款',cols:[1,14,...Array.from({length:10},(_,i)=>36+i)]},
 {id:'financial',label:'訂單金額',cols:[0,1,14,9,7,8,11,12,13]},
 {id:'all',label:'全部欄位',cols:Array.from({length:46},(_,i)=>i)},
];
const numeric=new Set([7,11,12,13,15,21,41]);
function display(value:string|number|null,col:number){
 if(value===null||value==='')return '';
 if(typeof value==='number'&&!numeric.has(col)){return new Date(Date.UTC(1899,11,30)+value*86400000).toISOString().slice(0,10);}
 if(typeof value==='number')return col===13?`${(value*100).toFixed(2)}%`:value.toLocaleString('en-US',{maximumFractionDigits:2});
 return value;
}
export function InternalTrackingPreview({rows,directory,workspace,onClose}:{rows:TrackingRecord[];directory:TrackingRecord[];workspace:Workspace;onClose:()=>void}){
 const [view,setView]=useState('order'),[page,setPage]=useState(0);
 const data=useMemo(()=>{if(!rows.length)return {rows:[],error:''};try{return {...internalTemplatePayload(rows,directory,workspace),error:''};}catch(e){return {rows:[],error:e instanceof Error?e.message:'預覽無法載入'};}},[rows,directory,workspace]);
 useEffect(()=>setPage(0),[rows,view]);
 const cols=views.find(v=>v.id===view)!.cols,pages=Math.max(1,Math.ceil(data.rows.length/50)),current=Math.min(page,pages-1),start=current*50;
 return <section className="bulk-export-preview" aria-label="內部訂單追蹤匯出預覽">
  <div className="bulk-preview-heading"><div><h2>內部訂單追蹤預覽</h2><p>依上方篩選帶入完整 PO，與匯出使用同一份資料。可切換欄位並左右捲動；Excel 仍沿用指定原表格式，公式由 Excel 重新計算。</p></div><button className="desk-button" onClick={onClose}>關閉內部預覽</button></div>
  <div className="bulk-preview-controls"><div className="desk-tabs" aria-label="內部預覽欄位範圍">{views.map(v=><button key={v.id} className={view===v.id?'active':''} aria-pressed={view===v.id} onClick={()=>setView(v.id)}>{v.label}</button>)}</div><span>{data.rows.length.toLocaleString()} 筆明細</span></div>
  {data.error&&<p className="csq-alert" role="alert">{data.error}</p>}
  <div className="bulk-preview-scroll" tabIndex={0} aria-label="內部訂單預覽表，可左右捲動"><table><thead><tr>{cols.map(c=><th key={c}>{internalLabels[c]}</th>)}</tr></thead><tbody>{data.rows.slice(start,start+50).map(r=><tr key={r.id}>{cols.map(c=><td key={c} className={numeric.has(c)?'bulk-preview-number':''}>{display(r.values[c],c)}</td>)}</tr>)}</tbody></table>{!data.rows.length&&!data.error&&<p className="desk-empty">目前篩選沒有訂單，請調整上方條件。</p>}</div>
  <div className="bulk-preview-pagination"><span>{data.rows.length?`${start+1}–${Math.min(start+50,data.rows.length)} / ${data.rows.length} 筆`:'0 筆'} · 可左右捲動查看欄位</span><div><button className="desk-button" disabled={current===0} onClick={()=>setPage(current-1)}>上一頁</button><span>{current+1} / {pages}</span><button className="desk-button" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>下一頁</button></div></div>
 </section>;
}
