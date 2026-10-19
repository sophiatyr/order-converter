import {removeOrder,restoreRemovedOrder} from './utils/orderRemoval';
import {saveFactoryText} from './utils/factoryText';
import {OrderPicker} from './components/OrderPicker';
import {piFilename,factoryFilename} from './utils/documentFormatting';
import {classificationChoices,addClassificationOption} from './utils/classificationOptions';
import {OrderProductPrices} from './components/OrderProductPrices';
import {syncOrderProducts} from './utils/orderProductSync';
import {loadCompositionReferences,repairMedicoComposition} from './utils/compositionReferences';
import {enrichOrderComposition} from './utils/orderComposition';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {readLocalWorkspace,writeLocalWorkspace} from './utils/localWorkspaceDb';
import {withProductFactoryQuotes} from './utils/productPriceHistory';
import {ReadOnlyView} from './components/ReadOnlyView';
import JSZip from 'jszip';
import {WorkbookPreview} from './components/WorkbookPreview';
import {loadDocumentTemplates,buildReferenceDocument,type DocumentTemplates,type DocumentKind} from './utils/referenceDocuments';
import { Upload, ArrowRight, FileText, ClipboardCheck, Database, HelpCircle, Download, Check, ShieldCheck, ChevronRight, AlertCircle, Truck, CalendarClock, FlaskConical, BarChart3, Settings } from 'lucide-react';
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
const navigation=[...modules,['system','系統管理'] as const];
type Page = 'review' | 'documents';
export default function Root(){return <NasGate>{(shared,localSystem,localRole)=><App key={shared?.user.id||'local'} shared={shared} localSystem={localSystem} localRole={localRole}/>}</NasGate>;}
function App({shared,localSystem,localRole}:{shared?:SharedSession;localSystem?:React.ReactNode;localRole?:SharedSession['user']['role']}) {
  const readOnly=shared?.user.role==='viewer'||localRole==='viewer';
  const [order, setOrder] = useState<OrderData | null>(() => {
    if(shared)return shared.workspace.orders[0]||null;
    try { const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null'); return saved?.poNumber && Array.isArray(saved.items) ? normalizeCsqOrder(saved) : null; } catch { return null; }
  });
  const [page, setPage] = useState<Page>('review');
  const [module, setModule] = useState<ModuleId|'system'>(shared?.preview?'system':'orders');
  const [workspace,setWorkspace]=useState<Workspace>(()=>{if(shared)return shared.workspace;try{const w=loadWorkspace(localStorage.getItem(WORKSPACE_KEY),order),mapping=localStorage.getItem('SK_PRODUCT_MAPPING_DB_V2');return mapping?{...w,productMappings:JSON.parse(mapping)}:w;}catch{return emptyWorkspace();}});
  const [workspaceRefs,setWorkspaceRefs]=useState<ReferenceSnapshot|null>(null);
  const [workspaceRefError,setWorkspaceRefError]=useState('');
  const localReady=useRef(false);
  const saveWorkspace=(next:Workspace)=>{if(readOnly)return;next=normalizeWorkspace(next);if(shared){setWorkspace(next);shared.save(next);return;}if(!localReady.current){setNotice('本機資料正在載入，請稍候。');return;}setWorkspace(next);void writeLocalWorkspace(next).then(()=>{localStorage.removeItem(WORKSPACE_KEY);}).catch(()=>setNotice('本機資料庫未能保存，修改尚未儲存。請檢查瀏覽器空間並下載完整備份。'));};
  const restoreWorkspace=(next:Workspace)=>{if(readOnly)return;next=normalizeWorkspace(next);if(shared){if(shared.user.role!=='admin'){setNotice('完整資料移轉由管理員操作。');return;}setWorkspace(next);shared.restore(next);return;}try{const current=next.orders.find(o=>o.poNumber===order?.poNumber)||next.orders[0]||null;if(current)localStorage.setItem(SAVED_KEY,JSON.stringify(current));void writeLocalWorkspace(next).then(()=>{localStorage.removeItem(WORKSPACE_KEY);setOrder(current);setWorkspace(next);setNotice('工作站備份已合併。');}).catch(()=>setNotice('本機資料庫未能保存備份。'));}catch{setNotice('本機儲存空間不足，備份未完成保存。');}};
  const refreshWorkspaceRefs=async()=>{try{const response=await fetch(`${import.meta.env.BASE_URL}csq-workspace-references.json`,{cache:'no-store'});if(!response.ok)throw new Error('參考資料尚未建立。請雙擊「更新CSQ參考資料.bat」。');const data=await response.json();if(!Array.isArray(data.tracking)||!Array.isArray(data.files))throw new Error('參考資料格式不符。');setWorkspaceRefs(data);setWorkspaceRefError('');}catch(e){setWorkspaceRefError(e instanceof Error?e.message:'參考資料無法讀取');}};
  useEffect(()=>{void refreshWorkspaceRefs();},[]);
  useEffect(()=>{if(shared)return;let active=true;void Promise.all([readLocalWorkspace(),loadCompositionReferences()]).then(async ([saved,compositions])=>{if(!active)return;let next=saved?loadWorkspace(JSON.stringify(saved),null):workspace;let repaired=false;next={...next,orders:next.orders.map(o=>{const value=repairMedicoComposition(o,compositions);if(value!==o)repaired=true;return value;})};if((!saved||repaired)&&!readOnly)await writeLocalWorkspace(next);if(!active)return;setWorkspace(next);setOrder(previous=>previous?(next.orders.find(o=>o.poNumber===previous.poNumber)||(next.removedOrders?.[previous.poNumber]?next.orders[0]||null:repairMedicoComposition(previous,compositions))):previous);localReady.current=true;}).catch(()=>setNotice('本機資料庫無法開啟，原有資料保留。請檢查瀏覽器設定。'));return()=>{active=false;};},[]);
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
  const [materialBusy,setMaterialBusy]=useState(false),[materialStatus,setMaterialStatus]=useState('');
  const materialRequest=useRef<Promise<void>|null>(null);
  const refreshMaterials=async()=>{
    if(materialRequest.current)return materialRequest.current;
    const request=(async()=>{setMaterialBusy(true);setMaterialStatus('正在讀取 ERP 最新產品資料…');try{
      if(['localhost','127.0.0.1'].includes(window.location.hostname)){
        const response=await fetch('/api/local-erp-refresh',{method:'POST'}),result=await response.json();if(!response.ok)throw new Error(result.error||'ERP 更新失敗');
      }
      const snapshot=await loadErpProducts();setErpSnapshot(snapshot);setMaterialStatus(`已更新 ERP 資料：${new Date(snapshot.updatedAt).toLocaleString()}，產品資料與訂單文件已同步。`);
    }catch(e){setMaterialStatus(`${e instanceof Error?e.message:'ERP 更新失敗'}；目前顯示上次資料，請勿將其視為最新。`);}finally{setMaterialBusy(false);}})();
    materialRequest.current=request;try{await request;}finally{materialRequest.current=null;}
  };
  const [quoteChoices,setQuoteChoices] = useState<Record<string,string>>({});
  useEffect(()=>{void loadErpProducts().then(setErpSnapshot).catch(()=>{});},[]);
  useEffect(()=>{if((module==='products'||module==='orders'&&page==='documents')&&!readOnly)void refreshMaterials();},[module,page,order?.poNumber]);
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
      const result=applyErpProducts(order,withProductFactoryQuotes(snapshot,workspace),quoteChoices);
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
  const updateOrder = (value: OrderData,base:Workspace=workspace) => {
    if (downloadRef.current) { URL.revokeObjectURL(downloadRef.current); downloadRef.current = null; setDownloadLink(null); }
    const next = normalizeCsqOrder(value);
    setErpStatus('');
    setOrder(next);
    saveWorkspace(upsertOrder(syncOrderProducts(base,next,erpSnapshot),next));
    if(readOnly){setOrder(next);return;}
    try { if(!shared)localStorage.setItem(SAVED_KEY, JSON.stringify(next)); setNotice(''); }
    catch { setNotice('本機儲存空間不足，這次修改尚未保存。請先下載訂單備份。'); }
  };
  useEffect(()=>{
    if(readOnly||module!=='orders'||page!=='documents'||!order||!erpSnapshot||!localReady.current&&!shared||Object.keys(quoteChoices).length||!order.items.some(i=>!i.factoryProduct))return;
    const result=applyErpProducts(order,withProductFactoryQuotes(erpSnapshot,workspace));
    const before=order.items.filter(i=>i.factoryProduct).length;
    if(result.matched<=before)return;
    updateOrder(result.order);
    setErpStatus(`已自動帶入 ${result.matched}／${order.items.length} 筆工廠與採購價。${result.issues.join(' ')}`);
  },[module,page,order,erpSnapshot,workspace,readOnly,shared,quoteChoices]);
  const removeSavedOrder=(po:string)=>{
    if(readOnly)return;
    try{const next=removeOrder(workspace,po);saveWorkspace(next);if(order?.poNumber===po){const current=next.orders[0]||null;setOrder(current);if(!shared){if(current)localStorage.setItem(SAVED_KEY,JSON.stringify(current));else localStorage.removeItem(SAVED_KEY);}}setNotice(`已移除 PO ${po}，可在「已移除訂單」還原。訂單追蹤參考資料與 ERP 資料保留。`);}catch(e){setNotice(e instanceof Error?e.message:'移除未完成');}
  };
  const restoreSavedOrder=(po:string)=>{
    if(readOnly)return;
    try{const next=restoreRemovedOrder(workspace,po);saveWorkspace(next);const current=next.orders.find(o=>o.poNumber===po)!;setOrder(current);if(!shared)localStorage.setItem(SAVED_KEY,JSON.stringify(current));setNotice(`已還原 PO ${po}。`);}catch(e){setNotice(e instanceof Error?e.message:'還原未完成');}
  };
  const issues = order ? csqIssues(order) : [];
  useEffect(()=>{if(!order||(!shared&&!localReady.current))return;const next=enrichOrderComposition(order,workspace,erpSnapshot);if(next!==order){if(readOnly)setOrder(next);else updateOrder(next);}else if(!readOnly&&erpSnapshot){const synced=syncOrderProducts(workspace,order,erpSnapshot);if(synced!==workspace)saveWorkspace(synced);}},[order,workspace.productNotes,workspace.productMappings,erpSnapshot,workspace.orders]);
  const factoryGroups=order?erpFactoryOrders(order):[];
  const factoryOrder=factoryGroups.find(g=>g.id===factorySelection)?.order||factoryGroups[0]?.order||(order?.erpFactoryApplied?null:order);
  const previewWorkbook=useMemo(()=>{if(!documentTemplates||!order||page!=='documents')return null;const value=preview==='factory'||preview==='quantity'&&factoryGroups.length>0?factoryOrder:order;if(!value)return {error:'尚無可預覽的工廠報價，請先確認 ERP 工廠報價。'};try{return {...buildReferenceDocument(documentTemplates,preview,value,references,erpSnapshot,workspace),error:''};}catch(e){return {error:e instanceof Error?e.message:'文件預覽失敗'};}},[documentTemplates,order,page,preview,factoryOrder,references,erpSnapshot,workspace.productNotes]);
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
    if (!order || exporting || materialBusy) return;
    if ((kind==='factory'||kind==='quantity'||kind==='overview') && Object.keys(quoteChoices).length) {setNotice('工廠報價選擇尚未套用，請先按「套用所選報價」再匯出。');return;}
    if((kind==='factory'||kind==='quantity')&&!factoryOrder){setNotice('尚無可匯出的工廠報價，請先核對 ERP 產品資料。');return;}
    if(kind==='quantity'&&factoryGroups.length>0&&order.items.some(item=>!item.factoryProduct)){setNotice('部分款式尚未選定工廠，請先完成各款下單工廠設定，避免數量明細漏款。');return;}
    setExporting(kind); setNotice('');
    try {
      if(!documentTemplates)throw new Error(templateError||'文件範本讀取中，請稍後。');
      let file:{url:string;filename:string};
      if((kind==='factory'||kind==='quantity')&&factoryGroups.length>1){const prefix=kind==='factory'?'採購單':'數量明細表';const zip=new JSZip();for(const group of factoryGroups){const result=buildReferenceDocument(documentTemplates,kind,group.order,references,erpSnapshot,workspace);const name=kind==='factory'?factoryFilename(group.order):`${prefix}_${order.piNumber}_${group.order.supplierCode}_${group.order.factoryCurrency}_${group.order.factoryQuantityUnit}.xlsx`;const entry=zip.file(name)?name.replace(/\.xlsx$/,`_${group.order.factoryCurrency}_${group.order.factoryQuantityUnit}_${Object.keys(zip.files).length+1}.xlsx`):name;zip.file(entry,await result.book.xlsx.writeBuffer());}const blob=await zip.generateAsync({type:'blob'});const url=URL.createObjectURL(blob),filename=`${order.piNumber}_各工廠${prefix}.zip`;const a=document.createElement('a');a.href=url;a.download=filename;a.click();file={url,filename};}
      else {const result=buildReferenceDocument(documentTemplates,kind,kind==='factory'||kind==='quantity'&&factoryGroups.length>0?factoryOrder!:order,references,erpSnapshot,workspace);file=await saveWorkbookToFile(result.book,kind==='pi'?piFilename(order):kind==='factory'?factoryFilename(factoryOrder!):`${order.piNumber}_${kind==='quantity'?`數量明細表${factoryOrder?.supplierCode?'_'+factoryOrder.supplierCode:''}`:'早見表'}.xlsx`);}
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
      <div className="csq-brand csq-brand-cisalfa"><img className="csq-cisalfa-wordmark" src={`${import.meta.env.BASE_URL}branding/cisalfa-wordmark.svg`} alt="Cisalfa Sport"/><div className="csq-account-signature"><strong>CSQ<span>.</span></strong><span>ACCOUNT<br/>WORKSPACE</span></div></div>
      <div className="csq-sidebar-label">工作站功能</div>
      <nav aria-label="工作站導覽">
        {navigation.map(([id,label],index)=>{const Icon=[ClipboardCheck,CalendarClock,Truck,FlaskConical,Database,BarChart3,Settings][index];return <button key={id} className={module===id?'active':''} onClick={()=>setModule(id)}><Icon size={18}/>{label}</button>;})}
      </nav>
      <div className="csq-sidebar-foot"><span><i />{shared?(shared.preview?'本機共用版測試':'NAS 共用工作站'):'本機工作站'}</span><p>{shared?(shared.preview?'測試資料獨立保存':'資料保存在 NAS 共用資料庫'):'文件在本機處理'}<br />{shared?(shared.preview?'不影響 NAS 正式資料':'同事共用最新作業資料'):'不使用外部 API'}</p><button onClick={() => setHelpOpen(true)}><HelpCircle size={16} />使用說明</button></div>
    </aside>
    <div className="csq-main">
      <header className="csq-topbar"><div>CSQ 客戶作業 <ChevronRight size={14} /><strong>{navigation.find(m=>m[0]===module)?.[1]}</strong></div><span><b className="csq-version" title="目前網頁程式版號">版本 {__CSQ_RELEASE__.version}</b><ShieldCheck size={15} />{shared?(shared.preview?'本機測試':'NAS 共用'):'本機處理'}</span></header>
      <main className="csq-content">
        {notice && <p className="csq-alert" role="alert"><AlertCircle size={16} />{notice}</p>}
        {downloadLink && <div className="csq-download-ready" role="status"><Check size={16} /><span>文件已產生：{downloadLink.filename}</span><a href={downloadLink.url} download={downloadLink.filename}>下載檔案</a></div>}
        {shared?.blocked&&module!=='system'&&<p className="csq-alert" role="alert">修改尚未儲存。請到系統管理保留未儲存資料，再重新載入核對。<button className="desk-button" onClick={()=>setModule('system')}>開啟系統管理</button></p>}
        <ReadOnlyView key={`${module}:${module==='orders'?page:''}`} enabled={readOnly&&module!=='system'}><fieldset disabled={!!shared?.blocked&&module!=='system'} style={{border:0,padding:0,margin:0,minWidth:0}}>
        {module==='system'?<>
          <div className="csq-page-heading"><div><span className="csq-eyebrow">CSQ / SYSTEM</span><h1>系統管理</h1><p>{shared?'管理同事帳號、資料庫備份與個人登入設定。':'管理本機測試帳號及個人登入設定，不影響 NAS 正式帳號。'}</p></div></div>
          {shared?shared.systemPanel:localSystem||<section className="csq-export-card"><h2>本機工作站</h2><p>這是離線作業版。帳戶管理請使用本機共用版測試，測試帳號不會影響 NAS 正式帳號。完整備份與資料來源仍在數據管理維護。</p><button className="desk-button" onClick={()=>setModule('data')}>前往數據管理</button></section>}
        </>:module==='orders'?<>
        <div className="csq-page-heading"><div><span className="csq-eyebrow">CSQ / ORDER DESK</span><h1>訂單作業</h1><p>匯入 PO、核對訂單、輸出文件；資料沿用到進度與出貨。</p></div><button className="csq-primary" onClick={() => setUploadOpen(true)}><Upload size={17} />匯入 PO</button></div>
        <div className="desk-tabs"><button className={page==='review'?'active':''} onClick={()=>setPage('review')}>訂單核對</button><button className={page==='documents'?'active':''} onClick={()=>setPage('documents')}>訂單文件輸出</button></div>
        {(workspace.orders.length>0||Object.keys(workspace.removedOrders||{}).length>0)&&<OrderPicker orders={workspace.orders} removedOrders={Object.values(workspace.removedOrders||{})} onRemove={readOnly?undefined:removeSavedOrder} onRestore={readOnly?undefined:restoreSavedOrder} current={order} onSelect={updateOrder}/>}
        <div className="csq-steps" aria-label="作業流程"><span className={order ? 'done' : 'current'}>{order ? <Check size={14} /> : <b>1</b>}匯入 PO</span><i /><span className={page === 'review' && order ? 'current' : ''}><b>2</b>核對訂單</span><i /><span className={page === 'documents' ? 'current' : ''}><b>3</b>輸出文件</span></div>
        {!order ? <section className="csq-empty"><div className="csq-empty-icon"><FileText size={34} strokeWidth={1.4} /></div><h2>從一份 CSQ PO 開始</h2><p>支援 PDF、掃描圖片、Excel 與 CSV。<br />匯入後先核對資料，再產生 P/I 與工廠採購單。</p><button className="csq-primary" onClick={() => setUploadOpen(true)}>選擇 PO 檔案<ArrowRight size={16} /></button><small>目前沒有訂單。範例不會自動載入。</small></section> : <>
          <section className="csq-order-strip"><div><span>客戶 PO</span><strong>{order.poNumber}</strong><small>{order.orderingCompany} · {order.sourceFileName?.endsWith('.json') ? '訂單備份／已解析資料' : order.sourceFileName || '本機保存的訂單'}</small></div><div><span>S/C 號碼</span><strong>{order.piNumber || '待確認'}</strong></div><div><span>總件數</span><strong>{order.totalPieces.toLocaleString()}<small>件</small></strong></div><div><span>客戶金額 / USD</span><strong>{order.totalAmountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div></section>
          {page === 'review' ? <><OrderProductPrices key={order.poNumber} order={order} w={workspace} erp={erpSnapshot} onChange={updateOrder}/><CsqOrderReview references={references} templates={documentTemplates||undefined} onSaveColors={(style,colors)=>saveWorkspace({...workspace,productNotes:{...workspace.productNotes,[style]:{...(workspace.productNotes[style]||{brand:order.brand||'',season:order.season||'',remarks:''}),colorTranslations:colors}}})} onSaveFactoryText={(style,text,sync)=>{const result=saveFactoryText(order,workspace,style,text,sync);updateOrder(result.order,result.workspace);}} onResetFactoryText={style=>updateOrder({...order,items:order.items.map(item=>item.itemNo===style?{...item,factoryText:undefined}:item)})} choices={classificationChoices(workspace,workspaceRefs,erpSnapshot)} onAddClassification={(kind,value)=>updateOrder({...order,[kind]:value},addClassificationOption(workspace,kind,value))} order={order} workspace={workspace} erp={erpSnapshot} onChange={updateOrder} issues={issues} /><div className="csq-bottom"><span>{shared?'修改會保存至 NAS 共用資料庫。':'修改會保存在這台電腦的瀏覽器。'}</span><button className="csq-primary" onClick={() => setPage('documents')}>前往文件輸出<ArrowRight size={16} /></button></div></> : <>
            {issues.length > 0 && <div className="csq-alert"><AlertCircle size={16} /><span>有 {issues.length} 項資料待核對。<button onClick={() => setPage('review')}>返回訂單核對</button></span></div>}
            <div className="csq-export-grid csq-order-exports">{([{ kind: 'pi', title: '英文 P/I', desc: '客戶品項、售價與交易條件' }, { kind: 'factory', title: '工廠採購單', desc: '依工廠分檔，中文規格與採購成本' }, { kind: 'quantity', title: '數量明細表', desc: '各款顏色、尺碼、數量及核對結果' }, { kind: 'overview', title: '早見表', desc: '訂單彙總、客戶金額與工廠採購資料' }] as const).map(card => <section key={card.kind} className="csq-export-card"><FileText size={22} /><h2>{card.title}</h2><p>{card.desc}</p><button disabled={!!exporting || materialBusy || !referencesReady || !documentTemplates} onClick={() => void download(card.kind)}><Download size={15} />{exporting === card.kind ? '產生中…' : (card.kind==='factory'||card.kind==='quantity')&&factoryGroups.length>1?'匯出各工廠檔案':'匯出 Excel'}</button></section>)}</div>
            <div className="document-data-grid">
              <section className="document-data-card"><div><h2>CSQ 參考成分</h2><span>{referenceCoverage(order,references).matched}／{referenceCoverage(order,references).total} 款已對應</span></div><p>補充訂單參考資料；未對應的款式沿用 ERP 或原始 PO。</p><button className="desk-button" disabled={!referencesReady} onClick={()=>{void refreshReferences();void refreshTemplates();}}><Database size={15}/>重新讀取參考資料</button><details><summary>查看資料狀態</summary><small>{referenceStatus}</small></details></section>
              <section className="document-data-card"><div><h2>ERP 產品資料</h2><span>{erpSnapshot?new Date(erpSnapshot.updatedAt).toLocaleString():'尚未載入'}</span></div><p>進入此頁會自動讀取最新英文面料；已選工廠、價格及中文設定保留。</p><button className="desk-button" disabled={materialBusy||erpBusy} onClick={()=>void refreshMaterials()}><Database size={15}/>{materialBusy?'正在更新…':'更新 ERP 資料'}</button>{materialStatus&&<small role="status">{materialStatus}</small>}</section>
            </div>
            <details className="document-quote-details"><summary>核對或更換 ERP 工廠報價{Object.keys(quoteChoices).length?` · ${Object.keys(quoteChoices).length} 款尚未套用`:''}</summary><p className="desk-hint">需要帶入或更換工廠報價時再操作；日常預覽與匯出不必重複帶入。</p><button className="desk-button" disabled={erpBusy||materialBusy} onClick={()=>void importErp()}>{erpBusy?'帶入中…':'帶入 ERP 工廠報價'}</button>{erpStatus&&<p role="status">{erpStatus}</p>}<ErpQuoteSelector order={order} snapshot={erpSnapshot?withProductFactoryQuotes(erpSnapshot,workspace):null} choices={quoteChoices} onChange={(style,key)=>setQuoteChoices(previous=>({...previous,[style]:key}))} onApply={()=>void importErp()} busy={erpBusy||materialBusy}/></details>
            <div className="csq-preview-tabs"><div>{([{kind:'pi',label:'P/I 預覽'},{kind:'factory',label:'採購單預覽'},{kind:'quantity',label:'數量明細預覽'},{kind:'overview',label:'早見表預覽'}] as const).map(tab=><button key={tab.kind} aria-pressed={preview===tab.kind} className={preview===tab.kind?'active':''} onClick={()=>setPreview(tab.kind)}>{tab.label}</button>)}</div><button onClick={backup}><Download size={14} />訂單備份</button></div>
            <div className="document-order-summary"><span>包裝：{order.packingType==='MULTIPLE PACK'?'混碼包裝':'單碼包裝'}</span><span>防偽標：{order.requiresAntiCounterfeitLabel===true?'需要':order.requiresAntiCounterfeitLabel===false?'不需要':'待確認'}</span><span>客人付款：{order.paymentTerms||'待填'}</span><button className="desk-button" onClick={()=>setPage('review')}>修改訂單設定</button></div>
            {(preview==='factory'||preview==='quantity')&&factoryGroups.length>0&&<section className="csq-export-card document-factory-select" style={{marginBottom:16}}><label>選擇工廠 <select aria-label="選擇文件工廠" value={factoryGroups.find(g=>g.id===factorySelection)?.id||factoryGroups[0].id} onChange={e=>setFactorySelection(e.target.value)}>{factoryGroups.map(g=><option key={g.id} value={g.id}>{g.label} · {g.order.totalPieces.toLocaleString()} {g.order.factoryQuantityUnit||'件'}</option>)}</select></label><p>採購單與數量明細預覽只包含所選工廠；匯出依各工廠分成獨立 Excel，多工廠時合併成 ZIP 下載。每份數量明細只保留該工廠的款式。</p>{order.items.some(i=>!i.factoryProduct)&&<p role="alert">部分款號尚未確認報價，暫不列入以上採購單，請核對 ERP 提醒。</p>}</section>}
            {preview==='factory'&&factoryOrder&&factoryGroups.length>0&&<section className="csq-export-card" style={{marginBottom:16}}><FactoryPurchaseSettings templates={documentTemplates} order={order} factory={factoryOrder} groupId={factoryGroups.find(g=>g.id===factorySelection)?.id||factoryGroups[0].id} onChange={updateOrder}/></section>}
            {previewWorkbook?.error?<p className="csq-alert">{previewWorkbook.error}{preview==='factory'&&<button className="desk-button" disabled={erpBusy||materialBusy} onClick={()=>void importErp()}>帶入工廠與採購價</button>}</p>:previewWorkbook&&'book' in previewWorkbook?<WorkbookPreview book={previewWorkbook.book} sources={previewWorkbook.sources}/>:<p className="desk-hint">{templateError||'正在讀取本機文件範本…'}</p>}
          </>}
        </>}
        </>:<WorkspaceModules onRefreshErp={()=>void refreshMaterials()} erpBusy={materialBusy} erpStatus={materialStatus} sharedMode={!!shared} key={module} module={module} workspace={workspace} references={workspaceRefs} erp={erpSnapshot} onChange={saveWorkspace} onRestore={restoreWorkspace} onOpenOrder={value=>{updateOrder(value);setModule('orders');}} onDatabase={()=>setDatabaseOpen(true)} onDownload={showDownload} onRefresh={()=>void refreshWorkspaceRefs()} referenceError={workspaceRefError}/>}
        </fieldset></ReadOnlyView>
        <footer className="csq-footer"><span>CSQ 工作站 · {shared?(shared.preview?'本機共用版測試':'NAS 共用版'):'單機版'} · 版本 {__CSQ_RELEASE__.version}</span><span>Account CSQ / Sports Kite</span></footer>
      </main>
    </div>
    <PdfUploadModal isOpen={uploadOpen&&!shared?.blocked&&!readOnly} onClose={() => setUploadOpen(false)} onOrderLoaded={value => { updateOrder(value); setModule('orders'); setPage('review'); }} />
    <ProductDatabaseModal sharedProducts={shared?(workspace.productMappings||[]):undefined} onProductsChange={products=>saveWorkspace({...workspace,productMappings:products})} isOpen={databaseOpen&&!shared?.blocked&&!readOnly} onClose={() => setDatabaseOpen(false)} onApplyToOrder={applyDatabase} />
    <StandaloneInfoModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
  </div>;
}
