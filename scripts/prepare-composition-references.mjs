import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['src/utils/csqCompanyPdf.ts'],outfile:'work/composition-parser.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {parseCsqCompanyPdf}=await import('../work/composition-parser.mjs');
const source='tests/fixtures/csq-company-pdf-pages.json';
if(!fs.existsSync(source)){console.log('Composition references unchanged: original PDF fixtures unavailable.');process.exit(0);}
const entries=[];
for(const file of JSON.parse(fs.readFileSync(source,'utf8'))){const order=parseCsqCompanyPdf(file.pages,file.file)?.order;if(order?.orderingCompany==='MEDICO'&&order.items.some(i=>i.composition))entries.push({poNumber:order.poNumber,date:order.poDate,fileName:file.file.split(/[\\/]/).pop(),quantity:order.totalPieces,amount:order.totalAmountUSD,items:order.items.map(i=>({itemNo:i.itemNo,description:i.styleName,composition:i.composition||'',quantity:i.totalQuantity,colors:i.colors.map(c=>({code:c.colorCode,quantity:c.totalQuantity}))}))});}
fs.writeFileSync('public/csq-composition-references.json',JSON.stringify(entries));
console.log(JSON.stringify(entries.filter(e=>e.poNumber==='26OF031574'),null,2));
