import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { createWorker, PSM } from 'tesseract.js';
import { layoutToRows, type PositionedText } from './documentLayout';

const assetUrl = (file: string) => new URL(`vendor/${file}`, new URL(import.meta.env.BASE_URL, window.location.href)).href;
GlobalWorkerOptions.workerSrc = assetUrl('pdf.worker.min.mjs');

export interface DocumentReadResult {
  pages?: PositionedText[][];
  rows: string[][];
  text: string;
  usedOcr: boolean;
}
type Progress = (message: string) => void;

async function makeOcrWorker(progress: Progress) {
  if (window.location.protocol === 'file:') {
    throw new Error('PDF／圖片辨識請透過「啟動訂單系統.bat」開啟 http://localhost:8888，讓瀏覽器載入本機辨識資料。');
  }
  const worker = await createWorker('eng+chi_tra', 1, {
    workerPath: assetUrl('ocr/worker.min.js'),
    corePath: assetUrl('ocr'),
    langPath: assetUrl('ocr/lang'),
    workerBlobURL: false,
    cacheMethod: 'none',
    logger: event => {
      if (event.status === 'recognizing text') progress(`本機 OCR 辨識中：${Math.round(event.progress * 100)}%`);
    },
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
  return worker;
}

async function recognize(worker: Awaited<ReturnType<typeof makeOcrWorker>>, image: File | HTMLCanvasElement): Promise<string[][]> {
  const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
  const words: PositionedText[] = [];
  for (const block of data.blocks || []) for (const paragraph of block.paragraphs) {
    for (const line of paragraph.lines) for (const word of line.words) {
      words.push({ text: word.text, x: word.bbox.x0, y: (word.bbox.y0 + word.bbox.y1) / 2,
        width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0 });
    }
  }
  return words.length ? layoutToRows(words) : data.text.split(/\r?\n/).filter(Boolean).map(line => line.split(/\s{2,}|\t/));
}

export async function readLocalDocument(file: File, progress: Progress, forceOcr = false): Promise<DocumentReadResult> {
  if (file.size > 40 * 1024 * 1024) throw new Error('檔案超過 40 MB，請分成較小的檔案後再辨識。');
  let worker: Awaited<ReturnType<typeof makeOcrWorker>> | undefined;
  let pdf: Awaited<ReturnType<typeof getDocument>['promise']> | undefined;
    const rows: string[][] = [];
    const pages: PositionedText[][] = [];
  let usedOcr = false;
  try {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      progress('正在本機讀取 PDF 文字與表格位置...');
      pdf = await getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        cMapUrl: assetUrl('pdf/cmaps/'), cMapPacked: true,
        standardFontDataUrl: assetUrl('pdf/standard_fonts/'), wasmUrl: assetUrl('pdf/wasm/'),
        isEvalSupported: false,
      }).promise;
      if (pdf.numPages > 50) throw new Error('PDF 超過 50 頁，請分批辨識。');
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        // A page header must never be appended to the preceding colour name.
        if (pageNumber > 1) rows.push([]);
        progress(`正在本機讀取 PDF 第 ${pageNumber}／${pdf.numPages} 頁...`);
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const words: PositionedText[] = textContent.items.filter(item => 'str' in item).map(item => {
          if (!('str' in item)) throw new Error('無效的 PDF 文字');
          return { text: item.str, x: item.transform[4], y: -item.transform[5], width: item.width, height: Math.max(item.height, 8) };
        });
        if (!forceOcr && words.reduce((length, word) => length + word.text.trim().length, 0) >= 30) {
          pages.push(words);
          rows.push(...layoutToRows(words));
        } else {
          usedOcr = true;
          progress(`PDF 第 ${pageNumber} 頁為掃描頁，啟動本機 OCR...`);
          worker ||= await makeOcrWorker(progress);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(2.5, 2600 / Math.max(base.width, base.height));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('瀏覽器無法建立辨識畫布');
          await page.render({ canvasContext: context, canvas, viewport }).promise;
          rows.push(...await recognize(worker, canvas));
          canvas.width = canvas.height = 0;
        }
        page.cleanup();
      }
    } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
      usedOcr = true;
      progress('載入本機中英文 OCR 引擎...');
      worker = await makeOcrWorker(progress);
      rows.push(...await recognize(worker, file));
    } else throw new Error('請選擇 PDF、PNG、JPG 或 WebP 檔案。');
    const text = rows.map(row => row.join('\t')).join('\n');
    if (!text.trim()) throw new Error('未能讀到文字，請確認文件清晰、未加密，且方向正確。');
    return { rows, text, usedOcr, pages: !usedOcr && pages.length ? pages : undefined };
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('PDF 已加密，請先解除密碼後再上傳。');
    throw error;
  } finally {
    if (worker) await worker.terminate();
    if (pdf) await pdf.destroy();
  }
}
