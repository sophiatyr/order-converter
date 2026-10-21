import references from '../data/shippingDescriptions.json';
import type {OrderData} from '../types/order';
import type {Shipment,ShipmentLine} from './workspace';
export function shippingDescription(s:Shipment,l:ShipmentLine,o?:OrderData){
 const explicit=s.factoryNotice?.['invoiceDescription:'+l.itemNo];if(explicit?.trim())return explicit.trim();
 const known=(references as Record<string,string>)[l.itemNo];if(known)return known;
 if(/(?:MEN'S|WOMEN'S|BOY'S|GIRL'S|UNISEX)/i.test(l.description)&&/%/.test(l.description)&&/\b(?:KNITTED|WOVEN)\b/i.test(l.description))return l.description;
 const item=o?.items.find(i=>l.id.startsWith(i.id+':'))||o?.items.find(i=>i.itemNo===l.itemNo),name=(item?.styleName||'').toUpperCase(),body=(item?.composition||item?.description||l.description).split(/LIN[NI]*NG\s*:/i)[0].toUpperCase();
 const sex=/\b(?:WOMEN|WOMAN|W)\b/.test(name)?"WOMEN'S":/\b(?:GIRL|GIRLS|G)\b/.test(name)?"GIRL'S":/\b(?:BOY|BOYS|B)\b/.test(name)?"BOY'S":/\b(?:MEN|MAN|M)\b/.test(name)?"MEN'S":/\bUNISEX\b/.test(name)?'UNISEX':'';
 const garment=name.match(/T-SHIRT|SLEEVELESS|BOARDSHORT|SHORTS?|SKIRT|PANTS?|SOCKS?|BIKINI|BOXER|BRA|SLIP|JACKET|SWEATSHIRT|LEGGINGS|SET/)?.[0]||'';
 const composition=[...body.matchAll(/(\d+(?:\.\d+)?)\s*%\s*(POLYESTERE?|POLIAMMIDE|POLYAMIDE|NYLON|SPANDEX|ELASTANE|COTTON|VISCOSE|ACRYLIC|WOOL)/g)].map(m=>m[1]+'% '+m[2].replace('POLYESTERE','POLYESTER')).join('+');
 const construction=/\bWOVEN\b/.test(body)?'WOVEN':/\bKNIT(?:TED)?\b/.test(body)?'KNITTED':'';
 return sex&&garment&&composition&&construction?`${sex} ${composition} ${garment} (${construction})`:'';
}
