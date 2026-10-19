import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const buildRoot = path.resolve(process.argv[2] || 'dist');
const target = path.resolve('offline_package/外貿成衣訂單轉換系統_單機離線完整包');
mkdirSync(target, { recursive: true });
for (const name of ['index.html', 'release.json', 'assets', 'vendor', 'erp-products.json', 'csq-reference-products.json', 'csq-workspace-references.json','csq-bulk-progress.json', 'csq-document-templates.json', 'csq-shipment-template.json', 'csq-shipping-documents.json', 'csq-factory-notice.docx', 'csq-factory-notice.json', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
  if (existsSync(path.join(buildRoot, name))) cpSync(path.join(buildRoot, name), path.join(target, name), { recursive: true });
}
const entry = path.join(target, 'index.html');
if(existsSync(path.join(buildRoot,'branding')))cpSync(path.join(buildRoot,'branding'),path.join(target,'branding'),{recursive:true});
if(existsSync(path.join(buildRoot,'csq-composition-references.json')))cpSync(path.join(buildRoot,'csq-composition-references.json'),path.join(target,'csq-composition-references.json'));
writeFileSync(entry, readFileSync(entry, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '').trimEnd() + '\n');
console.log('Updated the local interface used by port 8888.');
