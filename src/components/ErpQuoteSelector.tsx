import type { OrderData } from '../types/order';
import { erpQuoteKey, productQuotes, type ErpSnapshot } from '../utils/erpProducts';
import {chineseFactoryName} from '../utils/csqAccount';

interface Props {
  order: OrderData; snapshot: ErpSnapshot | null; choices: Record<string,string>;
  onChange: (style:string,key:string)=>void; onApply: ()=>void; busy:boolean;
}
const quoteDate = (value:string) => /^\d{8}$/.test(value)?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6)}`:value||'日期未填';
export function ErpQuoteSelector({order,snapshot,choices,onChange,onApply,busy}:Props) {
  if (!order.erpFactoryApplied || !snapshot) return null;
  const styles = [...new Set(order.items.map(i=>i.itemNo.trim().toUpperCase()))];
  const rows = styles.map(style=>{
    const items=order.items.filter(i=>i.itemNo.trim().toUpperCase()===style);
    const product=snapshot.products.find(p=>p.itemNo.trim().toUpperCase()===style);
    return {style,items,quotes:product?productQuotes(product):[]};
  }).filter(r=>r.quotes.length>1 || r.items.some(i=>!i.factoryProduct));
  if (!rows.length) return null;
  const pending=rows.filter(r=>r.items.some(i=>!i.factoryProduct)).length;
  return <div className="csq-quote-selection">
    <h3>選擇工廠報價{pending>0?` · ${pending} 款待確認`:''}</h3>
    <p>同一工廠可能有不同日期的報價。請依此訂單選用的工廠、單價及日期確認，再按「套用所選報價」。同款所有顏色一起帶入。</p>
    <div className="csq-quote-table"><table><thead><tr><th>款號</th><th>PO 數量</th><th>工廠／幣別／單價／報價日期</th><th>目前狀態</th></tr></thead><tbody>{rows.map(r=>{
      const key=choices[r.style]??r.items[0].erpQuoteKey??'';
      return <tr key={r.style}><td>{r.style}</td><td>{r.items.reduce((sum,i)=>sum+i.totalQuantity,0).toLocaleString()}</td><td>{r.quotes.length?<select aria-label={`${r.style} 工廠報價`} disabled={busy} value={key} onChange={e=>onChange(r.style,e.target.value)}><option value="">請選擇此訂單使用的報價</option>{r.quotes.map(q=><option key={erpQuoteKey(q)} value={erpQuoteKey(q)}>{q.supplierCode} · {q.factoryCurrency} {q.factoryPrice??'缺成本'}/{q.purchaseUom||'單位待確認'} · {quoteDate(q.quoteDate)} · {chineseFactoryName(q.factorySupplier)}</option>)}</select>:<span>ERP 未提供可選報價，請確認產品報價資料後更新。</span>}</td><td>{Object.prototype.hasOwnProperty.call(choices,r.style)?'尚未套用':r.items.every(i=>i.factoryProduct)?'已帶入':'待選擇報價'}</td></tr>;
    })}</tbody></table></div>
    <button disabled={busy||!Object.keys(choices).length} onClick={onApply}>{busy?'帶入中…':'套用所選報價'}</button>
  </div>;
}
