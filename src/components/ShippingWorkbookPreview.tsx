import {useEffect,useRef,useState} from 'react';
import * as XLSX from 'xlsx';
import {Download,LoaderCircle,X} from 'lucide-react';
import {shippingPreviewBounds} from '../utils/shippingPreview';
type Props={title:string;filename:string;load:()=>Promise<ArrayBuffer|Uint8Array>;onClose:()=>void;onDownload:(f:{url:string;filename:string})=>void;onDownloaded?:()=>void;onResolve?:(error:string)=>void};
/** Keep the original bytes for download; rendering never rewrites the workbook. */
export function ShippingWorkbookPreview({title,filename,load,onClose,onDownload,onDownloaded,onResolve}:Props){
 const dialog=useRef<HTMLDialogElement>(null),[file,setFile]=useState<Uint8Array|null>(null),[book,setBook]=useState<XLSX.WorkBook|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState(''),[page,setPage]=useState(0);
 useEffect(()=>{dialog.current?.showModal();let active=true;void Promise.resolve().then(load).then(buffer=>{if(!active)return;const bytes=new Uint8Array(buffer),b=XLSX.read(bytes,{type:'array',cellStyles:true});b.SheetNames=b.SheetNames.filter(name=>!b.Workbook?.Sheets?.find(s=>s.name===name)?.Hidden&&shippingPreviewBounds(b.Sheets[name]).rows>0);setFile(bytes);setBook(b);setSelected(b.SheetNames[0]||'');}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));});return()=>{active=false;};},[]);
 const sheet=book?.Sheets[selected],bounds=sheet?shippingPreviewBounds(sheet):{rows:0,columns:0},first=page*100,last=Math.min(first+100,bounds.rows),merges=sheet?.['!merges']||[];
 const download=()=>{if(!file)return;const url=URL.createObjectURL(new Blob([new Uint8Array(file)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();onDownload({url,filename});onDownloaded?.();};
 return <dialog ref={dialog} className="shipping-document-dialog" aria-label={title+'預覽'} onCancel={onClose}>
  <header><div><span>EXCEL 文件預覽</span><h2>{title}</h2><p>{filename}</p></div><div><button className="shipping-primary" disabled={!file||!!error} onClick={download}><Download size={16}/>下載這份 Excel</button><button className="shipping-icon" aria-label="關閉文件預覽" onClick={onClose}><X size={20}/></button></div></header>
  {error?<div className="shipping-preview-empty" role="alert"><h3>這份文件還不能產生</h3><p>{error}</p><button className="desk-button" onClick={()=>{onClose();onResolve?.(error);}}>{onResolve?'前往補齊資料':'返回表格'}</button></div>:!book?<div className="shipping-preview-empty" role="status"><LoaderCircle className="shipping-spinner"/><h3>正在準備原格式文件</h3><p>正在準備公式與儲存格內容，完成後可直接瀏覽。</p></div>:<>
   <nav className="shipping-sheet-tabs" aria-label="Excel 工作表">{book.SheetNames.map(name=><button key={name} aria-pressed={selected===name} onClick={()=>{setSelected(name);setPage(0);}}>{name}</button>)}</nav>
   <div className="shipping-preview-caption"><span>以下為這份 Excel 的儲存格內容；下載保留原始格式、公式與圖片。</span><span>{bounds.rows} 列 · {bounds.columns} 欄</span></div>
   <div className="shipping-file-grid"><table aria-label={selected+' Excel 內容'}><thead><tr><th>#</th>{Array.from({length:bounds.columns},(_,c)=><th key={c}>{XLSX.utils.encode_col(c)}</th>)}</tr></thead><tbody>{Array.from({length:last-first},(_,index)=>{const r=first+index;return <tr key={r}><th>{r+1}</th>{Array.from({length:bounds.columns},(_,c)=>{const merge=merges.find(m=>r>=m.s.r&&r<=m.e.r&&c>=m.s.c&&c<=m.e.c);if(merge&&(r!==Math.max(first,merge.s.r)||c!==merge.s.c))return null;const cell=sheet?.[XLSX.utils.encode_cell({r:merge?.s.r??r,c})],value=cell?.w??cell?.v??'',fill=cell?.s?.fgColor?.rgb;return <td key={c} colSpan={merge?Math.min(merge.e.c+1,bounds.columns)-c:1} rowSpan={merge?Math.min(merge.e.r+1,last)-Math.max(merge.s.r,first):1} style={{background:fill?'#'+fill.slice(-6):undefined}}>{String(value)}</td>;})}</tr>;})}</tbody></table></div>
   <footer><span>第 {bounds.rows?first+1:0}–{last} 列</span><div><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>上一頁</button><span>{page+1} / {Math.max(1,Math.ceil(bounds.rows/100))}</span><button disabled={last>=bounds.rows} onClick={()=>setPage(p=>p+1)}>下一頁</button></div></footer>
  </>}
 </dialog>;
}
