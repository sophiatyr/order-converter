import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('work', { recursive: true });
for (const test of ['shipment-quantity-variance','tracking-excel-import','factory-packing-workflow','shipping-revenue','shipping-overview','container-shipments', 'shipping-preview', 'shipping-workflow', 'local-parser', 'csq-pdf-columns', 'csq-admiral', 'csq-admiral-48116', 'csq-admiral-48119', 'csq-multiple', 'multiple-pack-documents', 'anti-counterfeit-label', 'confirmed-composition-documents', 'csq-company-pdf', 'csq-exports', 'erp-products', 'erp-set-units', 'factory-assignments', 'factory-text', 'factory-reference-layout', 'factory-reference-terms', 'size-variant-pricing', 'order-product-sync', 'product-catalog-search', 'classification-options', 'order-search', 'order-overview', 'order-removal', 'csq-reports','workspace','tracking-documents','tracking-po-reconciliation','customer-bulk-template','tracking-automation','tracking-shared-input','tracking-sort','internal-tracking-template','internal-tracking-portable','delivery-reminders','production-overview','shipment-tracking','shipment-tracking-import','shipment-lc-simple','factory-notice','shipping-documents','bulk-progress',...(process.env.CSQ_REFERENCE_TEST==='1'?['reference-documents']:[])]) {
  const output = path.resolve(`work/${test}.test.mjs`);
  await build({ entryPoints: [`tests/${test}.test.ts`], outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  await import(pathToFileURL(output).href);
}


