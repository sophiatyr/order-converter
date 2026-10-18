export function cleanSeries(value:string){
 const suffix=/(?:\s*[-–—·/()]?\s*\b(?:SS|FW|AW)\s*['’]?\d{2}\s*\)?)+$/i;
 const audience='(?:MAN|MEN|WOMAN|WOMEN|BOY|BOYS|GIRL|GIRLS)';
 const gender=new RegExp(`\\s+${audience}(?:\\s*[/&,·-]\\s*${audience})*\\s*$`,'i');
 return [...new Set(value.split(' / ').map(s=>{
  const text=suffix.test(s.trim())?s.trim().replace(suffix,'').trim():s.trimStart();
  return text.replace(gender,'').replace(/\s+/g,' ').toUpperCase();
 }).filter(s=>s.trim()))].join(' / ');
}
export function canonicalSeries(value:string){return [...new Set(cleanSeries(value).split(' / ').map(s=>s.trim()).filter(Boolean))].join(' / ');}
export function canonicalSeason(value:string){return [...new Set(value.split(' / ').map(s=>s.trim().toUpperCase().replace(/^SS04$/,'SS24').replace(/^SS06$/,'SS26')))].filter(Boolean).join(' / ');}
export function compareSeasons(a:string,b:string){
 const rank=(value:string)=>{const m=value.match(/^(SS|FW|AW)(\d{2})$/);return m?Number(m[2])*3+({SS:0,FW:1,AW:2}[m[1]]||0):-1;};
 return rank(a)-rank(b)||a.localeCompare(b,'en',{numeric:true});
}
export function completeSeasonChoices(values:string[],throughYear=new Date().getFullYear()+2){
 const choices=new Set(values.flatMap(value=>canonicalSeason(value).split(' / ')).filter(Boolean));
 const years=[...choices].flatMap(value=>{const m=value.match(/^(?:SS|FW|AW)(\d{2})$/);return m?[2000+Number(m[1])]:[];});
 for(let year=Math.min(2021,...years);year<=Math.max(throughYear,...years);year++)for(const season of ['SS','FW'])choices.add(season+String(year).slice(-2));
 return [...choices].sort(compareSeasons);
}
const knownBrands=['BEST COMPANY','CARNIELLI','FIREFLY','ADMIRAL','INTERSPORT','MISTRAL','ELLESSE','REUSCH','ARENA','BEAR','FILA','8848','ABC'];
export function isBrandOnlySeries(value:string,brands:string[]=[]){
 const series=canonicalSeries(value);
 return knownBrands.includes(series)||brands.some(brand=>canonicalBrand(brand)===series);
}
export function canonicalBrand(value:string){
 const text=value.trim().replace(/\s+/g,' ').toUpperCase().replace(/^CRN(?=$|\s)/,'CARNIELLI').replace(/^(FF|FIRERLY)(?=$|\s)/,'FIREFLY');
 return knownBrands.find(brand=>text===brand||text.startsWith(brand+' '))||text;
}
export function normalizeClassification<T extends {series?:string;season?:string;brand?:string}>(value:T):T & {season?:string}{
 const brand=canonicalBrand(value.brand||''),rawBrand=(value.brand||'').trim().replace(/\s+/g,' ').toUpperCase();
 const misplacedSeries=knownBrands.includes(brand)&&rawBrand.startsWith(brand+' ')?rawBrand:'';
 const original=value.series||misplacedSeries,matches=[...original.matchAll(/\b(SS|FW|AW)\s*['’]?(\d{2})\b/gi)].map(m=>`${m[1]}${m[2]}`.toUpperCase());
 return {...value,...(value.brand!==undefined?{brand}:{}),...(value.series!==undefined||misplacedSeries?{series:cleanSeries(original)}:{}),...(value.season?{season:canonicalSeason(value.season)}:new Set(matches).size===1?{season:canonicalSeason(matches[0])}:{})};
}
