import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  FileSpreadsheet,
  FileCode,
  Zap,
  Globe,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ShieldCheck,
  Cpu,
  WifiOff,
} from 'lucide-react';
import { OrderData } from '../types/order';
import { samplePrepackOrder, sampleSingleColorOrder } from '../data/sampleOrders';
import { matchProductInDatabase } from '../utils/productDatabase';
import { parseGridToOrder, parseTextToOrder } from '../utils/localPoParser';
import * as XLSX from 'xlsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOrderLoaded: (order: OrderData) => void;
}

export const PdfUploadModal: React.FC<Props> = ({ isOpen, onClose, onOrderLoaded }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [parseEngine, setParseEngine] = useState<'auto' | 'offline' | 'ai'>('auto');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState<string>('');
  const [showFaq, setShowFaq] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process parsed API response into OrderData
  const processParsedOrder = (parsed: any) => {
    // 智慧分析是否為 Multiple Pack (單色混碼裝袋) 或 Normal Pack (單碼裝)
    const isMultiple =
      parsed.packingType === 'MULTIPLE PACK' ||
      (parsed.items || []).some(
        (it: any) =>
          it.isPrepack ||
          Boolean(it.kitCode) ||
          Boolean(it.ratioString) ||
          (it.colors || []).some((c: any) => c.ratioBySize || c.piecesPerPack)
      );

    let resolvedSupplier = (parsed.supplierName || '').trim();

    const formattedItems = (parsed.items || []).map((it: any, i: number) => {
      const itemNoStr = String(it.itemNo || 'STYLE').trim();
      const dbMatch = matchProductInDatabase(itemNoStr);

      if (dbMatch && dbMatch.factorySupplier && !resolvedSupplier) {
        resolvedSupplier = dbMatch.factorySupplier;
      }

      const itemSizes = it.sizes && it.sizes.length > 0 ? it.sizes : ['S', 'M', 'L', 'XL'];
      const colors = (it.colors || []).map((c: any, ci: number) => {
        let quantitiesBySize = c.quantitiesBySize || {};
        let colorQty = Number(c.totalQuantity) || 0;

        if (Object.keys(quantitiesBySize).length === 0) {
          quantitiesBySize = {};
          const perSize = Math.floor(colorQty / itemSizes.length);
          itemSizes.forEach((sz: string, idx: number) => {
            quantitiesBySize[sz] = idx === 0 ? colorQty - perSize * (itemSizes.length - 1) : perSize;
          });
        } else {
          colorQty = Object.values(quantitiesBySize).reduce(
            (sum: number, val: any) => sum + (Number(val) || 0),
            0
          );
        }

        return {
          id: `c-${i}-${ci}`,
          colorCode: String(c.colorCode || '050'),
          colorName: String(c.colorName || 'COLOR'),
          quantitiesBySize,
          ratioBySize: c.ratioBySize,
          ratioString: c.ratioString,
          piecesPerPack: c.piecesPerPack,
          totalQuantity: colorQty,
        };
      });

      const totalQty =
        Number(it.totalQuantity) || colors.reduce((sum: number, clr: any) => sum + clr.totalQuantity, 0);

      // 客人美金單價 (PO 原價)
      const unitUSD = Number(it.unitPrice) || (dbMatch ? dbMatch.customerPriceUSD || dbMatch.unitPriceUSD || 0 : 0);

      // 工廠採購單價：優先從中英文對照資料庫抓取，如果都沒有則為 0 (將字體反紅警示使用者填寫微調)
      let unitRMB = 0;
      if (dbMatch) {
        if (dbMatch.factoryCurrency === 'RMB' && dbMatch.factoryPrice) {
          unitRMB = dbMatch.factoryPrice;
        } else if (dbMatch.unitPriceRMB) {
          unitRMB = dbMatch.unitPriceRMB;
        } else if (Number(it.rmbPrice) > 0) {
          unitRMB = Number(it.rmbPrice);
        }
      } else if (Number(it.rmbPrice) > 0) {
        unitRMB = Number(it.rmbPrice);
      }

      // 中文品名與面料規格：優先自資料庫抓取
      const chineseName = dbMatch?.chineseName || it.chineseName || '';
      const chineseSpec = dbMatch?.chineseSpec || it.chineseSpec || '';

      return {
        id: `item-${i + 1}`,
        itemNo: itemNoStr,
        styleName: String(it.styleName || it.itemNo || 'GARMENT').trim(),
        chineseName: chineseName.trim(),
        description: String(it.description || it.specDescription || '').trim(),
        chineseSpec: chineseSpec.trim(),
        sizes: itemSizes,
        unitPriceUSD: unitUSD,
        unitPriceRMB: unitRMB,
        totalQuantity: totalQty,
        totalAmountUSD: totalQty * unitUSD,
        totalAmountRMB: totalQty * unitRMB,
        isPrepack: isMultiple || Boolean(it.isPrepack),
        colors:
          colors.length > 0
            ? colors
            : [
                {
                  id: `c-${i}-0`,
                  colorCode: '050',
                  colorName: 'COLOR',
                  quantitiesBySize: { [itemSizes[0]]: totalQty },
                  totalQuantity: totalQty,
                },
              ],
      };
    });

    const formattedOrder: OrderData = {
      orderType: isMultiple ? 'prepack_kit' : formattedItems.length > 1 ? 'multi_color' : 'single_color',
      packingType: isMultiple ? 'MULTIPLE PACK' : 'NORMAL PACK',
      poNumber: parsed.orderNumber || '25OF000000',
      piNumber: parsed.piNumber || 'CS25000000',
      customerCode: parsed.customerCode || 'CSQ',
      customerName: parsed.customerName || 'CISALFA SPORT SPA',
      customerAddress:
        parsed.customerAddress || 'Via Boccea, 496 - 00166 Roma, CODICE FISCALE E P.IVA 03535280962',
      poDate: parsed.orderDate || '23/01/2026',
      piDate: parsed.formattedDate || 'JAN 26, 2026',
      shipmentDate: parsed.shipmentDate || 'BEFORE MAY. 15, 2026',
      factoryShipDate: parsed.factoryShipDate || '2026年04月30日前出貨(一定嚴準時)',
      paymentTerms: parsed.paymentTerms || '100% AMOUNT BY USANCE L/C 90 DAYS',
      tradeTerms: parsed.deliveryTerms || 'FOB XIAMEN BY SEA',
      port: parsed.port || 'XIAMEN',
      modeOfDelivery: parsed.modeOfDelivery || 'BY SEA',
      deliveryAddress:
        parsed.deliveryAddress ||
        'CI MAG. SNATT, VIA GALILEO GALILEI, 21, 42024 CASTELNOVO DI SOTTO, RE, ITA',
      sellerCompany: 'SPORTS KITE INTERNATIONAL CO.,LTD',
      bankInfo: {
        beneficiary: 'SPORTS KITE INTERNATIONAL CO., LTD.',
        bankName: 'MEGA INTERNATIONAL COMMERCIAL BANK CO.,LTD. SUNG NAN BRANCH',
        address: '234, SEC. 5, NANKING EAST RD., TAIPEI, 105, TAIWAN, R.O.C',
        accountNo: '04253004522',
        swiftCode: 'ICBCTWTP042',
      },
      remarks: [
        '1. PLUS 3% IN QUANTITY AND VALUE IS ACCEPTABLE',
        '2. THIRD PARTY DOCUMENT ALSO ACCEPTABLE',
        '3. PARTIAL SHIPMENT ALLOWED',
      ],
      // 工廠供應商：若無法抓取則留空（反紅標記），讓使用者線上微調填寫
      factorySupplier: resolvedSupplier,
      supplierCode: 'LA',
      factoryTerms:
        '出貨後備齊重量裝箱明細, 請款發票, 本公司於收到此份文件後15日即以美金T/T支付貨款。人民幣貨款, 美金與人民幣匯率以出貨當日水單兌換匯率為憑',
      deliveryPlace: '待通知',
      complianceClause: '****所有主副料均需環保,符合歐洲REACH環保標準****',
      items: formattedItems,
      totalPieces: 0,
      totalAmountUSD: 0,
      totalAmountRMB: 0,
    };

    // Calculate totals
    formattedOrder.totalPieces = formattedOrder.items.reduce(
      (sum, item) => sum + (item.totalQuantity || item.colors.reduce((cs, c) => cs + c.totalQuantity, 0)),
      0
    );
    formattedOrder.totalAmountUSD = formattedOrder.items.reduce(
      (sum, item) => sum + (item.totalAmountUSD || item.totalQuantity * item.unitPriceUSD),
      0
    );
    formattedOrder.totalAmountRMB = formattedOrder.items.reduce(
      (sum, item) => sum + (item.totalAmountRMB || item.totalQuantity * item.unitPriceRMB),
      0
    );

    return formattedOrder;
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);
    setProgressStep('正在讀取文件內容...');

    const fileName = file.name.toLowerCase();
    const isStandaloneProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

    // 1. Excel File (.xlsx, .xls) or CSV
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      try {
        setProgressStep('正在讀取工作表二維陣列資料...');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // 若使用者指定純離線模式，或處於單機 file:/// 環境，直接呼叫本機純離線引擎（0 API）
        if (parseEngine === 'offline' || isStandaloneProtocol) {
          setProgressStep('🛡️ 本機純離線引擎正在解析款號、尺寸配比與單價 (0 API / 0 外部通訊)...');
          const localResult = parseGridToOrder(rows, file.name);
          if (localResult.success && localResult.order) {
            setSuccessInfo(
              `🎉 【純本機 0 API 解析成功】訂單號：${localResult.order.poNumber}，已分析為：${localResult.recognizedFormat}，共 ${localResult.order.items.length} 個品項`
            );
            setTimeout(() => {
              onOrderLoaded(localResult.order!);
              onClose();
            }, 800);
            return;
          } else {
            throw new Error(localResult.error || '本機演算法未能識別出有效訂單內容');
          }
        }

        // 自動模式或 AI 優先模式：優先嘗試 AI，若網路斷線或離線則無縫切換本機解析
        try {
          setProgressStep('AI 正在識別 Excel 欄位、款號、數量與價格...');
          let extractedText = `EXCEL FILENAME: ${file.name}\n`;
          workbook.SheetNames.forEach((sheetName) => {
            extractedText += `\n--- SHEET: ${sheetName} ---\n`;
            const s = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(s);
            extractedText += csv + '\n';
          });

          const response = await fetch('/api/parse-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              textContent: extractedText,
              fileName: file.name,
            }),
          });

          if (!response.ok) {
            throw new Error(`雲端服務回應 (${response.status})`);
          }

          const result = await response.json();
          if (!result.success || !result.data) {
            throw new Error(result.error || '未能從此 Excel 中識別出有效訂單');
          }

          const formattedOrder = processParsedOrder(result.data);
          const packLabel =
            formattedOrder.packingType === 'MULTIPLE PACK'
              ? '📦 Multiple Pack (單色混碼裝袋)'
              : '📄 Normal Pack (一般單碼包裝)';
          setSuccessInfo(`成功解析 Excel 訂單 ${formattedOrder.poNumber}！已自動判定為：${packLabel}，共 ${formattedOrder.items.length} 個品項`);
          setTimeout(() => {
            onOrderLoaded(formattedOrder);
            onClose();
          }, 800);
          return;
        } catch (apiErr: any) {
          console.warn('雲端 API 無回應或處於離線環境，自動降級切換至【本機純離線引擎】:', apiErr);
          setProgressStep('雲端 API 未連線，已自動啟動【本機純離線演算法 (0 API)】...');
          const localResult = parseGridToOrder(rows, file.name);
          if (localResult.success && localResult.order) {
            setSuccessInfo(
              `🎉 【已自動轉為本機離線解析 (0 API)】訂單號：${localResult.order.poNumber}，共 ${localResult.order.items.length} 個品項`
            );
            setTimeout(() => {
              onOrderLoaded(localResult.order!);
              onClose();
            }, 900);
            return;
          }
          throw apiErr;
        }
      } catch (err: any) {
        setErrorMessage('解析 Excel 失敗：' + err.message);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. PDF or Image File
    if (parseEngine === 'offline' && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      setIsLoading(false);
      setErrorMessage(
        '【純本機離線模式提示】：PDF 或圖片檔案通常為掃描件或非結構化視覺排版，建議將客人 PO 另存為 Excel / CSV 或複製文字貼上，即可 100% 不依賴任何 API 直接秒速判讀！'
      );
      return;
    }

    try {
      setProgressStep('正在將文件轉換為高解析度資料傳輸...');
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const rawResult = reader.result as string;
          const base64Data = rawResult.includes(';base64,')
            ? rawResult.split(';base64,')[1]
            : rawResult;

          setProgressStep('AI 正在分析 PDF 訂單號、款號前綴、尺寸配比與顏色...');

          const response = await fetch('/api/parse-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: base64Data,
              fileName: file.name,
              mimeType: file.type || 'application/pdf',
            }),
          });

          const result = await response.json();
          if (result.success && result.data) {
            setProgressStep('正在對齊中英文規格與工廠採購單...');
            const formattedOrder = processParsedOrder(result.data);

            const packLabel =
              formattedOrder.packingType === 'MULTIPLE PACK'
                ? '📦 Multiple Pack (單色混碼裝袋)'
                : '📄 Normal Pack (一般單碼包裝)';
            setSuccessInfo(`成功解析訂單 ${formattedOrder.poNumber}！已自動分析為：${packLabel}，共 ${formattedOrder.items.length} 個品項`);
            setTimeout(() => {
              onOrderLoaded(formattedOrder);
              onClose();
            }, 800);
          } else {
            throw new Error(result.error || '未能從此文件中識別出有效訂單內容');
          }
        } catch (err: any) {
          setErrorMessage(err.message || '檔案上傳與解析失敗');
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setErrorMessage('讀取本機檔案時發生異常，請重試');
        setIsLoading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMessage(err.message || '讀取檔案發生異常');
      setIsLoading(false);
    }
  };

  // 3. Direct Text Paste
  const handleParseText = async () => {
    if (!pasteText.trim()) {
      setErrorMessage('請先貼上客人訂單文字內容！');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    const isStandaloneProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

    // 若設定純離線模式或在單機 file:/// 環境
    if (parseEngine === 'offline' || isStandaloneProtocol) {
      setProgressStep('🛡️ 本機純離線演算法正在解析貼上表格 (0 API)...');
      const localResult = parseTextToOrder(pasteText.trim());
      if (localResult.success && localResult.order) {
        setSuccessInfo(`🎉 【純本機 0 API 解析成功】訂單號：${localResult.order.poNumber}，已提取商品明細`);
        setTimeout(() => {
          onOrderLoaded(localResult.order!);
          onClose();
        }, 800);
        setIsLoading(false);
        return;
      } else {
        setErrorMessage(localResult.error || '本機演算法未能識別出有效訂單表格');
        setIsLoading(false);
        return;
      }
    }

    // 自動模式
    setProgressStep('AI 正在從文字中提取採購單結構與尺寸明細...');
    try {
      const response = await fetch('/api/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textContent: pasteText.trim(),
        }),
      });

      if (!response.ok) throw new Error(`雲端回應: ${response.status}`);
      const result = await response.json();
      if (result.success && result.data) {
        const formattedOrder = processParsedOrder(result.data);
        const packLabel =
          formattedOrder.packingType === 'MULTIPLE PACK'
            ? '📦 Multiple Pack (單色混碼裝袋)'
            : '📄 Normal Pack (一般單碼包裝)';
        setSuccessInfo(`成功解析貼上訂單 ${formattedOrder.poNumber}！已自動分析為：${packLabel}`);
        setTimeout(() => {
          onOrderLoaded(formattedOrder);
          onClose();
        }, 800);
      } else {
        throw new Error(result.error || '未能識別');
      }
    } catch (err: any) {
      console.warn('雲端 API 失敗，降級至本機文字解析:', err);
      const localResult = parseTextToOrder(pasteText.trim());
      if (localResult.success && localResult.order) {
        setSuccessInfo(`🎉 【已自動透過本機離線演算法解析 (0 API)】訂單號：${localResult.order.poNumber}`);
        setTimeout(() => {
          onOrderLoaded(localResult.order!);
          onClose();
        }, 800);
      } else {
        setErrorMessage('文字解析失敗：' + (err.message || '未能識別有效訂單格式'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <UploadCloud className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">上傳客戶原始 PO 訂單</h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  支援 0 API 純本機離線
                </span>
              </div>
              <p className="text-xs text-slate-500">支援 Excel、PDF、CSV、圖片或直接貼上表格文字</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 離線與 API 模式選擇器 */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            解析引擎模式：
          </span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-[11px] w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setParseEngine('auto')}
              className={`flex-1 sm:flex-none px-2.5 py-1 rounded-md font-bold transition-all ${
                parseEngine === 'auto'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="自動模式：有網路優先 AI，離線/單機時自動切換純本機演算法"
            >
              ⚡ 自動混合
            </button>
            <button
              type="button"
              onClick={() => setParseEngine('offline')}
              className={`flex-1 sm:flex-none px-2.5 py-1 rounded-md font-bold transition-all flex items-center justify-center gap-1 ${
                parseEngine === 'offline'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
              title="100% 純本機離線模式：不呼叫任何外部 API，不消耗 Token，完全拔掉網路線也能秒讀 Excel/CSV"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>🛡️ 100% 純本機 (0 API)</span>
            </button>
            <button
              type="button"
              onClick={() => setParseEngine('ai')}
              className={`flex-1 sm:flex-none px-2.5 py-1 rounded-md font-bold transition-all ${
                parseEngine === 'ai'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="雲端 AI 視覺模式：適合掃描圖與無規則 PDF"
            >
              🤖 雲端 AI
            </button>
          </div>
        </div>

        {/* 多客戶 PO 格式支援說明提示 */}
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl p-3 text-xs space-y-2">
          <div
            onClick={() => setShowFaq(!showFaq)}
            className="flex items-center justify-between cursor-pointer select-none text-sky-950 font-bold"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-600 shrink-0" />
              <span>常見外貿 PO 判讀問答（包含不使用 API 離線運作說明）</span>
            </div>
            <span className="text-sky-600 text-[11px] flex items-center gap-0.5 font-medium hover:underline">
              {showFaq ? '收合問答' : '展開完整解答 ▾'}
            </span>
          </div>

          {showFaq && (
            <div className="text-[11px] text-sky-900/90 space-y-2.5 pt-2 border-t border-sky-200/60 leading-relaxed">
              <div className="bg-white/80 p-2.5 rounded-lg border border-sky-200/50">
                <strong className="text-emerald-800 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  ★ 單機版是否有辦法「不使用 API」判讀客人 PO？
                </strong>
                <p className="mt-1 text-slate-700">
                  <strong>答案是：完全可以！</strong> 本系統已內建專門的<strong>「純本機離線結構化解析引擎 (0 API)」</strong>：
                  <br />
                  1. <strong>支援檔案</strong>：客人的原始 <strong>Excel (.xlsx, .xls)</strong>、<strong>CSV</strong> 或<strong>直接複製表格文字</strong>。
                  <br />
                  2. <strong>運作原理</strong>：在瀏覽器本地透過成衣欄位特徵演算法，自動辨識款號（Style/Item/Codice）、顏色、尺碼分佈矩陣（XS~5XL）與單價，<strong>完全不需連網、不發送任何資料給第三方、0 API 費用、無商業機密外流風險</strong>！
                  <br />
                  3. <strong>自動對齊本機庫</strong>：自動比對您電腦中儲存的產品資料庫，補齊中文品名、面料規格、人民幣採購價與工廠代號。
                </p>
              </div>

              <div>
                <strong className="text-sky-950 font-bold">Q1：客人很多、每個客人的 PO 格式都不同，可以直接上傳原始 PO 嗎？</strong>
                <p className="mt-0.5 text-slate-700">
                  <strong>答：完全可以，直接上傳即可！</strong> 無論使用 AI 或純本機模式，系統皆能彈性適應各國買主欄位名稱（如 P/O No, Order#, Numero Ordine 等），免套模板。
                </p>
              </div>

              <div>
                <strong className="text-sky-950 font-bold">Q2：客戶原始 PO 上沒有工廠中文名與人民幣成本，如何處理？</strong>
                <p className="mt-0.5 text-slate-700">
                  <strong>答：</strong>系統會自動以款號比對本機<strong>「產品對照庫」</strong>自動帶出工廠中文名與成本；若為全新款式，採購單上會以<strong>「亮紅字」</strong>提醒，您可直接在採購單線上點擊微調，修改後即自動存入資料庫，下次再來單秒速自動帶出！
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tab switch: 檔案上傳 vs 文字貼上 */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📁 檔案拖曳上傳 (Excel / CSV / PDF)
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'paste'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📝 直接貼上文字 / 表格 (免檔案)
          </button>
        </div>

        {activeTab === 'upload' ? (
          /* Drop zone */
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/60'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/40 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            {isLoading ? (
              <div className="py-4 space-y-3 flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-sm">正在深度解析訂單文件...</p>
                  <p className="text-xs text-blue-700 font-medium">{progressStep}</p>
                </div>
              </div>
            ) : (
              <div className="py-2 space-y-3 flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl border border-blue-200">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div className="p-3 bg-red-50 text-red-700 rounded-2xl border border-red-200">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-sm">
                    點擊或拖曳客人原始 Excel (.xlsx) / CSV / PDF 至此
                  </p>
                  <p className="text-xs text-slate-500">
                    {parseEngine === 'offline'
                      ? '🛡️ 目前為【純本機離線模式】：請上傳 Excel 或 CSV，無需任何 API 即可秒速判讀'
                      : '支援 Cisalfa、Arena、FILA、Decathlon、Nike 等國際客戶訂單'}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Text Paste Area */
          <div className="space-y-3">
            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="可直接貼上客人 PO 文字內容（如由 Excel 或郵件複製的表格、款號、顏色、各尺碼數量、單價等）..."
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {parseEngine === 'offline' ? '🛡️ 純本機離線解析：0 API 消耗' : '支援直接貼上 Excel 複製的整行表格'}
              </span>
              <button
                onClick={handleParseText}
                disabled={isLoading || !pasteText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>開始解析貼上內容</span>
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1">
              <span className="font-bold">提示：</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Success message */}
        {successInfo && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Quick test preset buttons */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              或快速載入真實客人 PO 測試案例：
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onOrderLoaded(samplePrepackOrder);
                onClose();
              }}
              className="p-2 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-lg text-left transition-all group cursor-pointer"
            >
              <div className="font-bold text-purple-950 text-[11px] group-hover:text-purple-700 flex items-center gap-1">
                <span>📦 25OF025310 混碼裝袋</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">女款 7件/包、男款 6件/包</div>
            </button>
            <button
              type="button"
              onClick={() => {
                onOrderLoaded(sampleSingleColorOrder);
                onClose();
              }}
              className="p-2 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all group cursor-pointer"
            >
              <div className="font-bold text-blue-950 text-[11px] group-hover:text-blue-700 flex items-center gap-1">
                <span>📄 26OF002273 單款單色</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">AFB831W26 黑色 480件</div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
