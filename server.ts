import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GenAI
const ai = new GoogleGenAI();

// Candidate models in priority order: gemini-3.1-flash-lite, gemini-flash-latest, gemini-3.8-flash
const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

function extractAndParseJSON(raw: string): any {
  let str = (raw || '').trim();
  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    str = str.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(str);
}

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

// API: Parse Order PDF, Image, Excel text, or direct text
app.post('/api/parse-order', async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName, textContent } = req.body;

    if (!fileBase64 && !textContent) {
      return res.status(400).json({ success: false, error: '請提供檔案資料 (fileBase64) 或文件文字 (textContent)' });
    }

    // Determine normalized MIME type
    let effectiveMime = (mimeType || '').toLowerCase();
    if (fileName) {
      const lowerName = fileName.toLowerCase();
      if (lowerName.endsWith('.pdf')) effectiveMime = 'application/pdf';
      else if (lowerName.endsWith('.png')) effectiveMime = 'image/png';
      else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) effectiveMime = 'image/jpeg';
      else if (lowerName.endsWith('.webp')) effectiveMime = 'image/webp';
    }

    if (!effectiveMime || effectiveMime === 'application/octet-stream') {
      effectiveMime = 'application/pdf';
    }

    let cleanBase64 = fileBase64 ? String(fileBase64).trim() : '';
    if (cleanBase64.includes(';base64,')) {
      cleanBase64 = cleanBase64.split(';base64,')[1];
    }

    const systemInstruction = `You are an expert international apparel trade specialist and universal data extraction engine for SPORTS KITE INTERNATIONAL CO., LTD.
Your mission is to parse customer garment purchase orders from ANY international client, brand, or retail buyer (e.g. Cisalfa Sport, Arena, Reusch, Fila, Ellesse, Decathlon, Intersport, Nike, Puma, Carrefour, Walmart, Target, European/American/Asian importers, or generic apparel buyer PO formats in PDF, Excel, image, or text) and extract complete structured data for generating:
1. English Proforma Invoice (P/I / S/C)
2. Factory Chinese Purchase Order (工廠中文採購單, 100% Traditional Chinese / 繁體中文)

Mapping & Recognition Rules:
1. Buyer Order No (P/O): Extract the purchase order number regardless of field label ("P/O No.", "Order No.", "Purchase Order", "Numero Ordine", "Commande", "Bestellung", "Reference").
2. Internal S/C (P/I) No:
   - For Cisalfa Sport orders (PO contains "OF" like "26OF002273"): convert to "CS" + digits without "OF" (e.g. "CS26002273").
   - For other buyers: if there is a company order reference use it, or format as "SK" + clean digits, or "PI-" + buyer PO number.
3. Customer Info:
   - Extract the customer/buyer company name, billing/headquarters address, and Tax ID/VAT/Codice Fiscale directly from the document header.
4. Dates:
   - poDate: e.g. "23/01/2026" or in original document date format.
   - piDate: Proforma Invoice date in English format (e.g. "JAN 26, 2026").
   - shipmentDate: Customer delivery/ship date (e.g. "BEFORE MAY. 15, 2026").
   - factoryShipDate: Customer ship date minus ~15 days for factory buffer (e.g. "2026年04月30日前出貨(一定嚴準時)").
5. Trade & Delivery terms: e.g. "FOB XIAMEN BY SEA" or extract Incoterms (FOB, CIF, EXW) and destination/port from document.
6. Payment Terms: e.g. "100% AMOUNT BY USANCE L/C 90 DAYS", "T/T 30 DAYS", etc.
7. Items, Styles & Packaging:
   - Item / Style Number: Look for style number labeled as "Style", "Item", "Art.", "Article", "Modello", "Ref", "Codice", "SKU", "Design No", or "Product Code". If multiple colorways share a common base style code (e.g. RCL010-001, RCL010-2020), group them under itemNo "RCL010".
   - Identify packaging type with high accuracy:
     - "MULTIPLE PACK" (單色混碼裝袋): if the document contains terms like "MULTIPLO", "PREPACK", "ASSORTED", "RATIO", "PACK", "LOT", or each bag contains a fixed ratio of mixed sizes (e.g. 1:2:2:1:1 = 7 pcs/pack).
     - "NORMAL PACK" (一般單碼裝): if garments are packed in standard individual single-size bags without ratio packaging.
   - packingAnalysisReason: explain in Traditional Chinese why this order is classified as NORMAL PACK or MULTIPLE PACK.
   - Chinese product name (繁體中文): translate or summarize garment type (e.g. "男童短袖T恤", "女士運動短褲", "連帽針織衛衣").
   - Chinese fabric spec (繁體中文): translate composition and weight if mentioned (e.g. "面料:全滌 75D/72F小針眼布+吸濕排汗助劑 (布重:135GM/M2)").
   - Sizes array: extract all size columns/labels in sequence (e.g. ["XS", "S", "M", "L", "XL"] or ["6A", "8A", "10A", "12A", "14A"] or ["38", "40", "42", "44"]).
   - For each colorway:
     - colorCode: e.g. "050" or "01"
     - colorName: colorway name in English (e.g. "BLACK", "OPTIC WHITE", "NAVY")
     - quantitiesBySize: map quantity for each size (e.g. {"XS": 163, "S": 326, "M": 326, "L": 163, "XL": 163})
     - ratioBySize: (if prepack/multiple pack, the per-pack ratio like {"XS": 1, "S": 2, "M": 2, "L": 1, "XL": 1})
     - ratioString: e.g. "1:2:2:1:1 (7 PCS/PACK)"
     - piecesPerPack: number (e.g. 7)
     - totalQuantity: total garment pieces
   - unitPrice: Customer USD price (e.g. 2.00 or 2.30)
   - rmbPrice: Factory price in RMB if found in document, otherwise 0 (leave 0 if unknown so system highlights missing price in red).
   - supplierName: Factory name if found in document, otherwise "" (leave empty if unknown so system highlights missing supplier in red).

Output strictly valid JSON matching this schema.`;

    const promptText = `Please parse the garment purchase order from the provided document and output the complete JSON object:
{
  "orderNumber": "26OF002273",
  "piNumber": "CS26002273",
  "orderDate": "23/01/2026",
  "formattedDate": "JAN 26, 2026",
  "customerName": "CISALFA SPORT SPA",
  "customerCode": "CSQ",
  "customerAddress": "Via Boccea, 496 - 00166 Roma, CODICE FISCALE E P.IVA 03535280962",
  "shipmentDate": "BEFORE MAY. 15, 2026",
  "factoryShipDate": "2026年04月30日前出貨(一定嚴準時)",
  "port": "XIAMEN",
  "modeOfDelivery": "BY SEA",
  "deliveryTerms": "FOB XIAMEN BY SEA",
  "paymentTerms": "100% AMOUNT BY USANCE L/C 90 DAYS",
  "supplierName": "", // empty string if not found in doc
  "packingType": "NORMAL PACK", // "NORMAL PACK" or "MULTIPLE PACK"
  "packingAnalysisReason": "本訂單各尺寸獨立分開計數裝袋，無每袋混碼配比，判定為 Normal Pack 一般單碼包裝",
  "items": [
    {
      "itemNo": "AFB831W26",
      "styleName": "TSHIRT ARENA B",
      "chineseName": "ARENA男童短袖T恤",
      "description": "100% POLYESTER 75D/72F INTERLOCK DRY FIT, 145 GSM",
      "chineseSpec": "面料:全滌75D/72F雙面布+吸濕排汗助劑 (布重:145GM/M2)",
      "sizes": ["6A", "8A", "10A", "12A", "14A"],
      "unitPrice": 2.30,
      "rmbPrice": 13.50,
      "totalQuantity": 480,
      "isPrepack": false,
      "colors": [
        {
          "colorCode": "050",
          "colorName": "BLACK",
          "quantitiesBySize": { "6A": 100, "8A": 140, "10A": 140, "12A": 100, "14A": 0 },
          "totalQuantity": 480
        }
      ]
    }
  ]
}`;

    // Assemble parts
    const parts: any[] = [];
    if (cleanBase64) {
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: effectiveMime,
        },
      });
    }
    if (textContent) {
      parts.push({
        text: `--- PO DOCUMENT CONTENT ---\n${textContent}\n--- END DOCUMENT CONTENT ---`,
      });
    }
    parts.push({ text: promptText });

    // Try candidate models with fallback
    let lastError: any = null;
    let parsedData: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`[Parse Order] Attempting with model: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: parts,
          },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        const rawText = response.text || '';
        parsedData = extractAndParseJSON(rawText);
        console.log(`[Parse Order] Successfully parsed order using model ${modelName}`);
        break;
      } catch (err: any) {
        console.warn(`[Parse Order] Model ${modelName} failed:`, err.message || err);
        lastError = err;
        // Continue to next candidate model
      }
    }

    if (!parsedData) {
      throw lastError || new Error('所有 AI 模型解析均暫時無法回應，請檢查文件格式後重試');
    }

    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error parsing order:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '訂單文件解析失敗，請確認檔案清晰度或使用文字貼上功能',
    });
  }
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

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
