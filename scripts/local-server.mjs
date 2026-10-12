import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(projectRoot, 'offline_package', '外貿成衣訂單轉換系統_單機離線完整包');
const port = 8888;
const ownerPid = Number(process.argv[2]);
if (Number.isInteger(ownerPid) && ownerPid > 0) {
  // Stop the hidden server if the launcher window is closed.
  setInterval(() => {
    try { process.kill(ownerPid, 0); }
    catch { process.exit(0); }
  }, 1000).unref();
}
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.gz': 'application/gzip',
};

if (!fs.existsSync(path.join(webRoot, 'index.html'))) {
  console.error('找不到離線介面，請保留完整的 offline_package 資料夾。');
  process.exit(1);
}

const sendJson = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
};

const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url, `http://localhost:${port}`);
    if (url.pathname === '/api/local-health') {
      sendJson(response, 200, { app: 'order-converter-local', port, pid: process.pid });
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 503, {
        success: false,
        error: '本版已移除雲端解析。請重新整理頁面，使用內建的 PDF／圖片／Excel 本機辨識。',
      });
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    const requestedPath = decodeURIComponent(url.pathname);
    const filePath = path.resolve(webRoot, '.' + (requestedPath === '/' ? '/index.html' : requestedPath));
    const relativePath = path.relative(webRoot, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    // Do not allow symlinks to expose files outside the packaged interface.
    const realRelative = path.relative(fs.realpathSync(webRoot), fs.realpathSync(filePath));
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    response.writeHead(200, {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; connect-src 'self' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;",
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': fs.statSync(filePath).size,
      'Cache-Control': 'no-store',
    });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(filePath).on('error', () => response.destroy()).pipe(response);
  } catch {
    if (!response.headersSent) response.writeHead(400);
    response.end('Bad request');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? '連接埠 8888 已被其他程式使用，請先關閉該程式。'
    : `本機服務啟動失敗：${error.message}`);
  process.exitCode = 1;
});
// Bind to localhost only. IPv4 is explicit so Windows does not expose this app on the LAN.
server.listen(port, '127.0.0.1', () => {
  console.log(`成衣訂單轉換系統已啟動：http://localhost:${port}`);
  console.log('背景服務執行中；雙擊停止訂單系統.bat 可停止。PDF／圖片／Excel 全部使用本機辨識。');
});
