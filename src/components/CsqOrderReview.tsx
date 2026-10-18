import {pricingCode} from '../utils/sizeVariants';
import type {CsqReference} from '../utils/csqReferences';
import type {DocumentTemplates} from '../utils/referenceDocuments';
import {FactoryTextEditor} from './FactoryTextEditor';
import {isBrandOnlySeries,compareSeasons} from '../utils/classification';
import {SelectWithAdd} from './SelectWithAdd';
import {normalizeOption,orderSeasonChoices,type ClassificationKind} from '../utils/classificationOptions';
import React,{useState,useRef,useEffect} from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import type { OrderData, OrderItem } from '../types/order';
import { CSQ_COMPANIES, csqOrderNumber, type CsqCompany } from '../utils/csqAccount';
import {correctOrderItems} from '../utils/orderCorrections';
import {localToday} from '../utils/trackingAutomation';
import type {Workspace} from '../utils/workspace';
import type {ErpSnapshot} from '../utils/erpProducts';
import {compositionDifference,compositionSourceLabels,productComposition} from '../utils/orderComposition';
import {StyleFactoryAssignments} from './StyleFactoryAssignments';
import {orderedSizes} from '../utils/sizeOrder';

interface Props {references:CsqReference[];templates?:DocumentTemplates;onSaveColors:(style:string,colors:Record<string,string>)=>void;onSaveFactoryText:(style:string,text:{chineseName:string;chineseSpec:string},sync:boolean)=>void;onResetFactoryText:(style:string)=>void;choices:Record<ClassificationKind,string[]>;onAddClassification:(kind:ClassificationKind,value:string)=>void; order: OrderData; onChange: (value: OrderData) => void; issues: string[];workspace:Workspace;erp:ErpSnapshot|null }
export function CsqOrderReview({ order, onChange, issues,workspace,erp,choices,onAddClassification,onSaveFactoryText,onResetFactoryText,templates,onSaveColors,references }: Props) {
  const [correction,setCorrection]=useState<{itemId:string;itemNo:string;price:string;description:string;reason:string;all:boolean}|null>(null),[correctionError,setCorrectionError]=useState('');
  const correctionPanel=useRef<HTMLElement>(null);useEffect(()=>{if(correction)correctionPanel.current?.scrollIntoView({behavior:'smooth',block:'center'});},[correction?.itemId]);
  const openCorrection=(item:OrderItem)=>{setCorrection({itemId:item.id,itemNo:item.itemNo,price:String(item.unitPriceUSD),description:item.description,reason:'',all:true});setCorrectionError('');};
  const confirmCorrection=()=>{if(!correction)return;try{const item=order.items.find(i=>i.id===correction.itemId)!;const values:Partial<Record<'itemNo'|'unitPriceUSD'|'description',string>>={};if(correction.itemNo!==item.itemNo)values.itemNo=correction.itemNo;if(correction.price!==String(item.unitPriceUSD))values.unitPriceUSD=correction.price;if(correction.description!==item.description)values.description=correction.description;
    if(!Object.keys(values).length){setCorrectionError('尚未修改內容');return;}
    const ids=correction.all?order.items.filter(i=>pricingCode(i)===pricingCode(item)).map(i=>i.id):[item.id];onChange(correctOrderItems(order,ids,values,correction.reason,localToday()));setCorrection(null);
  }catch(e){setCorrectionError(e instanceof Error?e.message:'更正失敗');}};
  const update = (field: keyof OrderData, value: unknown) => onChange({ ...order, [field]: value });
  const useProductComposition=(item:OrderItem)=>{const product=productComposition(item.itemNo,workspace,erp);if(!product)return;const ids=order.items.filter(i=>i.itemNo===item.itemNo).map(i=>i.id);onChange(correctOrderItems(order,ids,{description:product.value},`核對後採用${compositionSourceLabels[product.source]}面料，取代原訂單內容。`,localToday()));};
  const updateItem = (index: number, fields: Partial<OrderItem>) => {
    const items = order.items.map((item, i) => {
      if(i!==index)return item;
      const next={...item,...fields};
      if(item.factoryProduct&&fields.factoryUnitPriceUSD!==undefined)next.factoryProduct={...item.factoryProduct,currency:'USD',price:fields.factoryUnitPriceUSD};
      if(item.factoryProduct&&fields.unitPriceRMB!==undefined)next.factoryProduct={...item.factoryProduct,currency:'RMB',price:fields.unitPriceRMB};
      return next;
    });
    onChange({ ...order, items });
  };
  const quantity = (index: number, colorIndex: number, size: string, value: number) => {
    const item = order.items[index];
    const colors = item.colors.map((color, i) => {
      if (i !== colorIndex) return color;
      const quantitiesBySize = { ...color.quantitiesBySize, [size]: Math.max(0, Math.trunc(value || 0)) };
      return { ...color, quantitiesBySize, totalQuantity: Object.values(quantitiesBySize).reduce((a, b) => a + b, 0) };
    });
    const totalQuantity = colors.reduce((sum, color) => sum + color.totalQuantity, 0);
    updateItem(index, { colors, totalQuantity, totalAmountUSD: totalQuantity * item.unitPriceUSD, totalAmountRMB: totalQuantity * item.unitPriceRMB });
  };
  return <>
    <section className="csq-panel"><div className="csq-panel-heading"><h2>訂單資料</h2><span>Account / CSQ</span></div><div className="csq-field-grid">
      <label>下單公司<select value={order.orderingCompany || 'CISALFA'} onChange={e => { const company = e.target.value as CsqCompany; onChange({ ...order, orderingCompany: company, customerName: company === 'CISALFA' ? 'CISALFA SPORT SPA.' : company, piNumber: csqOrderNumber(order.poNumber, company, order.poDate) }); }}>{CSQ_COMPANIES.map(company => <option key={company}>{company}</option>)}</select></label>
      <label>客戶 PO 號碼<input value={order.poNumber} onChange={e => update('poNumber', e.target.value)} /></label>
      <SelectWithAdd compareOptions={compareSeasons} label="訂單季別" value={order.season||''} options={orderSeasonChoices(workspace)} normalize={v=>normalizeOption('season',v)} onChange={v=>update('season',v)} onAdd={v=>onAddClassification('season',v)}/>
      <SelectWithAdd label="訂單品牌" value={order.brand||''} options={choices.brand} normalize={v=>normalizeOption('brand',v)} onChange={v=>update('brand',v)} onAdd={v=>onAddClassification('brand',v)}/>
      <SelectWithAdd validateOption={v=>isBrandOnlySeries(v,choices.brand)?'請填完整系列名稱，不能只有品牌。':''} label="訂單系列" value={normalizeOption('series',order.series||'')} options={choices.series} normalize={v=>normalizeOption('series',v)} onChange={v=>update('series',v)} onAdd={v=>onAddClassification('series',v)}/>
      <label>訂單日期<input value={order.poDate} onChange={e => update('poDate', e.target.value)} /></label>
      <label>客戶出貨日<input value={order.shipmentDate} onChange={e => update('shipmentDate', e.target.value)} /></label>
    </div></section>
    <section className="csq-panel"><div className="csq-panel-heading"><h2>包裝與客人付款條件</h2><span>包裝共用於各文件；客人付款用於 P/I 與早見表</span></div><div className="csq-field-grid order-common-settings"><label>包裝方式<select aria-label="訂單包裝方式" value={order.packingType||'NORMAL PACK'} onChange={e=>update('packingType',e.target.value)}><option value="NORMAL PACK">Normal Pack（單碼包裝）</option><option value="MULTIPLE PACK">Multiple Pack（混碼包裝）</option></select></label><label>防偽標<select aria-label="訂單防偽標" value={order.requiresAntiCounterfeitLabel===undefined?'':order.requiresAntiCounterfeitLabel?'yes':'no'} onChange={e=>onChange({...order,requiresAntiCounterfeitLabel:e.target.value===''?undefined:e.target.value==='yes'})}><option value="">請選擇</option><option value="yes">需要防偽標</option><option value="no">不需要防偽標</option></select></label><label>客人付款條件<input aria-label="客人付款條件" value={order.paymentTerms} onChange={e=>update('paymentTerms',e.target.value)}/></label></div></section>
    {issues.length > 0 && <section className="csq-review-notice"><AlertCircle size={18} /><div><strong>{issues.length} 項待核對</strong>{issues.map((issue, i) => <p key={i}>{issue}</p>)}</div></section>}
    <section className="csq-panel"><div className="csq-panel-heading"><h2>PO 品項明細</h2><span>{order.items.length} 筆款色 · 數量單位：件</span></div><div className="csq-table-scroll"><table className="csq-table"><thead><tr><th>款號 / 客戶品號</th><th>顏色</th><th>尺碼與件數</th><th className="number">件數</th><th className="number">單價 USD</th><th className="number">金額 USD</th></tr></thead><tbody>
      {order.items.flatMap((item, index) => item.colors.map((color, colorIndex) => <tr key={`${item.id}-${color.id}`}>
        <td><strong>{item.itemNo}</strong>{item.erpItemNo&&<small>ERP：{item.erpItemNo}</small>}<small>{item.customerItemCodes?.join(' / ') || item.kitCode || '客戶品號待確認'}</small><small className="csq-description">Description：{item.styleName}</small><small className="csq-description">Composition：{(item.composition??(item.description!==item.styleName?item.description:''))||'待核對原始 PO'}</small><small>來源：{item.compositionSource?compositionSourceLabels[item.compositionSource]:(item.composition?'原始 PO':'尚未確認')}</small>{compositionDifference(item,workspace,erp)&&<details><summary>面料內容不同，請核對</summary><small style={{whiteSpace:'pre-wrap'}}>產品資料：{compositionDifference(item,workspace,erp)!.value}</small><button className="desk-button" onClick={()=>useProductComposition(item)}>確認採用產品面料</button></details>}<button className="desk-button" onClick={()=>openCorrection(item)}>更正款號 / 價格 / 面料</button></td>
        <td><strong>{color.colorCode || '—'}</strong><small>{color.colorName || '待核對'}</small></td>
        <td><div className="csq-size-grid">{orderedSizes(item.sizes).map(size => <label key={size}><span>{size}</span><input aria-label={`${item.itemNo} ${color.colorCode} ${size} 件數`} type="number" min="0" step="1" value={color.quantitiesBySize[size] ?? 0} onChange={e => quantity(index, colorIndex, size, Number(e.target.value))} /></label>)}</div>{item.isPrepack && <><small>混碼裝袋 · {item.kitQty ?? '待核對'} 包 × {item.piecesPerKit ?? '待核對'} 件／包 · 包價 USD {item.kitPriceUSD?.toFixed(2) ?? '待核對'}</small><small>每包配比：{item.ratioString || '待核對'}</small></>}</td>
        <td className="number"><strong>{color.totalQuantity.toLocaleString()}</strong></td>
        <td className="number"><button aria-label={`${item.itemNo} 更正客戶單價`} className="desk-button" onClick={()=>openCorrection(item)}>{item.unitPriceUSD.toFixed(2)}</button></td>
        <td className="number">{(color.totalQuantity * item.unitPriceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>))}
    </tbody><tfoot><tr><td colSpan={3}>合計</td><td className="number">{order.totalPieces.toLocaleString()}</td><td /><td className="number">{order.totalAmountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></tfoot></table></div></section>
    {correction&&<section ref={correctionPanel} className="csq-panel"><div className="csq-panel-heading"><h2>更正客戶 PO · {order.items.find(i=>i.id===correction.itemId)?.itemNo}</h2><button className="desk-button" onClick={()=>setCorrection(null)}>取消</button></div><p className="desk-hint">保留原始 PO 與更正紀錄。款號更正後請重新帶入 ERP 產品資料，取得正確的工廠與成本。</p><div className="csq-field-grid"><label>正確款號<input aria-label="更正款號" value={correction.itemNo} onChange={e=>setCorrection({...correction,itemNo:e.target.value})}/></label><label>正確客戶單價 USD<input aria-label="更正客戶單價" type="number" min="0.01" step="0.01" value={correction.price} onChange={e=>setCorrection({...correction,price:e.target.value})}/></label><label>Composition（客戶面料成分）<textarea aria-label="更正Composition（客戶面料成分）" value={correction.description} onChange={e=>setCorrection({...correction,description:e.target.value})}/></label><label>更正原因<input aria-label="更正原因" placeholder="例如客人確認款號誤植" value={correction.reason} onChange={e=>setCorrection({...correction,reason:e.target.value})}/></label><label><input type="checkbox" checked={correction.all} onChange={e=>setCorrection({...correction,all:e.target.checked})}/>同步更正此訂單同品號／尺碼的所有顏色</label><button className="csq-primary" onClick={confirmCorrection}>套用更正並保存紀錄</button>{correctionError&&<p className="csq-alert">{correctionError}</p>}</div></section>}
    {!!order.corrections?.length&&<details className="csq-panel csq-details"><summary>PO 更正紀錄 · {order.corrections.length} 筆</summary><div className="csq-table-scroll"><table className="csq-table"><thead><tr><th>日期</th><th>款號</th><th>欄位</th><th>原值</th><th>更正值</th><th>原因</th></tr></thead><tbody>{order.corrections.map(c=><tr key={c.id}><td>{c.date}</td><td>{order.items.find(i=>i.id===c.itemId)?.itemNo}</td><td>{{itemNo:'款號',unitPriceUSD:'客戶價格',description:'Composition（客戶面料成分）'}[c.field]}</td><td>{c.originalValue}</td><td>{c.correctedValue}</td><td>{c.reason}</td></tr>)}</tbody></table></div></details>}
    {order.reviewWarnings?.length ? <details className="csq-panel csq-details"><summary>原始文件核對提醒<ChevronDown size={16} /></summary><div className="px-5 pb-4 text-xs text-slate-500 space-y-2">{order.reviewWarnings.map((warning, index) => <p key={index}>{warning}</p>)}</div></details> : null}
    <StyleFactoryAssignments key={`factory-prices:${order.poNumber}`} order={order} w={workspace} erp={erp} onChange={onChange}/>
    <details className="csq-panel csq-details"><summary>交易條件<ChevronDown size={16} /></summary><div className="csq-field-grid">
      <label>工廠交貨日<input value={order.factoryShipDate} onChange={e => update('factoryShipDate', e.target.value)} /></label>
      <label>成本換算匯率（1 USD = RMB）<input aria-label="成本換算匯率" type="number" min="0.0001" step="0.0001" placeholder="人民幣成本計算利潤時填寫" value={order.rmbPerUsd||''} onChange={e=>update('rmbPerUsd',Number(e.target.value)>0?Number(e.target.value):undefined)}/></label>
      <label>交易條件<input value={order.tradeTerms} onChange={e => update('tradeTerms', e.target.value)} /></label>
      <label>裝運港<input value={order.port} onChange={e => update('port', e.target.value)} /></label>
      <label>運輸方式<input value={order.modeOfDelivery} onChange={e => update('modeOfDelivery', e.target.value)} /></label>
      <p>各工廠的訂金與額外費用，請在「訂單文件輸出 → 採購單預覽」設定。</p>
    </div></details>
    <FactoryTextEditor references={references} templates={templates} onSaveColors={onSaveColors} key={`factory-text:${order.poNumber}`} order={order} workspace={workspace} onSave={onSaveFactoryText} onReset={onResetFactoryText}/>
  </>;
}
