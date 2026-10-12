import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8888);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; connect-src 'self' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;");
  next();
});

// API: Offline package status and size info
app.get('/api/offline-pack-info', (_req, res) => {
  const rootZip = path.join(__dirname, '外貿成衣訂單轉換系統_單機離線完整包.zip');
  const publicZip = path.join(__dirname, 'public', '外貿成衣訂單轉換系統_單機離線完整包.zip');
  const targetZip = fs.existsSync(rootZip) ? rootZip : (fs.existsSync(publicZip) ? publicZip : null);
  
  const publicHtml = path.join(__dirname, 'public', '單機版_直接點開免安裝.html');
  const distHtml = path.join(__dirname, 'dist', '單機版_直接點開免安裝.html');
  const targetHtml = fs.existsSync(publicHtml) ? publicHtml : (fs.existsSync(distHtml) ? distHtml : null);

  const zipSize = targetZip ? fs.statSync(targetZip).size : 0;
  const htmlSize = targetHtml ? fs.statSync(targetHtml).size : 0;

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    success: true,
    zipAvailable: zipSize > 500000,
    zipSizeBytes: zipSize,
    zipSizeFormatted: zipSize ? `${(zipSize / (1024 * 1024)).toFixed(1)} MB` : '1.1 MB',
    htmlAvailable: htmlSize > 1000000,
    htmlSizeBytes: htmlSize,
    htmlSizeFormatted: htmlSize ? `${(htmlSize / (1024 * 1024)).toFixed(1)} MB` : '2.0 MB',
  });
});

// API: Download Offline Standalone Package ZIP
app.get(['/api/download-offline-pack', '/offline-pack.zip'], (_req, res) => {
  const rootZip = path.join(__dirname, '外貿成衣訂單轉換系統_單機離線完整包.zip');
  const publicZip = path.join(__dirname, 'public', '外貿成衣訂單轉換系統_單機離線完整包.zip');
  const targetZip = fs.existsSync(rootZip) ? rootZip : (fs.existsSync(publicZip) ? publicZip : null);

  if (targetZip) {
    const stat = fs.statSync(targetZip);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="garment_po_system_offline.zip"; filename*=UTF-8\'\'%E5%A4%96%E8%B2%BF%E6%88%90%E8%A1%A3%E8%A8%82%E5%96%AE%E8%BD%89%E6%8F%9B%E7%B3%BB%E7%B5%B1_%E5%96%AE%E6%A9%9F%E9%9B%A2%E7%B7%9A%E5%AE%8C%E6%95%B4%E5%8C%85.zip'
    );
    const stream = fs.createReadStream(targetZip);
    stream.pipe(res);
  } else {
    res.status(404).json({ success: false, error: '離線打包檔案尚未生成，請稍後重試' });
  }
});

// API: Direct Download Single Standalone HTML (免解壓單一檔案，2.0 MB 直接點開)
app.get('/api/download-standalone-html', (_req, res) => {
  const publicHtml = path.join(__dirname, 'public', '單機版_直接點開免安裝.html');
  const distHtml = path.join(__dirname, 'dist', '單機版_直接點開免安裝.html');
  const targetHtml = fs.existsSync(publicHtml) ? publicHtml : (fs.existsSync(distHtml) ? distHtml : null);

  if (targetHtml) {
    const stat = fs.statSync(targetHtml);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="garment_po_standalone.html"; filename*=UTF-8\'\'%E5%A4%96%E8%B2%BF%E6%88%90%E8%A1%A3%E8%A8%82%E5%96%AE%E8%BD%89%E6%8F%9B%E7%B3%BB%E7%B5%B1_%E5%96%AE%E6%A9%9F%E5%85%8D%E5%AE%89%E8%A3%9D%E7%89%88.html'
    );
    const stream = fs.createReadStream(targetHtml);
    stream.pipe(res);
  } else {
    res.status(404).json({ success: false, error: '單機版 HTML 檔案尚未生成，請稍後重試' });
  }
});

// Order analysis runs exclusively in the browser; no cloud parser is available.
app.post('/api/parse-order', (_req, res) => {
  res.status(410).json({ success: false, error: '雲端解析已停用，請重新整理頁面並使用本機 PDF／OCR 解析。' });
});

// Setup Vite in Dev or serve static in Prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
