import {useEffect,useMemo,useState} from 'react';
import type {TrackingRecord} from '../utils/workspace';
import {customerTemplatePreview} from '../utils/customerBulkTemplate';
import {bulkOrderLabels,bulkPhases,overallCheck} from '../utils/trackingFields';

const labels=[...bulkOrderLabels];
for(const [key,name,date] of bulkPhases){if(key==='cutting')labels.push('OVERALL CHECK');labels.push(`${name} / ${date}`,`${name} / STATUS`);if(key==='shippingSample')labels.push('CISALFA APPROVAL DATE');}
const dates=new Set([6,7,13,15,17,19,21,23,25,27,29,32,34,36,38,39,41,43]);
const views=[{id:'order',label:'品號與訂單',cols:[2,3,11,8,4,0,1,9,10,12,5,6,7]},{id:'sample',label:'樣品與面料',cols:[2,3,4,...Array.from({length:19},(_,i)=>i+13)]},{id:'production',label:'生產與出貨',cols:[2,3,4,8,...Array.from({length:14},(_,i)=>i+31)]},{id:'all',label:'全部欄位',cols:Array.from({length:45},(_,i)=>i)}];
function display(value:string|number|null,col:number){
 if(value===null||value==='')return '';
 if(typeof value==='number'&&dates.has(col)){const d=new Date(Date.UTC(1899,11,30)+value*86400000);return `${String(d.getUTCDate()).padStart(2,'0')}-${d.toLocaleString('en',{month:'short',timeZone:'UTC'})}-${d.getUTCFullYear()}`;}
 return typeof value==='number'?value.toLocaleString('en-US'):value;
}
export function CustomerBulkPreview({rows,directory,week,onClose}:{rows:TrackingRecord[];directory:TrackingRecord[];week:string;onClose:()=>void}){
 const [view,setView]=useState('order'),[page,setPage]=useState(0);
 const data=useMemo(()=>{try{return {...customerTemplatePreview(rows,week,directory),error:''};}catch(e){return {rows:[],missingFactories:[],error:e instanceof Error?e.message:'預覽無法載入'};}},[rows,directory,week]);
 useEffect(()=>setPage(0),[rows,view]);
 const cols=views.find(v=>v.id===view)!.cols,pages=Math.max(1,Math.ceil(data.rows.length/50)),current=Math.min(page,pages-1),start=current*50;
 return <section className="bulk-export-preview" aria-label="客戶進度表匯出預覽"><div className="bulk-preview-heading"><div><h2>客戶進度表預覽</h2><p>隨上方篩選更新，與匯出使用同一份資料。預覽依檢查項目分組；Excel 匯出維持原表格式、欄序與公式。</p></div><button className="desk-button" onClick={onClose}>關閉預覽</button></div>
 <div className="bulk-preview-controls"><div className="desk-tabs" aria-label="預覽欄位範圍">{views.map(v=><button key={v.id} className={view===v.id?'active':''} aria-pressed={view===v.id} onClick={()=>setView(v.id)}>{v.label}</button>)}</div><span>{data.rows.length.toLocaleString()} 筆明細 · 合計 {rows.reduce((n,r)=>n+r.quantity,0).toLocaleString()}（PO 單位）</span></div>
 {data.error&&<p className="csq-alert" role="alert">{data.error}</p>}
 {!!data.missingFactories.length&&<p className="csq-alert">{data.missingFactories.length} 筆尚缺英文工廠名稱，已在預覽標示「待補英文名稱」；請在客戶資料編輯補齊後匯出。</p>}
 {data.rows.length>995&&<p className="csq-alert">目前超過原表 995 筆容量，匯出前請縮小篩選範圍。</p>}
 <div className="bulk-preview-scroll" tabIndex={0} aria-label="客戶進度預覽表，可左右捲動"><table><thead><tr>{cols.map(c=><th key={c} className={c===11?'bulk-preview-item':''}>{labels[c]}</th>)}</tr></thead><tbody>{data.rows.slice(start,start+50).map((line,i)=><tr key={start+i}>{cols.map(c=>{const value=c===31?overallCheck(rows[start+i]?.bulk):line[c],shown=c===9&&!value?'待補英文名稱':display(value,c);return <td key={c} className={`${c<13?'bulk-preview-order':'bulk-preview-stage'} ${c===11?'bulk-preview-item':''} ${c===8?'bulk-preview-number':''} ${c===9&&!value?'bulk-preview-missing':''} ${c===31&&value==='READY'?'bulk-preview-ready':''}`}>{shown}</td>;})}</tr>)}</tbody></table>{!data.rows.length&&!data.error&&<p className="desk-empty">目前篩選沒有訂單，請調整上方條件。</p>}</div>
 <div className="bulk-preview-pagination"><span>{data.rows.length?`${start+1}–${Math.min(start+50,data.rows.length)} / ${data.rows.length} 筆`:'0 筆'} · 可左右捲動查看欄位</span><div><button className="desk-button" disabled={current===0} onClick={()=>setPage(current-1)}>上一頁</button><span>{current+1} / {pages}</span><button className="desk-button" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>下一頁</button></div></div>
 </section>;
}
