import {useMemo,useState} from 'react';
import {Search,ArrowRight,SlidersHorizontal} from 'lucide-react';
import type {OrderData} from '../types/order';
import type {Workspace,ReferenceSnapshot} from '../utils/workspace';
import type {ErpSnapshot} from '../utils/erpProducts';
import {compareSeasons} from '../utils/classification';
import {orderOverviewRows,filterOrderOverview,overviewParts,overviewDate,type OrderOverviewFilters} from '../utils/orderOverview';
export const defaultOrderOverviewFilters:OrderOverviewFilters={query:'',season:'',brand:'',series:'',quarter:'',company:'',factory:'',sort:'po'};
const displayDate=(value:string)=>{const d=overviewDate(value);return d?d.replaceAll('-','/'):value||'—';};
const amount=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export function OrderOverview({workspace,references,erp,onOpen,filters,onFiltersChange,readOnly=false,loading=false,error=''}:{workspace:Workspace;references:ReferenceSnapshot|null;erp:ErpSnapshot|null;onOpen:(o:OrderData)=>void;filters:OrderOverviewFilters;onFiltersChange:(f:OrderOverviewFilters)=>void;readOnly?:boolean;loading?:boolean;error?:string}){
 const [page,setPage]=useState(0);
 const all=useMemo(()=>orderOverviewRows(workspace,references,erp),[workspace,references,erp]),visible=useMemo(()=>filterOrderOverview(all,filters),[all,filters]);
 const lastPage=Math.max(0,Math.ceil(visible.length/25)-1),current=Math.min(page,lastPage),shown=visible.slice(current*25,current*25+25),quantity=visible.reduce((n,r)=>n+r.quantity,0),total=visible.reduce((n,r)=>n+(r.amount??0),0),missing=visible.filter(r=>r.amount===null).length;
 const set=(key:keyof OrderOverviewFilters,value:string)=>{onFiltersChange({...filters,[key]:value,...(key==='brand'?{series:''}:{})});setPage(0);};
 const choices=[['season','季別',overviewParts(all.flatMap(r=>r.seasons)).sort((a,b)=>compareSeasons(b,a))],['brand','品牌',overviewParts(all.flatMap(r=>r.brands)).sort()],['series','系列',overviewParts(all.filter(r=>!filters.brand||r.brands.includes(filters.brand)).flatMap(r=>r.series)).sort()],['quarter','下單季度',overviewParts(all.map(r=>r.quarter)).sort().reverse()],['company','下單公司',overviewParts(all.map(r=>r.order.orderingCompany||r.order.customerName)).sort()],['factory','工廠',overviewParts(all.flatMap(r=>r.factories)).sort()]] as const;
 return <section className="order-overview" aria-label="訂單總覽">
  <div className="order-overview-tools"><label className="order-overview-search"><Search size={18}/><input aria-label="搜尋訂單總覽" value={filters.query} placeholder="搜尋 PO、S/C、款號或工廠代碼" onChange={e=>set('query',e.target.value)}/></label><label className="order-overview-sort"><SlidersHorizontal size={16}/><select aria-label="訂單總覽排序篩選" value={filters.sort} onChange={e=>set('sort',e.target.value)}><option value="po">PO 編號＋匯入日期</option><option value="date">客人下單日：新到舊</option></select></label></div>
  <div className="order-overview-filters">{choices.map(([key,label,values])=><label key={key}><span>{label}</span><select aria-label={`總覽${label}篩選`} value={filters[key]} onChange={e=>set(key,e.target.value)}><option value="">全部{label}</option>{values.map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}<button className="desk-button" onClick={()=>{onFiltersChange(defaultOrderOverviewFilters);setPage(0);}}>重設篩選</button></div>
  {loading&&<p className="desk-hint" role="status">正在載入訂單資料…</p>}{error&&<p className="csq-alert" role="alert">{error}；目前僅顯示已載入的訂單。</p>}
  <div className="order-overview-summary"><div><span>符合條件的訂單</span><strong>{visible.length.toLocaleString()}<small>張 PO</small></strong></div><div><span>客人 PO 數量</span><strong>{quantity.toLocaleString()}<small>PCS</small></strong></div><div><span>客戶金額 USD</span><strong>{amount(total)}</strong>{missing>0&&<small>{missing} 張金額待確認</small>}</div></div>
  <section className="order-overview-list"><header><div><h2>{Object.entries(filters).some(([k,v])=>k!=='sort'&&v)?'篩選訂單':'全部訂單'}</h2><p>一列一張 PO，編輯後沿用至訂單追蹤與出貨。</p></div><span>{filters.sort==='po'?'依 PO 編號、匯入日期排序':'依客人下單日期排序'}</span></header>
   <div className="order-overview-scroll comfortable-list"><table className="comfortable-table" aria-label="訂單總覽明細"><thead><tr>{['訂單／編輯','品牌／季別','交期','工廠','數量／金額'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{shown.map(r=><tr key={r.order.poNumber}>
    <td data-label="訂單"><button className="order-overview-link" aria-label={`${readOnly?'查看':'編輯'} PO ${r.order.poNumber}`} onClick={()=>onOpen(r.order)}>{r.order.poNumber}</button><small>{r.order.piNumber||'—'} · {r.styles} 款</small><small>{r.order.orderingCompany||r.order.customerName}</small><button className="desk-button row-edit-button" aria-label={`${readOnly?'查看':'編輯'}訂單 ${r.order.poNumber}`} onClick={()=>onOpen(r.order)}>{readOnly?'查看':'編輯訂單'}<ArrowRight size={14}/></button></td>
    <td data-label="品牌／季別"><strong>{r.brands.join(' / ')||'待補品牌'}</strong><small>{r.series.join(' / ')||'待補系列'}</small><span className="order-overview-season">{r.seasons.join(' / ')||'待補季別'}</span></td>
    <td data-label="交期"><dl className="row-facts"><div><dt>下單</dt><dd>{displayDate(r.orderDate||r.order.poDate)}</dd></div><div><dt>客人出貨</dt><dd>{displayDate(r.order.shipmentDate)}</dd></div><div><dt>工廠交期</dt><dd>{r.factoryDates.length?r.factoryDates.map(d=><span className="order-overview-date" key={d}>{displayDate(d)}</span>):'—'}</dd></div></dl></td>
    <td data-label="工廠代碼">{r.factories.join(' / ')||'待指定'}</td>
    <td data-label="數量／金額"><dl className="row-facts"><div><dt>PCS</dt><dd>{r.quantity.toLocaleString()}</dd></div><div><dt>USD</dt><dd>{r.amount===null?'待確認':amount(r.amount)}</dd></div></dl></td>
   </tr>)}{!shown.length&&<tr><td className="order-overview-empty" colSpan={5}>{all.length?'沒有符合的訂單，請調整搜尋或重設篩選。':loading?'正在載入訂單…':'目前沒有訂單，請先匯入 PO。'}</td></tr>}</tbody></table></div>
   <footer><span>顯示 {visible.length?current*25+1:0}–{Math.min((current+1)*25,visible.length)}／{visible.length} 張 PO</span><div><button className="desk-button" disabled={current===0} onClick={()=>setPage(current-1)}>上一頁</button><span>{current+1}／{lastPage+1}</span><button className="desk-button" disabled={current===lastPage} onClick={()=>setPage(current+1)}>下一頁</button></div></footer>
  </section>
 </section>;
}
