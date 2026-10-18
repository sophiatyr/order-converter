import type {DocumentTemplates} from '../utils/referenceDocuments';
import {factoryTermsReference,withFactoryReferenceTerms,referenceFactoryTerms} from '../utils/factoryReferenceTerms';
import {newId} from '../utils/uid';
import type {OrderData} from '../types/order';
import {chineseFactoryName} from '../utils/csqAccount';
export function FactoryPurchaseSettings({order,factory,groupId,templates,onChange}:{order:OrderData;factory:OrderData;groupId:string;templates:DocumentTemplates|null;onChange:(order:OrderData)=>void}){
 const reference=templates?factoryTermsReference(templates,factory):undefined;
 const resolved=templates?withFactoryReferenceTerms(templates,factory):factory;
 const saved=order.factoryPurchaseOptions?.[groupId];
 const options={...(saved||{extraFees:factory.factoryExtraFees||[],hasDeposit:!!factory.hasDeposit,depositPercent:resolved.depositPercent||0}),hasDeposit:saved?.hasDeposit??resolved.hasDeposit??false,depositPercent:saved?.depositPercent??resolved.depositPercent??0};
 const update=(patch:Partial<typeof options>)=>onChange({...order,factoryPurchaseOptions:{...order.factoryPurchaseOptions,[groupId]:{...options,...patch}}});
 const currency=factory.factoryCurrency||'RMB',subtotal=factory.items.reduce((sum,item)=>sum+item.totalQuantity*(currency==='USD'?item.factoryUnitPriceUSD||0:item.unitPriceRMB),0),extra=options.extraFees.reduce((sum,fee)=>sum+fee.amount,0),total=Math.round((subtotal+extra)*100)/100,deposit=options.hasDeposit?Math.round(total*options.depositPercent)/100:0;
 const format=(amount:number)=>`${currency} ${amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 return <div className="factory-purchase-settings"><h3>這家工廠的採購設定</h3><div className="csq-field-grid">
  <label>工廠中文名稱<input aria-label="工廠中文名稱" value={options.chineseName??chineseFactoryName(factory.factorySupplier)} onChange={e=>update({chineseName:e.target.value})}/></label>
  <label>是否支付訂金<select aria-label="是否支付訂金" value={options.hasDeposit?'yes':'no'} onChange={e=>update({hasDeposit:e.target.value==='yes',depositPercent:options.depositPercent||(e.target.value==='yes'?30:0)})}><option value="no">無訂金</option><option value="yes">有訂金</option></select></label>
  {options.hasDeposit&&<label>訂金比例（%）<input aria-label="工廠訂金比例" type="number" min="0" max="100" step="0.01" value={options.depositPercent} onChange={e=>update({depositPercent:Math.min(100,Math.max(0,Number(e.target.value)||0))})}/></label>}
 </div><details className="csq-details"><summary>工廠交易條款 · {options.terms?'已自訂':reference?.source?'已依參考資料帶入':'待填寫'}</summary>
 {reference?.source?<p className="desk-hint">來源：{reference.source.file}{!reference.source.scNumbers.includes(factory.piNumber)&&'（同工廠其他訂單，請核對是否適用）'}</p>:<p className="desk-hint">沒有這家工廠的參考採購單，請填寫此訂單條款。</p>}
 <div className="csq-field-grid">
 <label>交易條件<input aria-label="工廠交易條件" value={options.terms?.trade??reference?.terms?.trade??factory.factoryTradeTerms??''} onChange={e=>update({terms:{reference:reference?.source?.file,...options.terms,trade:e.target.value}})}/></label>
 <label>交貨地點<input aria-label="工廠交貨地點" value={options.terms?.place??reference?.terms?.place??factory.deliveryPlace} onChange={e=>update({terms:{reference:reference?.source?.file,...options.terms,place:e.target.value}})}/></label>
 <label style={{gridColumn:'1 / -1'}}>付款方式<textarea aria-label="工廠付款方式" rows={4} value={options.terms?.payment??reference?.terms?.payment??factory.factoryTerms} onChange={e=>update({terms:{reference:reference?.source?.file,...options.terms,payment:e.target.value}})}/><small>［訂金比例］與［訂金金額］會依本張採購單自動計算。</small></label>
 </div>
 {options.terms&&<button className="desk-button" onClick={()=>update({terms:undefined})}>恢復參考條款</button>}
 {reference&&reference.candidates.length>1&&<label>改用其他參考採購單<select aria-label="工廠條款參考來源" value={options.terms?.reference??reference.source?.file??''} onChange={e=>{const t=reference.candidates.find(t=>t.file===e.target.value)!;const terms=referenceFactoryTerms(t);update({terms:{reference:e.target.value},hasDeposit:terms.hasDeposit,depositPercent:terms.depositPercent});}}>{reference.candidates.map(t=><option key={t.file} value={t.file}>{t.file.split('/').at(-1)}</option>)}</select></label>}
 </details><h3>額外費用（{currency}）</h3><p>例如打樣費、測試費或運費；費用加入這家工廠的採購總額。</p>
 {options.extraFees.map((fee,index)=><div className="factory-fee-row" key={fee.id}><label>費用名稱<input aria-label={`額外費用 ${index+1} 名稱`} value={fee.description} onChange={e=>update({extraFees:options.extraFees.map(f=>f.id===fee.id?{...f,description:e.target.value}:f)})}/></label><label>金額（{currency}）<input aria-label={`額外費用 ${index+1} 金額`} type="number" min="0" step="0.01" value={fee.amount} onChange={e=>update({extraFees:options.extraFees.map(f=>f.id===fee.id?{...f,amount:Math.max(0,Number(e.target.value)||0)}:f)})}/></label><button onClick={()=>update({extraFees:options.extraFees.filter(f=>f.id!==fee.id)})} aria-label={`移除額外費用 ${index+1}`}>移除</button></div>)}
 <button onClick={()=>update({extraFees:[...options.extraFees,{id:newId(),description:'',amount:0}]})}>＋ 新增額外費用</button>
 <div className="factory-money-summary"><span>貨款 {format(subtotal)}</span><span>額外費用 {format(extra)}</span><strong>採購總額 {format(total)}</strong>{options.hasDeposit&&<><span>訂金（{options.depositPercent}%）{format(deposit)}</span><span>餘款 {format(total-deposit)}</span></>}</div>
 <small>設定只套用此訂單所選的工廠、幣別與數量單位，會隨訂單保存。訂金依含額外費用的採購總額計算。</small></div>;
}
