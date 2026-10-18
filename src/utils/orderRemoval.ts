import type {Workspace} from './workspace';
export function removeOrder(w:Workspace,po:string):Workspace{
 const order=w.orders.find(o=>o.poNumber===po);if(!order)return w;
 if(w.shipments.some(s=>s.poNumber===po))throw new Error('此訂單已有出貨批次，請先處理出貨資料，避免失去訂單對照。');
 return {...w,orders:w.orders.filter(o=>o.poNumber!==po),removedOrders:{...w.removedOrders,[po]:order}};
}
export function restoreRemovedOrder(w:Workspace,po:string):Workspace{
 const order=w.removedOrders?.[po];if(!order)return w;
 if(w.orders.some(o=>o.poNumber===po))throw new Error('此 PO 已重新匯入，保留目前訂單，不覆蓋。');
 const removedOrders={...w.removedOrders};delete removedOrders[po];
 return {...w,removedOrders,orders:[order,...w.orders]};
}
