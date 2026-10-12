export function cleanSeries(value:string){
 const suffix=/(?:\s*[-–—·/()]?\s*\b(?:SS|FW|AW)\s*['’]?\d{2}\s*\)?)+$/i;
 return [...new Set(value.split(' / ').map(s=>suffix.test(s.trim())?s.trim().replace(suffix,'').trim():s.trimStart()).filter(s=>s.trim()))].join(' / ');
}
export function normalizeClassification<T extends {series?:string;season?:string}>(value:T):T & {season?:string}{
 const original=value.series||'',matches=[...original.matchAll(/\b(SS|FW|AW)\s*['’]?(\d{2})\b/gi)].map(m=>`${m[1]}${m[2]}`.toUpperCase());
 return {...value,...(value.series!==undefined?{series:cleanSeries(original)}:{}),...(!value.season&&new Set(matches).size===1?{season:matches[0]}:{})};
}
