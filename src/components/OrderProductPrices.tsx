import {pricingCode} from '../utils/sizeVariants';
import React,{useState} from 'react';
import type {OrderData} from '../types/order';
import type {Workspace} from '../utils/workspace';
import type {ErpSnapshot} from '../utils/erpProducts';
import {productPriceHistory} from '../utils/productPriceHistory';
import {applyProductPrice} from '../utils/orderProductPrices';
export function OrderProductPrices({order,w,erp,onChange}:{order:OrderData;w:Workspace;erp:ErpSnapshot|null;onChange:(o:OrderData)=>void}){
 const [selected,setSelected]=useState<Record<string,string>>({}),[message,setMessage]=useState('');
 const apply=(style:string)=>{try{onChange(applyProductPrice(order,style,selected[style],w,erp));setSelected(v=>({...v,[style]:''}));setMessage('已保存此訂單選用的價格；其他訂單及歷史價格保留。');}catch(e){setMessage(e instanceof Error?e.message:'套用失敗');}};
 return <details className="csq-panel"><summary>選用產品歷史價格／更換工廠</summary><p className="desk-hint">先核對客戶／工廠、日期、幣別及單位，再按套用。客戶價格將留下 PO 更正紀錄；工廠價格會保存為此訂單的採購價。</p>{message&&<p role="status">{message}</p>}<div className="csq-table-scroll"><table className="csq-table"><thead><tr><th>款號</th><th>目前客戶價／工廠價</th><th>歷史價格（選擇後套用）</th><th/></tr></thead><tbody>{[...new Set(order.items.map(i=>pricingCode(i)))].map(style=>{const item=order.items.find(i=>pricingCode(i)===style)!;const qs=productPriceHistory(style,w,erp).filter(q=>!w.productNotes[style]?.withdrawnPrices?.[q.id]);return <tr key={style}><td>{style}</td><td>USD {item.unitPriceUSD}<small>{item.factoryProduct?`${item.factoryProduct.supplierCode} ${item.factoryProduct.currency} ${item.factoryProduct.price}`:'工廠待選'}</small></td><td><select aria-label={`${style} 歷史價格`} value={selected[style]||''} onChange={e=>setSelected(v=>({...v,[style]:e.target.value}))}><option value="">選擇客戶或工廠價格</option>{qs.map(q=><option key={q.id} value={q.id}>{q.kind==='factory'?'工廠':'客戶'} · {q.party} · {q.date||'日期待補'} · {q.currency} {q.price}/{q.unit||'單位待補'} · {q.source}</option>)}</select></td><td><button className="desk-button" disabled={!selected[style]} onClick={()=>apply(style)}>套用此訂單價格</button></td></tr>;})}</tbody></table></div></details>;
}
