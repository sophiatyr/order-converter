import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('work', { recursive: true });
for (const test of ['local-parser', 'csq-pdf-columns', 'csq-admiral', 'csq-admiral-48116', 'csq-admiral-48119', 'csq-multiple', 'multiple-pack-documents', 'anti-counterfeit-label', 'confirmed-composition-documents', 'csq-company-pdf', 'csq-exports', 'erp-products', 'erp-set-units', 'factory-assignments', 'factory-text', 'factory-reference-layout', 'factory-reference-terms', 'size-variant-pricing', 'order-product-sync', 'product-catalog-search', 'classification-options', 'order-search', 'order-removal', 'csq-reports','workspace','tracking-documents','tracking-automation','delivery-reminders','production-overview','shipment-tracking','factory-notice','shipping-documents','bulk-progress',...(process.env.CSQ_REFERENCE_TEST==='1'?['reference-documents']:[])]) {
  const output = path.resolve(`work/${test}.test.mjs`);
  await build({ entryPoints: [`tests/${test}.test.ts`], outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  await import(pathToFileURL(output).href);
}
