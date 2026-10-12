import {newId} from '../utils/uid';
import type {OrderData} from '../types/order';
import {chineseFactoryName} from '../utils/csqAccount';
export function FactoryPurchaseSettings({order,factory,groupId,onChange}:{order:OrderData;factory:OrderData;groupId:string;onChange:(order:OrderData)=>void}){
 const options=order.factoryPurchaseOptions?.[groupId]||{extraFees:factory.factoryExtraFees||[],hasDeposit:!!factory.hasDeposit,depositPercent:factory.depositPercent||0};
 const update=(patch:Partial<typeof options>)=>onChange({...order,factoryPurchaseOptions:{...order.factoryPurchaseOptions,[groupId]:{...options,...patch}}});
 const currency=factory.factoryCurrency||'RMB',subtotal=factory.items.reduce((sum,item)=>sum+item.totalQuantity*(currency==='USD'?item.factoryUnitPriceUSD||0:item.unitPriceRMB),0),extra=options.extraFees.reduce((sum,fee)=>sum+fee.amount,0),total=Math.round((subtotal+extra)*100)/100,deposit=options.hasDeposit?Math.round(total*options.depositPercent)/100:0;
 const format=(amount:number)=>`${currency} ${amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 return <div className="factory-purchase-settings"><h3>這家工廠的採購設定</h3><div className="csq-field-grid">
  <label>工廠中文名稱<input aria-label="工廠中文名稱" value={options.chineseName??chineseFactoryName(factory.factorySupplier)} onChange={e=>update({chineseName:e.target.value})}/></label>
  <label>是否支付訂金<select aria-label="是否支付訂金" value={options.hasDeposit?'yes':'no'} onChange={e=>update({hasDeposit:e.target.value==='yes'})}><option value="no">無訂金</option><option value="yes">有訂金</option></select></label>
  {options.hasDeposit&&<label>訂金比例（%）<input aria-label="工廠訂金比例" type="number" min="0" max="100" step="0.01" value={options.depositPercent} onChange={e=>update({depositPercent:Math.min(100,Math.max(0,Number(e.target.value)||0))})}/></label>}
 </div><h3>額外費用（{currency}）</h3><p>例如打樣費、測試費或運費；費用加入這家工廠的採購總額。</p>
 {options.extraFees.map((fee,index)=><div className="factory-fee-row" key={fee.id}><label>費用名稱<input aria-label={`額外費用 ${index+1} 名稱`} value={fee.description} onChange={e=>update({extraFees:options.extraFees.map(f=>f.id===fee.id?{...f,description:e.target.value}:f)})}/></label><label>金額（{currency}）<input aria-label={`額外費用 ${index+1} 金額`} type="number" min="0" step="0.01" value={fee.amount} onChange={e=>update({extraFees:options.extraFees.map(f=>f.id===fee.id?{...f,amount:Math.max(0,Number(e.target.value)||0)}:f)})}/></label><button onClick={()=>update({extraFees:options.extraFees.filter(f=>f.id!==fee.id)})} aria-label={`移除額外費用 ${index+1}`}>移除</button></div>)}
 <button onClick={()=>update({extraFees:[...options.extraFees,{id:newId(),description:'',amount:0}]})}>＋ 新增額外費用</button>
 <div className="factory-money-summary"><span>貨款 {format(subtotal)}</span><span>額外費用 {format(extra)}</span><strong>採購總額 {format(total)}</strong>{options.hasDeposit&&<><span>訂金（{options.depositPercent}%）{format(deposit)}</span><span>餘款 {format(total-deposit)}</span></>}</div>
 <small>設定只套用此訂單所選的工廠、幣別與數量單位，會隨訂單保存。訂金依含額外費用的採購總額計算。</small></div>;
}
