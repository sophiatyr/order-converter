import fs from 'node:fs';
import JSZip from 'jszip';
import {Converter} from 'opencc-js';
const tw=Converter({from:'cn',to:'tw'}),root='CSQ參考資料/出貨作業/工廠出貨通知書';
const source=`${root}/CS26001261.docx`,zip=await JSZip.loadAsync(fs.readFileSync(source)),xml=await zip.file('word/document.xml').async('string');
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const text=s=>(s.match(/<w:p\b[\s\S]*?<\/w:p>/g)||[]).map(p=>(p.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g)||[]).map(t=>decode(t.replace(/<[^>]+>/g,''))).join('')).join('\n');
const table=xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/)[0],rows=table.match(/<w:tr\b[\s\S]*?<\/w:tr>/g),cells=r=>r.match(/<w:tc\b[\s\S]*?<\/w:tc>/g);
const settings={version:1,source:'CS26001261.docx',shipperAddress:text(cells(rows[3])[1]).split('\n').slice(1).join('\n'),fromContact:tw(text(cells(rows[1])[0]).replace(/^FROM:\s*/,'')),consignee:text(cells(rows[4])[1]),notify:text(cells(rows[5])[1]),shippingMarks:text(cells(rows[3])[2]).replace(/Q'TY:\s*PRS/,"Q'TY: PCS / PRS"),remarks:tw(text(xml.slice(xml.indexOf(table)+table.length)).split('\n').filter(t=>t.trim()&&!/^\d+\s*PAIRS/.test(t)&&!/^REMARK:/.test(t)&&!/加Show/.test(t)).join('\n')),forwarders:[]};
for(const name of fs.readdirSync(root).filter(f=>f.endsWith('.docx'))){const z=await JSZip.loadAsync(fs.readFileSync(`${root}/${name}`)),x=await z.file('word/document.xml').async('string'),t=x.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/)[0],rs=t.match(/<w:tr\b[\s\S]*?<\/w:tr>/g),r=rs.find(r=>text(cells(r)[0]).includes('FORWARDER'));const value=r?text(cells(r)[1]):'';if(value&&!settings.forwarders.some(p=>p.value===value))settings.forwarders.push({name:/Xiamen|Xiamen Branch/i.test(value)?'廈門 Logwin':'上海 Logwin',value});}
fs.copyFileSync(source,'public/csq-factory-notice.docx');fs.writeFileSync('public/csq-factory-notice.json',JSON.stringify(settings));
console.log('Prepared factory shipping notice Word template and reference profiles.');
