import {useEffect,useRef,type ReactNode} from 'react';

/** Keep the selected record beside its editor, with native focus/keyboard handling. */
export function RecordEditorDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return ()=>dialog?.close();},[]);
 return <dialog ref={ref} className="record-editor-dialog" aria-label={title} onCancel={onClose}>
  <header><h2>{title}</h2><button className="desk-button" autoFocus onClick={onClose}>完成／關閉</button></header>
  <div className="record-editor-body">{children}</div>
 </dialog>;
}
