import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
const target = path.resolve('public/vendor');
mkdirSync(target, { recursive: true });
cpSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', path.join(target, 'pdf.worker.min.mjs'));
for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
  cpSync(`node_modules/pdfjs-dist/${name}`, path.join(target, 'pdf', name), { recursive: true });
}
mkdirSync(path.join(target, 'ocr'), { recursive: true });
cpSync('node_modules/tesseract.js/dist/worker.min.js', path.join(target, 'ocr/worker.min.js'));
for (const name of readdirSync('node_modules/tesseract.js-core')) {
  if (name.startsWith('tesseract-core') && name.endsWith('.wasm.js')) {
    cpSync(path.join('node_modules/tesseract.js-core', name), path.join(target, 'ocr', name));
  }
}
mkdirSync(path.join(target, 'ocr/lang'), { recursive: true });
for (const language of ['eng', 'chi_tra']) {
  cpSync(`node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`, path.join(target, 'ocr/lang', `${language}.traineddata.gz`));
}
// Include the licenses with redistributed runtimes.
cpSync('node_modules/pdfjs-dist/LICENSE', path.join(target, 'PDFJS-LICENSE'));
cpSync('node_modules/tesseract.js/LICENSE.md', path.join(target, 'TESSERACT-LICENSE'));
cpSync('node_modules/tesseract.js-core/LICENSE', path.join(target, 'TESSERACT-CORE-LICENSE'));
console.log('PDF and OCR runtimes and language files prepared locally.');
