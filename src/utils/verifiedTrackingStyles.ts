// Verified against the original customer PDFs, not inferred from similar style names.
const corrections:Record<string,Record<string,string>>={
 '26OF028473':{ABCTW070S27:'ABCTW070CO'},
 '26OF029925':{ABCRM1039S27:'ABCRB1039S27',ABCRW1036S27:'ABCRG1036S27'},
};
export function verifiedTrackingStyle(po:string,style:string){return corrections[po]?.[style]||style;}
export function verifiedTrackingAliases(po:string,style:string){return [style,...Object.entries(corrections[po]||{}).filter(([,correct])=>correct===style).map(([original])=>original)];}
export const verifiedPoTotals:Record<string,number>={'26OF028473':12940,'26OF029332':12054,'26OF029925':444,'26OF031991':12390,'26OF031992':7914,'26OF031993':11028,'26OF033275':12600,'26OF033387':9100,'26OF036538':3105,'26OF036555':1710,'26OF042264':9900,'26OF044203':29400,'26OF044377':31650,'26OF044379':28350};
