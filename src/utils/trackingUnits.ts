export function trackingQuantityUnit(value:string|undefined){
 const unit=(value||'').trim();
 return ['','PO單位','件','PC','PCE','PCS'].includes(unit.replace(/\s/g,'').toUpperCase())?'PCS':unit;
}
