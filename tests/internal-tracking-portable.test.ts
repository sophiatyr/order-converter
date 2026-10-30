import {workbookPreviewColors} from '../src/utils/workbookPreviewColors';
import assert from 'node:assert/strict';import fs from 'node:fs';import JSZip from 'jszip';import * as XLSX from 'xlsx';
import {buildPortableInternalTracking} from '../src/utils/internalTrackingPortable';
import {internalTemplatePayload} from '../src/utils/internalTrackingTemplate';
import {emptyWorkspace,trackingRows} from '../src/utils/workspace';
const template=fs.readFileSync('public/csq-internal-tracking-template.xlsx'),blueprint=JSON.parse(fs.readFileSync('public/csq-internal-tracking-template.json','utf8'));
const refs=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')),extra=fs.existsSync('work/nas-material-orders-before.json')?JSON.parse(fs.readFileSync('work/nas-material-orders-before.json','utf8')):[];
const w={...emptyWorkspace(),orders:extra},directory=trackingRows(w,refs),payload=internalTemplatePayload(directory,directory,w);
const output=await buildPortableInternalTracking(template,blueprint,payload,new Date(2026,9,22));fs.writeFileSync('work/internal-tracking-portable-check.xlsx',output);
const original=await JSZip.loadAsync(template),zip=await JSZip.loadAsync(output);
for(const name of Object.keys(original.files).filter(n=>!original.files[n].dir&&!['xl/worksheets/sheet1.xml','xl/workbook.xml','xl/styles.xml'].includes(n)))assert.deepEqual(await original.file(name)!.async('uint8array'),await zip.file(name)!.async('uint8array'),name+' preserved byte for byte');
const sheet=await zip.file('xl/worksheets/sheet1.xml')!.async('string'),before=await original.file('xl/worksheets/sheet1.xml')!.async('string');
for(const r of [1,2,3,4])assert.equal(sheet.match(new RegExp('<row\\b[^>]*r="'+r+'"[^>]*>[\\s\\S]*?</row>'))?.[0],before.match(new RegExp('<row\\b[^>]*r="'+r+'"[^>]*>[\\s\\S]*?</row>'))?.[0],'Header '+r+' unchanged');
const book=XLSX.read(output,{type:'array'}),ws=book.Sheets.CSQ,rows=XLSX.utils.sheet_to_json<any[]>(ws,{header:1,defval:''});
assert.equal(rows.length,payload.rows.length+4);for(const po of ['26OF048116','26OF048119','26OF048122'].filter(po=>payload.rows.some(r=>r.po===po)))assert(rows.slice(4).some(r=>r[1]===po),po+' exported');
assert(ws['V5'].f?.includes('TODAY()'));assert(sheet.includes('mergeCells'));assert(!sheet.includes('EBUSY'));assert.equal(book.SheetNames[0],'CSQ');
const a=structuredClone(payload.rows[0]),b=structuredClone(payload.rows[0]);a.id='usd';b.id='rmb';a.sc=b.sc='CS-NEW';a.po=b.po='NEW-PO';a.style='STYLE-A';b.style='STYLE-B';a.aliases=['STYLE-A'];b.aliases=['STYLE-B'];a.currency='USD';b.currency='RMB';a.rate=null;b.rate=7;a.scopes={H:'order',L:'usd',M:'usd',N:'order'};b.scopes={H:'order',L:'rmb',M:'rmb',N:'order'};a.values[0]=b.values[0]=a.sc;a.values[1]=b.values[1]=a.po;a.values[7]=b.values[7]=1000;a.values[11]=300;b.values[11]=1400;a.values[14]=a.style;b.values[14]=b.style;a.values[21]=b.values[21]=0;a.values[20]=b.values[20]=47000;a.values[5]='=HYPERLINK("x")';
const testBytes=await buildPortableInternalTracking(template,blueprint,{rows:[a,b]},new Date(2026,9,22)),t=XLSX.read(testBytes,{type:'array'}).Sheets.CSQ;assert.equal(t.M6.f,'L6/7');assert.equal(t.M6.v,200);assert.equal(t.N5.v,.5);assert.equal(t.H6?.v,undefined);assert(!t.F5.f);assert.equal(t.F5.v,'=HYPERLINK("x")');assert(t.N5.f?.includes('L5,M6'));fs.writeFileSync('work/internal-tracking-portable-mixed-check.xlsx',testBytes);
console.log('PASS portable internal tracking: complete POs, new orders, original headers/styles/print parts, merged totals, live margin/conversion/TODAY formulas, cached values and safe text; '+payload.rows.length+' rows.');

const fxSource=blueprint.rows.find((r:any)=>r.conversionRate&&r.style);assert(fxSource);const fx=structuredClone(a);fx.sc=fxSource.sc;fx.po=fxSource.po;fx.style=fxSource.style;fx.aliases=[fxSource.style];fx.factory=fxSource.factory;fx.currency='';fx.rate=null;const fxSheet=XLSX.read(await buildPortableInternalTracking(template,blueprint,{rows:[fx]}),{type:'array'}).Sheets.CSQ;assert.equal(fxSheet.M5.f,'L5/'+fxSource.conversionRate,'Original RMB conversion survives missing metadata');

const stylesXml=await zip.file('xl/styles.xml')!.async('string'),oldStylesXml=await original.file('xl/styles.xml')!.async('string');
const nodes=(xml:string,part:string,node:string)=>[...xml.match(new RegExp('<'+part+'\\b[^>]*>[\\s\\S]*?</'+part+'>'))![0].matchAll(new RegExp('<'+node+'\\b[^>]*(?:/>|>[\\s\\S]*?</'+node+'>)','g'))].map(m=>m[0]);
for(const [part,node] of [['fonts','font'],['cellXfs','xf']]){const old=nodes(oldStylesXml,part,node);assert.deepEqual(nodes(stylesXml,part,node).slice(0,old.length),old,'Original '+part+' preserved');}
const fonts=nodes(stylesXml,'fonts','font'),styles=nodes(stylesXml,'cellXfs','xf'),poColor=new Map<string,string>();
for(const row of sheet.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
 if(Number(row[1])<5)continue;
 const cells=[...row[2].matchAll(/<c\b([^>]*)(?:\/>|>[\s\S]*?<\/c>)/g)];
 const po=cells.find(c=>/\br="B\d+"/.test(c[1]))![0].match(/<t[^>]*>(.*?)<\/t>/)![1];
 for(const cell of cells){const style=styles[Number(cell[1].match(/\bs="(\d+)"/)![1])],font=fonts[Number(style.match(/\bfontId="(\d+)"/)![1])],color=font.match(/<color rgb="([^"]+)"/)![1];if(poColor.has(po))assert.equal(color,poColor.get(po),'Every column/style in PO '+po+' uses same colour');else poColor.set(po,color);}
}
assert(new Set(poColor.values()).size>1,'Different POs are distinguished');
console.log('PASS internal PO fonts: every column in same PO shares colour; original fonts/styles retained, no formula/format replacement.');

const previewColors=await workbookPreviewColors(output);
assert.equal(previewColors.CSQ.B5,previewColors.CSQ.O5,'Preview uses exported font colour across columns');
assert.equal(previewColors.CSQ.B5,'#'+poColor.get(rows[4][1])!.slice(-6),'Preview matches exact workbook style');
