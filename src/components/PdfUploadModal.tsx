import React, { useRef, useState } from 'react';
import { UploadCloud, X, ShieldCheck, Loader2, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { OrderData } from '../types/order';
import { parseGridToOrder, parseTextToOrder, LocalParseResult } from '../utils/localPoParser';
import { readLocalDocument } from '../utils/localDocumentReader';
import { normalizeCsqOrder } from '../utils/csqAccount';
import { readCsqBackup } from '../utils/csqBackup';
import { parseCsqCompanyPdf } from '../utils/csqCompanyPdf';

interface Props { isOpen: boolean; onClose: () => void; onOrderLoaded: (order: OrderData) => void }

export const PdfUploadModal: React.FC<Props> = ({ isOpen, onClose, onOrderLoaded }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [season,setSeason]=useState(''),[brand,setBrand]=useState(''),[series,setSeries]=useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<LocalParseResult | null>(null);
  const [usedOcr, setUsedOcr] = useState(false);
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const showResult = (parsed: LocalParseResult) => {
    if (parsed.order) parsed.order = normalizeCsqOrder({ ...parsed.order, reviewWarnings: parsed.warnings });
    setResult(parsed);
    setError(parsed.success ? '' : parsed.error || '無法辨識訂單欄位，請核對並調整下方文字。');
  };

  const handleFile = async (file: File) => {
    if (busy.current) return;
    busy.current = true;
    setIsLoading(true);
    setError(''); setResult(null); setExtractedText(''); setUsedOcr(false);
    setFileName(file.name);
    setProgress('正在本機讀取文件...');
    try {
      if (file.size > 40 * 1024 * 1024) throw new Error('檔案超過 40 MB，請分批辨識。');
      if (/\.json$/i.test(file.name)) {
        const order = readCsqBackup(await file.text());
        showResult({ success: true, order, warnings: order.reviewWarnings || [] });
      } else if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const rows: unknown[][] = [];
        for (const sheetName of workbook.SheetNames) {
          rows.push(...XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' }));
        }
        setExtractedText(rows.map(row => row.join('\t')).join('\n'));
        showResult(parseGridToOrder(rows, file.name));
      } else {
        let document = await readLocalDocument(file, setProgress);
        const companyParsed = document.pages ? parseCsqCompanyPdf(document.pages, file.name) : null;
        let parsed = companyParsed || parseGridToOrder(document.rows, file.name);
        setExtractedText(document.text);
        if (!parsed.success && !companyParsed && file.name.toLowerCase().endsWith('.pdf')) {
          setProgress('PDF 文字尚未對應到訂單欄位，嘗試本機 OCR 重新辨識版面...');
          const ocrDocument = await readLocalDocument(file, setProgress, true);
          const ocrParsed = parseGridToOrder(ocrDocument.rows, file.name);
          // Keep a readable original if OCR cannot recover a known layout.
          if (ocrParsed.success || !document.text.trim()) { document = ocrDocument; parsed = ocrParsed; }
        }
        setExtractedText(document.text);
        setUsedOcr(document.usedOcr);
        showResult(parsed);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '本機辨識失敗，請重試。');
    } finally { busy.current = false; setIsLoading(false); }
  };

  const applyOrder = () => {
    if (!result?.order) return;
    onOrderLoaded({ ...result.order, season:season.trim().toUpperCase()||result.order.season, brand:brand.trim()||result.order.brand, series:series.trim()||result.order.series, sourceFileName: fileName });
    setResult(null); setExtractedText(''); setError('');
    onClose();
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex gap-3 items-center">
            <UploadCloud className="w-6 h-6 text-blue-700" />
            <div><h3 className="font-bold text-slate-900">匯入 CSQ 客戶 PO</h3>
              <p className="text-xs text-slate-500">Excel、CSV、PDF、圖片與表格文字</p></div>
          </div>
          <button aria-label="關閉" onClick={onClose} disabled={isLoading} className="p-2 disabled:opacity-30"><X className="w-5 h-5" /></button>
        </div>
        <label className="desk-field"><span>品牌</span><input aria-label="匯入訂單品牌" placeholder="例如 ABC" value={brand} onChange={e=>setBrand(e.target.value)}/></label><label className="desk-field"><span>系列</span><input aria-label="匯入訂單系列" placeholder="例如 ABC Tennis SS27" value={series} onChange={e=>setSeries(e.target.value)}/></label>
        <label className="desk-field"><span>訂單季別（匯入前選擇，可於核對時調整）</span><input aria-label="匯入訂單季別" list="import-seasons" placeholder="例如 SS27 / FW27" value={season} onChange={e=>setSeason(e.target.value.toUpperCase())}/><datalist id="import-seasons">{['SS26','FW26','SS27','FW27','SS28','FW28'].map(s=><option key={s} value={s}/>)}</datalist></label>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex gap-2">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <div><strong>全部使用本機辨識，不需要 API 或金鑰</strong>
            <p className="mt-1">PDF 優先讀取文字；掃描頁與圖片使用內建中英文 OCR。文件不會傳到外部服務。</p>
            <p className="mt-1">讀取後進入工作站，核對款色、數量與客戶單價。</p>
          </div>
        </div>
        <div className="flex border-b gap-4 text-sm">
          <button disabled={isLoading} onClick={() => setActiveTab('upload')} className={`pb-2 ${activeTab === 'upload' ? 'text-blue-700 border-b-2 border-blue-600 font-bold' : ''}`}>檔案上傳</button>
          <button disabled={isLoading} onClick={() => setActiveTab('paste')} className={`pb-2 ${activeTab === 'paste' ? 'text-blue-700 border-b-2 border-blue-600 font-bold' : ''}`}>貼上文字／表格</button>
        </div>
        {activeTab === 'upload' ? (
          <div onDragOver={e => { e.preventDefault(); if (!isLoading) setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) void handleFile(e.dataTransfer.files[0]); }}
            onClick={() => { if (!isLoading) input.current?.click(); }}
            className={`border-2 border-dashed rounded-xl p-8 text-center ${isDragging ? 'bg-blue-50 border-blue-500' : 'border-slate-300'} ${isLoading ? '' : 'cursor-pointer'}`}>
            <input ref={input} type="file" accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.bmp,.json" disabled={isLoading} className="hidden"
              onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void handleFile(file); }} />
            {isLoading ? <><Loader2 className="w-9 h-9 animate-spin text-blue-600 mx-auto" /><p className="mt-3 text-sm" role="status">{progress}</p></> :
              <><FileText className="w-9 h-9 text-blue-600 mx-auto" /><p className="mt-3 font-bold text-sm">點擊或拖曳 Excel／CSV／PDF／圖片至此</p><p className="text-xs text-slate-500 mt-2">也可還原 JSON 訂單備份。掃描文件需要較多時間。</p></>}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea aria-label="訂單文字" rows={7} value={pasteText} onChange={e => setPasteText(e.target.value)} className="w-full border rounded-lg p-3 text-xs font-mono" placeholder="貼上訂單表格，保留欄位標題。" />
            <button disabled={!pasteText.trim() || isLoading} onClick={() => { setFileName('貼上文字'); setUsedOcr(false); setExtractedText(pasteText); showResult(parseTextToOrder(pasteText)); }} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-xs disabled:opacity-40">本機解析文字</button>
          </div>
        )}
        {error && <div role="alert" className="bg-rose-50 text-rose-800 border border-rose-200 p-3 rounded-xl text-xs flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
        {extractedText && !isLoading && (
          <details className="space-y-2" open={!result?.success}>
            <summary className="cursor-pointer text-xs text-slate-500">原始辨識文字（可展開修正）</summary>
            <p className="font-bold text-sm">{fileName}：{usedOcr ? 'OCR 辨識文字（請核對）' : '讀取的表格文字'}</p>
            <p className="text-xs text-slate-500">若未找到欄位，請保留換行與空白欄位；可修正辨識文字後重新解析。不同 PO 版型需對應其欄位規則。</p>
            <textarea aria-label="辨識結果文字" rows={7} value={extractedText} onChange={e => { setExtractedText(e.target.value); setResult(null); }} className="w-full border rounded-lg p-3 text-xs font-mono" />
            <button onClick={() => showResult(parseTextToOrder(extractedText, fileName))} className="text-blue-700 border border-blue-200 rounded-lg px-3 py-2 text-xs">重新解析核對後的文字</button>
          </details>
        )}
        {result?.success && result.order && (
          <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl text-xs space-y-2">
            <p className="font-bold flex gap-1 items-center"><CheckCircle2 className="w-4 h-4 text-emerald-700" />辨識完成，尚未套用</p>
            <p>PO：{result.order.poNumber}｜{result.order.items.length} 個品項｜{result.order.totalPieces} 件</p>
            {result.order.orderType === 'prepack_kit' && <p>Multiple Pack：{result.order.totalKits} 包，已按 Kit composition 配比展開尺碼件數。</p>}
            <p>客戶金額：USD {result.order.totalAmountUSD.toFixed(2)}</p>
            {result.warnings?.map((warning, index) => <p key={index} className="text-amber-800">提醒：{warning}</p>)}
            <button onClick={applyOrder} className="bg-emerald-600 text-white font-bold rounded-lg px-4 py-2">進入訂單核對</button>
          </div>
        )}
      </div>
    </div>
  );
};
