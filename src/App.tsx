import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import {WorkbookPreview} from './components/WorkbookPreview';
import {loadDocumentTemplates,buildReferenceDocument,type DocumentTemplates,type DocumentKind} from './utils/referenceDocuments';
import { Upload, ArrowRight, FileText, ClipboardCheck, Database, HelpCircle, Download, Check, ShieldCheck, ChevronRight, AlertCircle, Truck, CalendarClock, FlaskConical, BarChart3 } from 'lucide-react';
import { WorkspaceModules } from './components/WorkspaceModules';
import { modules, WORKSPACE_KEY, normalizeWorkspace, loadWorkspace, emptyWorkspace, upsertOrder, type Workspace, type ModuleId, type ReferenceSnapshot } from './utils/workspace';
import { PdfUploadModal } from './components/PdfUploadModal';
import { ProductDatabaseModal } from './components/ProductDatabaseModal';
import { StandaloneInfoModal } from './components/StandaloneInfoModal';
import { CsqOrderReview } from './components/CsqOrderReview';
import type { OrderData } from './types/order';
import type { ProductMappingItem } from './types/database';
import { normalizeCsqOrder, csqIssues, factoryDocument } from './utils/csqAccount';
import {saveWorkbookToFile} from './utils/excelExport';
import { loadErpProducts, applyErpProducts, erpFactoryOrders, type ErpSnapshot } from './utils/erpProducts';
import { ErpQuoteSelector } from './components/ErpQuoteSelector';
import {FactoryPurchaseSettings} from './components/FactoryPurchaseSettings';
import { loadCsqReferences, referenceCoverage, type CsqReference } from './utils/csqReferences';
import {NasGate,type SharedSession} from './components/NasGate';

const SAVED_KEY = 'SK_SAVED_UPLOADED_ORDER';
type Page = 'review' | 'documents';
export default function Root(){return <NasGate>{shared=><App key={shared?.user.id||'local'} shared={shared}/>}</NasGate>;}
function App({shared}:{shared?:SharedSession}) {
  const [order, setOrder] = useState<OrderData | null>(() => {
    if(shared)return shared.workspace.orders[0]||null;
    try { const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null'); return saved?.poNumber && Array.isArray(saved.items) ? normalizeCsqOrder(saved) : null; } catch { return null; }
  });
  const [page, setPage] = useState<Page>('review');
  const [module, setModule] = useState<ModuleId>('orders');
  const [workspace,setWorkspace]=useState<Workspace>(()=>{if(shared)return shared.workspace;try{const w=loadWorkspace(localStorage.getItem(WORKSPACE_KEY),order),mapping=localStorage.getItem('SK_PRODUCT_MAPPING_DB_V2');return mapping?{...w,productMappings:JSON.parse(mapping)}:w;}catch{return emptyWorkspace();}});
  const [workspaceRefs,setWorkspaceRefs]=useState<ReferenceSnapshot|null>(null);
  const [workspaceRefError,setWorkspaceRefError]=useState('');
  const saveWorkspace=(next:Workspace)=>{next=normalizeWorkspace(next);if(shared){setWorkspace(next);shared.save(next);return;}try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify(next));setWorkspace(next);}catch{setNotice('本機儲存空間不足，修改尚未保存。請下載完整工作站備份。');}};
  const restoreWorkspace=(next:Workspace)=>{next=normalizeWorkspace(next);if(shared){if(shared.user.role!=='admin'){setNotice('完整資料移轉由管理員操作。');return;}setWorkspace(next);shared.restore(next);return;}try{const current=next.orders.find(o=>o.poNumber===order?.poNumber)||next.orders[0]||null;if(current)localStorage.setItem(SAVED_KEY,JSON.stringify(current));localStorage.setItem(WORKSPACE_KEY,JSON.stringify(next));setOrder(current);setWorkspace(next);setNotice('工作站備份已合併。');}catch{setNotice('本機儲存空間不足，備份未完成保存。');}};
  const refreshWorkspaceRefs=async()=>{try{const response=await fetch(`${import.meta.env.BASE_URL}csq-workspace-references.json`,{cache:'no-store'});if(!response.ok)throw new Error('參考資料尚未建立。請雙擊「更新CSQ參考資料.bat」。');const data=await response.json();if(!Array.isArray(data.tracking)||!Array.isArray(data.files))throw new Error('參考資料格式不符。');setWorkspaceRefs(data);setWorkspaceRefError('');}catch(e){setWorkspaceRefError(e instanceof Error?e.message:'參考資料無法讀取');}};
  useEffect(()=>{void refreshWorkspaceRefs();},[]);
  useEffect(()=>{if(!shared)saveWorkspace(workspace);},[]);
  useEffect(()=>{if(shared){setWorkspace(shared.workspace);setOrder(previous=>shared.workspace.orders.find(o=>o.poNumber===previous?.poNumber)||shared.workspace.orders[0]||null);}},[shared?.workspace]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [preview, setPreview] = useState<DocumentKind>('pi');
  const [documentTemplates,setDocumentTemplates]=useState<DocumentTemplates|null>(null);
  const [templateError,setTemplateError]=useState('');
  const refreshTemplates=async()=>{try{setDocumentTemplates(await loadDocumentTemplates());setTemplateError('');}catch(e){setTemplateError(e instanceof Error?e.message:'文件範本讀取失敗');}};
  useEffect(()=>{void refreshTemplates();},[]);
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState('');
  const [erpBusy, setErpBusy] = useState(false);
  const [erpStatus, setErpStatus] = useState('');
  const [erpSnapshot, setErpSnapshot] = useState<ErpSnapshot|null>(null);
  const [quoteChoices,setQuoteChoices] = useState<Record<string,string>>({});
  useEffect(()=>{void loadErpProducts().then(setErpSnapshot).catch(()=>{});},[]);
  useEffect(()=>{setQuoteChoices({});},[order?.poNumber]);
  const [factorySelection, setFactorySelection] = useState('');
  const [references, setReferences] = useState<CsqReference[]>([]);
  const [referenceStatus, setReferenceStatus] = useState('正在讀取本機參考成份…');
  const [referencesReady, setReferencesReady] = useState(false);
  const refreshReferences = async () => {
    setReferencesReady(false);
    try {
      const snapshot = await loadCsqReferences();
      setReferences(snapshot.records);
      setReferenceStatus(`參考成份更新：${new Date(snapshot.updatedAt).toLocaleString()}${snapshot.warnings.length ? `；${snapshot.warnings.length} 個檔案無法讀取` : ''}`);
    } catch (error) { setReferences([]); setReferenceStatus(error instanceof Error ? error.message : '參考成份未載入，暫用原始 PO 說明。'); }
    finally { setReferencesReady(true); }
  };
  useEffect(() => { void refreshReferences(); }, []);
  const importErp = async () => {
    if(!order || erpBusy) return;
    setErpBusy(true);
    try {
      const snapshot=await loadErpProducts();
      setErpSnapshot(snapshot);
      const result=applyErpProducts(order,snapshot,quoteChoices);
      updateOrder(result.order);
      setQuoteChoices({});
      const matchedStyles=new Set(result.order.items.filter(i=>i.factoryProduct).map(i=>i.itemNo)).size;
      const pendingStyles=new Set(result.order.items.filter(i=>!i.factoryProduct).map(i=>i.itemNo)).size;
      setErpStatus(`已帶入 ${matchedStyles} 款工廠報價${pendingStyles?`，${pendingStyles} 款待確認，請在下方選擇報價`:''}。資料更新：${new Date(snapshot.updatedAt).toLocaleString()}。${result.issues.filter(issue=>!issue.includes('多筆供應商報價')).join(' ')}`);
      setPreview('factory');
      setFactorySelection('');
    } catch(error) { setErpStatus(error instanceof Error?error.message:'ERP 資料讀取失敗。'); }
    finally { setErpBusy(false); }
  };
  const [downloadLink, setDownloadLink] = useState<{ url: string; filename: string } | null>(null);
  const downloadRef = useRef<string | null>(null);
  useEffect(() => () => { if (downloadRef.current) URL.revokeObjectURL(downloadRef.current); }, []);
  const showDownload = (file: { url: string; filename: string }) => {
    if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
    downloadRef.current = file.url; setDownloadLink(file);
  };
  const updateOrder = (value: OrderData) => {
    if (downloadRef.current) { URL.revokeObjectURL(downloadRef.current); downloadRef.current = null; setDownloadLink(null); }
    const next = normalizeCsqOrder(value);
    setErpStatus('');
    setOrder(next);
    saveWorkspace(upsertOrder(workspace,next));
    try { if(!shared)localStorage.setItem(SAVED_KEY, JSON.stringify(next)); setNotice(''); }
    catch { setNotice('本機儲存空間不足，這次修改尚未保存。請先下載訂單備份。'); }
  };
  const issues = order ? csqIssues(order) : [];
  const factoryGroups=order?erpFactoryOrders(order):[];
  const factoryOrder=factoryGroups.find(g=>g.id===factorySelection)?.order||factoryGroups[0]?.order||(order?.erpFactoryApplied?null:order);
  const previewWorkbook=useMemo(()=>{if(!documentTemplates||!order||page!=='documents')return null;const value=preview==='factory'?factoryOrder:order;if(!value)return {error:'尚無可預覽的工廠報價，請先確認 ERP 工廠報價。'};try{return {...buildReferenceDocument(documentTemplates,preview,value,references),error:''};}catch(e){return {error:e instanceof Error?e.message:'文件預覽失敗'};}},[documentTemplates,order,page,preview,factoryOrder,references]);
  const applyDatabase = (products: ProductMappingItem[]) => {
    if (!order) return;
    const items = order.items.map(item => {
      const match = products.find(product => product.itemNo.toUpperCase() === item.itemNo.toUpperCase());
      return match ? { ...item, chineseName: match.chineseName || item.chineseName, chineseSpec: match.chineseSpec || item.chineseSpec,
        factoryUnitPriceUSD: match.factoryCurrency === 'USD' ? match.factoryPrice : item.factoryUnitPriceUSD,
        unitPriceRMB: match.factoryCurrency === 'RMB' ? match.factoryPrice : match.unitPriceRMB || item.unitPriceRMB } : item;
    });
    updateOrder({ ...order, items, factorySupplier: products.find(p => p.factorySupplier && items.some(i => i.itemNo === p.itemNo))?.factorySupplier || order.factorySupplier });
  };
  const download = async (kind: 'pi' | 'factory' | 'quantity' | 'overview') => {
    if (!order || exporting) return;
    if ((kind==='factory'||kind==='overview') && Object.keys(quoteChoices).length) {setNotice('工廠報價選擇尚未套用，請先按「套用所選報價」再匯出。');return;}
    if(kind==='factory'&&!factoryOrder){setNotice('尚無可匯出的工廠報價，請先核對 ERP 產品資料。');return;}
    setExporting(kind); setNotice('');
    try {
      if(!documentTemplates)throw new Error(templateError||'文件範本讀取中，請稍後。');
      let file:{url:string;filename:string};
      if(kind==='factory'&&factoryGroups.length>1){const zip=new JSZip();for(const group of factoryGroups){const result=buildReferenceDocument(documentTemplates,'factory',group.order,references);zip.file(`採購單_${order.piNumber}_${group.order.supplierCode}_${group.order.factoryCurrency}_${group.order.factoryQuantityUnit}.xlsx`,await result.book.xlsx.writeBuffer());}const blob=await zip.generateAsync({type:'blob'});const url=URL.createObjectURL(blob),filename=`${order.piNumber}_各工廠採購單.zip`;const a=document.createElement('a');a.href=url;a.download=filename;a.click();file={url,filename};}
      else {const result=buildReferenceDocument(documentTemplates,kind,kind==='factory'?factoryOrder!:order,references);file=await saveWorkbookToFile(result.book,`${order.piNumber}_${kind==='pi'?'PI':kind==='factory'?`採購單_${factoryOrder!.supplierCode}`:kind==='quantity'?'數量明細表':'早見表'}.xlsx`);}
      showDownload(file);
    } catch(e) { setNotice(e instanceof Error?e.message:'文件產生失敗，請重試。'); } finally { setExporting(''); }
  };
  const backup = () => {
    if (!order) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, account: 'CSQ', order }, null, 2)], { type: 'application/json' }));
    const filename = `${order.poNumber}_CSQ工作站.json`;
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); showDownload({ url, filename });
  };
  return <div className="csq-workspace min-h-screen">
    <aside className="csq-sidebar">
      <div className="csq-brand"><span className="csq-monogram">CSQ<span>.</span></span><span>ACCOUNT WORKSPACE</span></div>
      <div className="csq-sidebar-label">工作站功能</div>
      <nav aria-label="工作站導覽">
        {modules.map(([id,label],index)=>{const Icon=[ClipboardCheck,CalendarClock,Truck,FlaskConical,Database,BarChart3][index];return <button key={id} className={module===id?'active':''} onClick={()=>setModule(id)}><Icon size={18}/>{label}</button>;})}
      </nav>
      <div className="csq-sidebar-foot"><span><i />{shared?'NAS 共用工作站':'本機工作站'}</span><p>{shared?'資料保存在 NAS 共用資料庫':'文件在本機處理'}<br />{shared?'同事共用最新作業資料':'不使用外部 API'}</p><button onClick={() => setHelpOpen(true)}><HelpCircle size={16} />使用說明</button></div>
    </aside>
    <div className="csq-main">
      <header className="csq-topbar"><div>CSQ 客戶作業 <ChevronRight size={14} /><strong>{modules.find(m=>m[0]===module)?.[1]}</strong></div><span><ShieldCheck size={15} />{shared?'NAS 共用':'本機處理'}</span></header>
      <main className="csq-content">
        {notice && <p className="csq-alert" role="alert"><AlertCircle size={16} />{notice}</p>}
        {downloadLink && <div className="csq-download-ready" role="status"><Check size={16} /><span>文件已產生：{downloadLink.filename}</span><a href={downloadLink.url} download={downloadLink.filename}>下載檔案</a></div>}
        {module==='orders'?<>
        <div className="csq-page-heading"><div><span className="csq-eyebrow">CSQ / ORDER DESK</span><h1>訂單作業</h1><p>匯入 PO、核對訂單、輸出文件；資料沿用到進度與出貨。</p></div><button className="csq-primary" onClick={() => setUploadOpen(true)}><Upload size={17} />匯入 PO</button></div>
        <div className="desk-tabs"><button className={page==='review'?'active':''} onClick={()=>setPage('review')}>訂單核對</button><button className={page==='documents'?'active':''} onClick={()=>setPage('documents')}>訂單文件輸出</button></div>
        {workspace.orders.length>0&&<div className="desk-toolbar"><label>作業訂單 <select aria-label="選擇作業訂單" value={order?.poNumber||''} onChange={e=>{const selectedOrder=workspace.orders.find(o=>o.poNumber===e.target.value);if(selectedOrder)updateOrder(selectedOrder);}}>{workspace.orders.map(o=><option key={o.poNumber} value={o.poNumber}>{o.poNumber} · {o.orderingCompany||o.customerName}</option>)}</select></label><span>{workspace.orders.length} 份已保存 PO</span></div>}
        <div className="csq-steps" aria-label="作業流程"><span className={order ? 'done' : 'current'}>{order ? <Check size={14} /> : <b>1</b>}匯入 PO</span><i /><span className={page === 'review' && order ? 'current' : ''}><b>2</b>核對訂單</span><i /><span className={page === 'documents' ? 'current' : ''}><b>3</b>輸出文件</span></div>
        {!order ? <section className="csq-empty"><div className="csq-empty-icon"><FileText size={34} strokeWidth={1.4} /></div><h2>從一份 CSQ PO 開始</h2><p>支援 PDF、掃描圖片、Excel 與 CSV。<br />匯入後先核對資料，再產生 P/I 與工廠採購單。</p><button className="csq-primary" onClick={() => setUploadOpen(true)}>選擇 PO 檔案<ArrowRight size={16} /></button><small>目前沒有訂單。範例不會自動載入。</small></section> : <>
          <section className="csq-order-strip"><div><span>客戶 PO</span><strong>{order.poNumber}</strong><small>{order.orderingCompany} · {order.sourceFileName?.endsWith('.json') ? '訂單備份／已解析資料' : order.sourceFileName || '本機保存的訂單'}</small></div><div><span>S/C 號碼</span><strong>{order.piNumber || '待確認'}</strong></div><div><span>總件數</span><strong>{order.totalPieces.toLocaleString()}<small>件</small></strong></div><div><span>客戶金額 / USD</span><strong>{order.totalAmountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div></section>
          {page === 'review' ? <><CsqOrderReview order={order} onChange={updateOrder} issues={issues} /><div className="csq-bottom"><span>{shared?'修改會保存至 NAS 共用資料庫。':'修改會保存在這台電腦的瀏覽器。'}</span><button className="csq-primary" onClick={() => setPage('documents')}>前往文件輸出<ArrowRight size={16} /></button></div></> : <>
            {issues.length > 0 && <div className="csq-alert"><AlertCircle size={16} /><span>有 {issues.length} 項資料待核對。<button onClick={() => setPage('review')}>返回訂單核對</button></span></div>}
            <div className="csq-export-grid csq-order-exports">{([{ kind: 'pi', title: '英文 P/I', desc: '客戶品項、售價與交易條件' }, { kind: 'factory', title: '工廠採購單', desc: '依工廠分檔，中文規格與採購成本' }, { kind: 'quantity', title: '數量明細表', desc: '各款顏色、尺碼、數量及核對結果' }, { kind: 'overview', title: '早見表', desc: '訂單彙總、客戶金額與工廠採購資料' }] as const).map(card => <section key={card.kind} className="csq-export-card"><FileText size={22} /><h2>{card.title}</h2><p>{card.desc}</p><button disabled={!!exporting || !referencesReady || !documentTemplates} onClick={() => void download(card.kind)}><Download size={15} />{exporting === card.kind ? '產生中…' : card.kind==='factory'&&factoryGroups.length>1?'匯出各工廠檔案':'匯出 Excel'}</button></section>)}</div>
            <section className="csq-export-card" style={{marginBottom:16}}><h2>CSQ 參考成份</h2><p>已對應 {referenceCoverage(order, references).matched}／{referenceCoverage(order, references).total} 款。採購單優先使用「CSQ參考資料／訂單作業／工廠採購單」的成份；找不到或資料衝突時，顯示客人原始 PO 說明。</p><small>{referenceStatus}。資料夾有更新時，先雙擊「更新CSQ參考資料.bat」，再重新讀取。</small><button disabled={!referencesReady} onClick={() => {void refreshReferences();void refreshTemplates();}}><Database size={15} />重新讀取參考成份</button></section>
            <section className="csq-export-card" style={{marginBottom:16}}><h2>ERP 產品資料</h2><p>依款號帶入中文品名、規格、工廠與採購成本。客戶售價與 PO 件數保留。</p><button disabled={erpBusy} onClick={() => void importErp()}><Database size={15} />{erpBusy?'讀取中…':'帶入 ERP 產品資料'}</button>{erpStatus && <p role="status">{erpStatus}</p>}<ErpQuoteSelector order={order} snapshot={erpSnapshot} choices={quoteChoices} onChange={(style,key)=>setQuoteChoices(previous=>({...previous,[style]:key}))} onApply={()=>void importErp()} busy={erpBusy} /><small>ERP 資料有更新時，先雙擊「更新ERP產品資料.bat」，再按帶入。</small></section>
            <div className="csq-preview-tabs"><div>{([{kind:'pi',label:'P/I 預覽'},{kind:'factory',label:'採購單預覽'},{kind:'quantity',label:'數量明細預覽'},{kind:'overview',label:'早見表預覽'}] as const).map(tab=><button key={tab.kind} className={preview===tab.kind?'active':''} onClick={()=>setPreview(tab.kind)}>{tab.label}</button>)}</div><button onClick={backup}><Download size={14} />訂單備份</button></div>
            <section className="csq-export-card document-settings" style={{marginBottom:16}}><div className="csq-field-grid"><label>包裝方式<select aria-label="文件包裝方式" value={order.packingType||'NORMAL PACK'} onChange={e=>updateOrder({...order,packingType:e.target.value as OrderData['packingType']})}><option value="NORMAL PACK">Normal Pack（單碼包裝）</option><option value="MULTIPLE PACK">Multiple Pack（混碼包裝）</option></select></label><label>客人 Payment Term<input aria-label="客人 Payment Term" value={order.paymentTerms} onChange={e=>updateOrder({...order,paymentTerms:e.target.value})}/></label></div><small>包裝方式會同步顯示於客人 P/I、工廠採購單與早見表。</small></section>
            {preview==='factory'&&factoryGroups.length>0&&<section className="csq-export-card" style={{marginBottom:16}}><label>選擇工廠採購單 <select aria-label="選擇工廠採購單" value={factoryGroups.find(g=>g.id===factorySelection)?.id||factoryGroups[0].id} onChange={e=>setFactorySelection(e.target.value)}>{factoryGroups.map(g=><option key={g.id} value={g.id}>{g.label} · {g.order.totalPieces.toLocaleString()} {g.order.factoryQuantityUnit||'件'}</option>)}</select></label><p>採購單預覽只包含所選工廠；匯出依各工廠分成獨立 Excel，多工廠時合併成 ZIP 下載。客戶 P/I 保留完整訂單。</p>{order.items.some(i=>!i.factoryProduct)&&<p role="alert">部分款號尚未確認報價，暫不列入以上採購單，請核對 ERP 提醒。</p>}</section>}
            {preview==='factory'&&factoryOrder&&factoryGroups.length>0&&<section className="csq-export-card" style={{marginBottom:16}}><FactoryPurchaseSettings order={order} factory={factoryOrder} groupId={factoryGroups.find(g=>g.id===factorySelection)?.id||factoryGroups[0].id} onChange={updateOrder}/></section>}
            {previewWorkbook?.error?<p className="csq-alert">{previewWorkbook.error}</p>:previewWorkbook&&'book' in previewWorkbook?<WorkbookPreview book={previewWorkbook.book} sources={previewWorkbook.sources}/>:<p className="desk-hint">{templateError||'正在讀取本機文件範本…'}</p>}
          </>}
        </>}
        </>:<WorkspaceModules sharedMode={!!shared} key={module} module={module} workspace={workspace} references={workspaceRefs} erp={erpSnapshot} onChange={saveWorkspace} onRestore={restoreWorkspace} onOpenOrder={value=>{updateOrder(value);setModule('orders');}} onDatabase={()=>setDatabaseOpen(true)} onDownload={showDownload} onRefresh={()=>void refreshWorkspaceRefs()} referenceError={workspaceRefError}/>}
        <footer className="csq-footer"><span>CSQ 工作站 · {shared?'NAS 共用版':'單機版'}</span><span>Account CSQ / Sports Kite</span></footer>
      </main>
    </div>
    <PdfUploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} onOrderLoaded={value => { updateOrder(value); setModule('orders'); setPage('review'); }} />
    <ProductDatabaseModal sharedProducts={shared?(workspace.productMappings||[]):undefined} onProductsChange={products=>saveWorkspace({...workspace,productMappings:products})} isOpen={databaseOpen} onClose={() => setDatabaseOpen(false)} onApplyToOrder={applyDatabase} />
    <StandaloneInfoModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
  </div>;
}
