import React, { useState, useRef, useEffect } from 'react';
import { ProductMappingItem } from '../types/database';
import { defaultProductDatabase } from '../data/defaultProducts';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Upload,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Database,
  Sparkles,
  RotateCcw,
  Building2,
  Coins,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApplyToOrder?: (matchedItems: ProductMappingItem[]) => void;
  sharedProducts?:ProductMappingItem[];
  onProductsChange?:(products:ProductMappingItem[])=>void;
}

const STORAGE_KEY = 'SK_PRODUCT_MAPPING_DB_V2';

export const ProductDatabaseModal: React.FC<Props> = ({ isOpen, onClose, onApplyToOrder,sharedProducts,onProductsChange }) => {
  const [products, setLocalProducts] = useState<ProductMappingItem[]>(() => {
    if(sharedProducts)return sharedProducts;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return defaultProductDatabase;
  });
  const setProducts:React.Dispatch<React.SetStateAction<ProductMappingItem[]>>=change=>{const next=typeof change==='function'?change(products):change;setLocalProducts(next);onProductsChange?.(next);};
  useEffect(()=>{if(sharedProducts)setLocalProducts(sharedProducts);},[sharedProducts]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductMappingItem | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if(sharedProducts)return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch (e) {
      console.error(e);
    }
  }, [products]);

  if (!isOpen) return null;

  const filteredProducts = products.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.itemNo.toLowerCase().includes(term) ||
      (p.factorySupplier && p.factorySupplier.toLowerCase().includes(term)) ||
      p.styleNameEN.toLowerCase().includes(term) ||
      p.chineseName.toLowerCase().includes(term) ||
      p.chineseSpec.toLowerCase().includes(term)
    );
  });

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.itemNo.trim()) {
      setNotice({ type: 'error', message: '請輸入產品編號！' });
      return;
    }

    if (products.some((p) => p.itemNo === editingItem.itemNo && p.id !== editingItem.id)) {
      setNotice({ type: 'error', message: `產品編號「${editingItem.itemNo}」已存在於資料庫中！` });
      return;
    }

    const normalizedItem: ProductMappingItem = {
      ...editingItem,
      factorySupplier: editingItem.factorySupplier?.trim() || '晉江市蜀諾服裝有限公司',
      factoryCurrency: editingItem.factoryCurrency || 'RMB',
      factoryPrice: Number(editingItem.factoryPrice) || 0,
      customerPriceUSD: Number(editingItem.customerPriceUSD) || 0,
      unitPriceUSD: Number(editingItem.customerPriceUSD) || Number(editingItem.unitPriceUSD) || 0,
      unitPriceRMB:
        editingItem.factoryCurrency === 'RMB'
          ? Number(editingItem.factoryPrice) || 0
          : Number(editingItem.unitPriceRMB) || 0,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    if (editingItem.id) {
      setProducts(products.map((p) => (p.id === editingItem.id ? normalizedItem : p)));
      setNotice({ type: 'success', message: `成功更新產品「${normalizedItem.itemNo}」對照資料！` });
    } else {
      const newItem: ProductMappingItem = {
        ...normalizedItem,
        id: 'prod_' + Date.now(),
      };
      setProducts([newItem, ...products]);
      setNotice({ type: 'success', message: `成功新增產品「${newItem.itemNo}」至資料庫！` });
    }

    setIsEditing(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (id: string, itemNo: string) => {
    if (window.confirm(`確定要刪除產品編號「${itemNo}」的對照資料嗎？`)) {
      setProducts(products.filter((p) => p.id !== id));
      setNotice({ type: 'success', message: `已刪除產品「${itemNo}」` });
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('確定要恢復預設成衣產品對照資料庫嗎？現有自訂修改將被覆蓋。')) {
      setProducts(defaultProductDatabase);
      setNotice({ type: 'success', message: '已恢復為系統預設對照資料庫！' });
    }
  };

  // 範本下載 Excel (無尺碼欄位，包含工廠名稱與幣別)
  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('對照庫範本');

    ws.columns = [
      { header: '產品編號 (Item No.)', key: 'itemNo', width: 22 },
      { header: '工廠名稱 (Factory Supplier)', key: 'factorySupplier', width: 26 },
      { header: '英文品名 (Style Name EN)', key: 'styleNameEN', width: 28 },
      { header: '中文品名 (Chinese Name)', key: 'chineseName', width: 24 },
      { header: '英文面料規格 (Spec EN)', key: 'specEN', width: 40 },
      { header: '中文面料規格 (Chinese Spec)', key: 'chineseSpec', width: 44 },
      { header: '客人美金單價 (USD)', key: 'customerPriceUSD', width: 18 },
      { header: '工廠採購幣別 (RMB / USD)', key: 'factoryCurrency', width: 22 },
      { header: '工廠採購單價 (Factory Price)', key: 'factoryPrice', width: 24 },
    ];

    const headRow = ws.getRow(1);
    headRow.font = { name: 'Microsoft JhengHei', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headRow.height = 24;

    // 示範範例列 1 (人民幣單價)
    ws.addRow({
      itemNo: 'ABCRW1036S26',
      factorySupplier: '晉江市蜀諾服裝有限公司',
      styleNameEN: 'T-SHIRT ABC WOMAN',
      chineseName: 'ABC女士短袖T恤',
      specEN: '100% POLYESTER SMALL NEEDLE WITH DRI-FIT 75D/72F WT:135GM/M2',
      chineseSpec: '面料:全滌 75D/72F小針眼布+吸濕排汗助劑 (布重:135GM/M2)',
      customerPriceUSD: 2.0,
      factoryCurrency: 'RMB',
      factoryPrice: 11.5,
    });

    // 示範範例列 2 (美金單價)
    ws.addRow({
      itemNo: 'AFB831W26',
      factorySupplier: '晉江市蜀諾服裝有限公司',
      styleNameEN: 'TSHIRT ARENA B',
      chineseName: 'ARENA男童短袖T恤',
      specEN: '100% POLYESTER 75D/72F INTERLOCK DRY FIT, 145 GSM',
      chineseSpec: '面料:全滌75D/72F雙面布+吸濕排汗助劑 (布重:145GM/M2)',
      customerPriceUSD: 2.3,
      factoryCurrency: 'USD',
      factoryPrice: 1.85,
    });

    for (let r = 2; r <= 3; r++) {
      const row = ws.getRow(r);
      row.font = { name: 'Microsoft JhengHei', size: 10 };
      row.height = 20;
      for (let c = 1; c <= 9; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
        if (c === 7 || c === 9) {
          row.getCell(c).numFmt = '0.00';
          row.getCell(c).alignment = { horizontal: 'right' };
        }
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `產品中英文對照資料庫_空白範本.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 匯出對照資料庫 Excel
  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('產品中英文對照庫');

    ws.columns = [
      { header: '產品編號 (Item No.)', key: 'itemNo', width: 20 },
      { header: '工廠名稱 (Factory Supplier)', key: 'factorySupplier', width: 26 },
      { header: '英文品名 (Style Name EN)', key: 'styleNameEN', width: 28 },
      { header: '中文品名 (Chinese Name)', key: 'chineseName', width: 24 },
      { header: '英文面料規格 (Spec EN)', key: 'specEN', width: 36 },
      { header: '中文面料規格 (Chinese Spec)', key: 'chineseSpec', width: 44 },
      { header: '客人美金單價 (USD)', key: 'customerPriceUSD', width: 18 },
      { header: '工廠採購幣別 (RMB / USD)', key: 'factoryCurrency', width: 20 },
      { header: '工廠採購單價 (Factory Price)', key: 'factoryPrice', width: 24 },
    ];

    const headRow = ws.getRow(1);
    headRow.font = { name: 'Microsoft JhengHei', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headRow.height = 24;

    products.forEach((p) => {
      const priceVal =
        p.factoryPrice !== undefined
          ? p.factoryPrice
          : p.factoryCurrency === 'USD'
          ? p.unitPriceUSD || 0
          : p.unitPriceRMB || 0;

      const custPrice = p.customerPriceUSD ?? p.unitPriceUSD ?? 0;

      ws.addRow({
        itemNo: p.itemNo,
        factorySupplier: p.factorySupplier || '晉江市蜀諾服裝有限公司',
        styleNameEN: p.styleNameEN,
        chineseName: p.chineseName,
        specEN: p.specEN,
        chineseSpec: p.chineseSpec,
        customerPriceUSD: custPrice,
        factoryCurrency: p.factoryCurrency || 'RMB',
        factoryPrice: priceVal,
      });
    });

    for (let r = 2; r <= products.length + 1; r++) {
      const row = ws.getRow(r);
      row.font = { name: 'Microsoft JhengHei', size: 10 };
      row.height = 20;
      for (let c = 1; c <= 9; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
        if (c === 7 || c === 9) {
          row.getCell(c).numFmt = '0.00';
          row.getCell(c).alignment = { horizontal: 'right' };
        }
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `產品中英文對照資料庫_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 匯入上傳 Excel 檔案
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (rows.length < 2) {
        setNotice({ type: 'error', message: '上傳的 Excel 檔案沒有足夠的產品資料！' });
        return;
      }

      const imported: ProductMappingItem[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;

        const itemNo = String(row[0]).trim();
        // 欄位容錯判斷：若第2欄是工廠名稱
        let factorySupplier = '晉江市蜀諾服裝有限公司';
        let styleNameEN = '';
        let chineseName = '';
        let specEN = '';
        let chineseSpec = '';
        let customerPriceUSD = 0;
        let factoryCurrency: 'RMB' | 'USD' = 'RMB';
        let factoryPrice = 0;

        if (rows[0] && String(rows[0][1]).includes('工廠')) {
          // 格式: itemNo, factorySupplier, styleNameEN, chineseName, specEN, chineseSpec, customerPriceUSD, factoryCurrency, factoryPrice
          factorySupplier = String(row[1] || '晉江市蜀諾服裝有限公司').trim();
          styleNameEN = String(row[2] || '').trim();
          chineseName = String(row[3] || '').trim();
          specEN = String(row[4] || '').trim();
          chineseSpec = String(row[5] || '').trim();
          customerPriceUSD = Number(row[6]) || 0;
          const curStr = String(row[7] || '').toUpperCase();
          factoryCurrency = curStr.includes('USD') ? 'USD' : 'RMB';
          factoryPrice = Number(row[8]) || 0;
        } else {
          // 傳統舊格式容錯
          styleNameEN = String(row[1] || '').trim();
          chineseName = String(row[2] || '').trim();
          specEN = String(row[3] || '').trim();
          chineseSpec = String(row[4] || '').trim();
          customerPriceUSD = Number(row[5]) || 0;
          factoryPrice = Number(row[6]) || 0;
          factoryCurrency = 'RMB';
        }

        imported.push({
          id: 'imp_' + Date.now() + '_' + i,
          itemNo,
          factorySupplier,
          styleNameEN,
          chineseName,
          specEN,
          chineseSpec,
          customerPriceUSD,
          factoryCurrency,
          factoryPrice,
          unitPriceUSD: customerPriceUSD,
          unitPriceRMB: factoryCurrency === 'RMB' ? factoryPrice : 0,
          updatedAt: new Date().toISOString().split('T')[0],
        });
      }

      if (imported.length === 0) {
        setNotice({ type: 'error', message: '未能從上傳的 Excel 中辨識出有效資料！' });
        return;
      }

      // Merge by itemNo
      const existingMap = new Map(products.map((p) => [p.itemNo, p]));
      imported.forEach((item) => {
        existingMap.set(item.itemNo, item);
      });

      const updated = Array.from(existingMap.values());
      setProducts(updated);
      setNotice({
        type: 'success',
        message: `成功從 Excel 匯入 ${imported.length} 筆對照資料！現有總筆數: ${updated.length}`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', message: '解析上傳檔案失敗：' + err.message });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  產品中英文對照資料庫 (品名 / 面料 / 工廠 / 價格)
                </h3>
                <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
                  共 {products.length} 款產品
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                可設定工廠名稱（自動帶入採購單）、工廠單價（支援 RMB 或 USD 切換），尺碼直接依客人 PO 自動顯示
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋產品編號、工廠名稱、品名、面料成分..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold shadow-2xs transition-all"
              title="下載標準格式 Excel 空白範本，填寫後可直接匯入"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              下載範本 Excel
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold shadow-2xs transition-all"
              title="匯入已填寫的 Excel (.xlsx / .xls) 或 CSV 檔案"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              匯入 Excel / CSV
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold shadow-2xs transition-all"
              title="導出目前資料庫完整 Excel 清單"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              導出目前清單
            </button>

            {onApplyToOrder && (
              <button
                onClick={() => {
                  onApplyToOrder(products);
                  setNotice({
                    type: 'success',
                    message: '已成功將對照庫之工廠名稱、中文品名、面料規格與單價套用至當前訂單！',
                  });
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-extrabold shadow-2xs transition-all active:scale-95"
                title="自動依款號比對當前訂單，帶入工廠名稱、中文品名、面料規格與單價"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                ⚡ 套用至目前訂單
              </button>
            )}

            <button
              onClick={() => {
                setEditingItem({
                  id: '',
                  itemNo: '',
                  factorySupplier: '晉江市蜀諾服裝有限公司',
                  styleNameEN: '',
                  chineseName: '',
                  specEN: '',
                  chineseSpec: '',
                  customerPriceUSD: 0,
                  factoryPrice: 0,
                  factoryCurrency: 'RMB',
                });
                setIsEditing(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-2xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              新增產品對照
            </button>

            <button
              onClick={handleResetToDefault}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              title="恢復預設資料"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notice alert */}
        {notice && (
          <div
            className={`px-4 py-2 text-xs flex items-center justify-between ${
              notice.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{notice.message}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body: Table or Edit Form */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* 為什麼需要中英文對照資料庫說明卡片 */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-950 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>💡 產品中英文對照資料庫功能亮點</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-slate-700">
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/60 space-y-1">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  1. 工廠名稱直接帶入
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  每款商品可指派合作工廠（如晉江市蜀諾服裝有限公司），套用時自動更新採購單供應商抬頭與回簽欄位。
                </p>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/60 space-y-1">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  2. 工廠單價支援 RMB 或 USD
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  採購單價可自由設定為人民幣 (RMB) 或美金 (USD)，並可與採購單幣別切換自動連動計算。
                </p>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/60 space-y-1">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  3. 尺碼依據客人 PO 自動顯示
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  免除手動維護固定尺碼的困擾，系統直接讀取客人訂單各款號的尺碼進行配比與總數展開。
                </p>
              </div>
            </div>
          </div>

          {isEditing && editingItem ? (
            /* Editing form */
            <form
              onSubmit={handleSaveItem}
              className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs"
            >
              <div className="font-bold text-slate-900 text-sm flex items-center justify-between border-b pb-2">
                <span>{editingItem.id ? `編輯產品對照：${editingItem.itemNo}` : '新增產品中英文對照'}</span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  取消
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">產品編號 (Item No.) *</label>
                  <input
                    type="text"
                    required
                    placeholder="如：ABCRW1036S26"
                    value={editingItem.itemNo}
                    onChange={(e) => setEditingItem({ ...editingItem, itemNo: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    工廠名稱 (Factory Supplier) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="如：晉江市蜀諾服裝有限公司"
                    value={editingItem.factorySupplier}
                    onChange={(e) => setEditingItem({ ...editingItem, factorySupplier: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">英文品名 (Style Name EN)</label>
                  <input
                    type="text"
                    placeholder="如：T-SHIRT ABC WOMAN"
                    value={editingItem.styleNameEN}
                    onChange={(e) => setEditingItem({ ...editingItem, styleNameEN: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">中文品名 (繁體)</label>
                  <input
                    type="text"
                    placeholder="如：ABC女士短袖T恤"
                    value={editingItem.chineseName}
                    onChange={(e) => setEditingItem({ ...editingItem, chineseName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">客人美金單價 (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="如：2.00"
                    value={editingItem.customerPriceUSD ?? editingItem.unitPriceUSD ?? 0}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        customerPriceUSD: Number(e.target.value) || 0,
                        unitPriceUSD: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    工廠採購單價 (Factory Price)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={editingItem.factoryCurrency || 'RMB'}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          factoryCurrency: e.target.value as 'RMB' | 'USD',
                        })
                      }
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                    >
                      <option value="RMB">RMB (人民幣)</option>
                      <option value="USD">USD (美金)</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="如：11.50"
                      value={editingItem.factoryPrice ?? (editingItem.factoryCurrency === 'USD' ? editingItem.unitPriceUSD : editingItem.unitPriceRMB) ?? 0}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          factoryPrice: Number(e.target.value) || 0,
                          unitPriceRMB:
                            (editingItem.factoryCurrency || 'RMB') === 'RMB'
                              ? Number(e.target.value) || 0
                              : editingItem.unitPriceRMB,
                          unitPriceUSD:
                            editingItem.factoryCurrency === 'USD'
                              ? Number(e.target.value) || 0
                              : editingItem.unitPriceUSD,
                        })
                      }
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-semibold text-amber-900"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">英文面料說明 (Spec EN)</label>
                  <textarea
                    rows={2}
                    placeholder="如：100% POLYESTER SMALL NEEDLE WITH DRI-FIT 75D/72F WT:135GM/M2"
                    value={editingItem.specEN}
                    onChange={(e) => setEditingItem({ ...editingItem, specEN: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    中文面料規格與克重 (繁體，採購單將獨立放於下一列)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="如：面料:全滌 75D/72F小針眼布+吸濕排汗助劑 (布重:135GM/M2)"
                    value={editingItem.chineseSpec}
                    onChange={(e) => setEditingItem({ ...editingItem, chineseSpec: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-2xs"
                >
                  儲存對照
                </button>
              </div>
            </form>
          ) : null}

          {/* Database Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                  <th className="p-2.5 w-28">產品編號</th>
                  <th className="p-2.5 w-36">工廠名稱</th>
                  <th className="p-2.5 w-44">品名 (中 / 英)</th>
                  <th className="p-2.5">面料成分與克重規格 (中 / 英)</th>
                  <th className="p-2.5 w-20 text-right">客人單價</th>
                  <th className="p-2.5 w-28 text-right">工廠採購單價</th>
                  <th className="p-2.5 w-20 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      沒有找到符合條件的產品對照資料
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const factoryCur = p.factoryCurrency || 'RMB';
                    const factoryPr =
                      p.factoryPrice !== undefined
                        ? p.factoryPrice
                        : factoryCur === 'USD'
                        ? p.unitPriceUSD || 0
                        : p.unitPriceRMB || 0;
                    const custPr = p.customerPriceUSD ?? p.unitPriceUSD ?? 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 align-top">
                          <div className="font-mono font-bold text-blue-900 text-[13px]">{p.itemNo}</div>
                        </td>
                        <td className="p-2.5 align-top">
                          <div className="font-semibold text-slate-800 text-[11.5px] flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{p.factorySupplier || '晉江市蜀諾服裝有限公司'}</span>
                          </div>
                        </td>
                        <td className="p-2.5 align-top space-y-0.5">
                          <div className="font-bold text-slate-900">{p.chineseName}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{p.styleNameEN}</div>
                        </td>
                        <td className="p-2.5 align-top space-y-1">
                          <div className="text-slate-800 font-medium leading-relaxed bg-amber-50/40 p-1 rounded border border-amber-200/50">
                            {p.chineseSpec}
                          </div>
                          <div className="text-[10.5px] text-slate-500 leading-snug">{p.specEN}</div>
                        </td>
                        <td className="p-2.5 align-top text-right font-mono font-bold text-slate-900">
                          ${custPr.toFixed(2)}
                        </td>
                        <td className="p-2.5 align-top text-right font-mono font-bold">
                          <span className={factoryCur === 'USD' ? 'text-blue-800' : 'text-amber-900'}>
                            {factoryCur === 'USD' ? '$' : '¥'}
                            {factoryPr.toFixed(2)}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-normal">
                            ({factoryCur})
                          </span>
                        </td>
                        <td className="p-2.5 align-top text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingItem({
                                  ...p,
                                  factorySupplier: p.factorySupplier || '晉江市蜀諾服裝有限公司',
                                  factoryCurrency: p.factoryCurrency || 'RMB',
                                  factoryPrice: factoryPr,
                                  customerPriceUSD: custPr,
                                });
                                setIsEditing(true);
                              }}
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              title="編輯"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(p.id, p.itemNo)}
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                              title="刪除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>已保存至瀏覽器儲存區，隨時可用於新訂單自動代入工廠名稱、中文品名、面料與價格</span>
          </div>
          <div className="flex items-center gap-2">
            {onApplyToOrder && (
              <button
                onClick={() => {
                  onApplyToOrder(products);
                  setNotice({
                    type: 'success',
                    message: '已成功將對照庫之工廠名稱、中文品名、面料規格與單價套用至當前訂單！',
                  });
                }}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                ⚡ 一鍵套用至當前訂單
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold"
            >
              完成關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
