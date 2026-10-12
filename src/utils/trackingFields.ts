export const internalLabels = ['P/I NO.','S/C NO.','季度','品牌','系列','下單公司','For','S/C 金額','包裝','工廠代碼','工廠名稱','採購單金額','採購換算值','利潤率','品號 / 品名','數量','單位','下單日','打 S/C 日','客人交期','工廠交期','距離工廠交期天數','TP','客供條碼','防盜標','客供防偽標','色卡評語','FIT SAMPLE','產前樣寄出','產前樣確認','照相樣','船樣','中驗','我司 Final','客人 Final','通知客人','工廠出貨','ETC','ETD','ETA','FORWARDER / VESSEL','CBM','INV / PK 通知','押匯','收款','付款'];
export const approvalStatuses=['NOT REQUIRED','TO BE SENT','WAITING CISALFA','COMMENTS TO ACTION','APPROVED'];
export const bulkPhases = [
 ['tp','FINAL TP','DATE',['WAITING CISALFA','RECEIVED']],
 ['labDip','LAB DIP','SENDING ETD',approvalStatuses],
 ['trims','TRIMS','SENDING ETD',approvalStatuses],
 ['careLabel','CARE LABEL','SENDING ETD',approvalStatuses],
 ['fabricInHouse','BULK FABRIC','IN-HOUSE DATE',['PLANNED','RECEIVED']],
 ['paperPattern','PAPER PATTERN','READY ETD',['NOT REQUIRED','IN PREPARATION','WAITING CISALFA','COMMENTS TO ACTION','APPROVED']],
 ['fitSample','FIT SAMPLE','SENDING ETD',approvalStatuses],
 ['pps','PPS','SENDING ETD',approvalStatuses],
 ['fabricTest','FABRIC TEST','TEST DATE',['TO BE TESTED','REPORT TO BE SENT','WAITING CISALFA','ISSUE TO RESOLVE','APPROVED']],
 ['cutting','CUTTING','START DATE',['PLANNED','STARTED','COMPLETED']],
 ['sewing','SEWING','START DATE',['PLANNED','STARTED','COMPLETED']],
 ['shippingSample','SHIPPING SAMPLE – 1 PER STYLE','SENDING ETD',approvalStatuses],
 ['packing','PACKING','COMPLETION DATE',['PLANNED','STARTED','COMPLETED']],
 ['inspection','SUPPLIER FINAL INSPECTION','INSPECTION DATE',['PLANNED','COMPLETED']],
 ['shipment','BULK SHIPMENT','SHIPMENT DATE',['PLANNED','SHIPPED']],
] as const;
export const bulkOrderLabels=['SUPPLIER NAME','BRAND','STYLE','COLOUR','PO NUMBER','ORDER COMPANY','ETD ON PO','ETD CONFIRMED','ORDER QUANTITY','FACTORY NAME – SAME AS BSCI','CISALFA PRODUCT CONTACT','ITEM NUMBER','PRODUCT DESCRIPTION'];
export const columnKey=(index:number)=>{let n=index+1,s='';while(n){s=String.fromCharCode(65+(n-1)%26)+s;n=Math.floor((n-1)/26);}return s;};
export function overallCheck(b:Record<string,string>={}){
 const approved=(k:string)=>['APPROVED','NOT REQUIRED'].includes(b[k+'Status']);
 return b.tpStatus==='RECEIVED'&&b.fabricInHouseStatus==='RECEIVED'&&b.fabricTestStatus==='APPROVED'&&['labDip','trims','careLabel','paperPattern','fitSample','pps'].every(approved)?'READY':'NOT READY';
}
