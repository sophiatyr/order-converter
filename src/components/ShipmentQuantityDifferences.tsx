import type {Shipment} from '../utils/workspace';
import type {OrderData} from '../types/order';
import {shipmentQuantityDifferences} from '../utils/shipmentSelection';
export function ShipmentQuantityDifferences({shipment,all,order}:{shipment:Shipment;all:Shipment[];order?:OrderData}){
 const differences=shipmentQuantityDifferences(shipment,all,order);if(!differences.length)return null;
 return <section className="shipment-quantity-differences"><h3>{shipment.poNumber} · 實際數量差異核對</h3><p className="desk-hint">允許溢裝或短裝。請核對下列尺碼差異後套用；客戶單據依實際裝箱數量，PO 原下單量保留，短裝餘量繼續待出貨。</p><div className="comfortable-list"><table className="csq-table comfortable-table"><thead><tr><th>款色／尺碼</th><th>PO 下單／已出</th><th>本次預計</th><th>本次實際</th><th>差異</th></tr></thead><tbody>{differences.map(d=><tr key={d.lineId+d.size}><td data-label="款色／尺碼">{d.style}<small>{d.color} · {d.size}</small></td><td data-label="PO 下單／已出">{d.ordered??'待核對'} / {d.previous}</td><td data-label="本次預計">{d.planned??'待核對'}</td><td data-label="本次實際">{d.actual}</td><td data-label="差異">{d.delta===null?'待核對':d.delta>0?`多出 ${d.delta}`:`短裝 ${-d.delta}`}{d.excess>0&&<small>累計超過 PO {d.excess}</small>}</td></tr>)}</tbody></table></div></section>;
}
