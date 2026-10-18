import React,{useId,useState} from 'react';

export function SelectWithAdd({label,value,options,onChange,onAdd,normalize=(s:string)=>s.trim(),validateOption,compareOptions,emptyLabel='請選擇',disabled=false}:{label:string;value:string;options:string[];onChange:(value:string)=>void;onAdd:(value:string)=>void;normalize?:(value:string)=>string;validateOption?:(value:string)=>string;compareOptions?:(a:string,b:string)=>number;emptyLabel?:string;disabled?:boolean}){
 const id=useId(),[adding,setAdding]=useState(false),[draft,setDraft]=useState(''),[error,setError]=useState('');
 const values=[...new Set([...options,value].filter(v=>v&&!validateOption?.(v)))].sort(compareOptions||((a,b)=>a.localeCompare(b,'en',{numeric:true})));
 const add=()=>{
  const next=normalize(draft);
  if(!next||next.length>120||/[\u0000-\u001f]/.test(next)){setError('請輸入 1–120 字的選項。');return;}
  const validationError=validateOption?.(next);if(validationError){setError(validationError);return;}
  onAdd(next);setAdding(false);setDraft('');setError('');
 };
 return <div className="select-with-add"><label htmlFor={id}>{label}</label><select id={id} aria-label={label} disabled={disabled} value={validateOption?.(value)?'':value} onChange={e=>{if(e.target.value==='__add_option__'){setAdding(true);setError('');}else onChange(e.target.value);}}><option value="">{emptyLabel}</option>{values.map(v=><option key={v} value={v}>{v}</option>)}<option value="__add_option__">＋新增選項…</option></select>{adding&&<div className="select-add-editor" role="group" aria-label={`新增${label}選項`}><input autoFocus aria-label={`新增${label}`} value={draft} maxLength={120} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}if(e.key==='Escape')setAdding(false);}}/><button type="button" className="desk-button" onClick={add}>新增</button><button type="button" className="desk-button" onClick={()=>setAdding(false)}>取消</button>{error&&<small role="alert">{error}</small>}</div>}</div>;
}
