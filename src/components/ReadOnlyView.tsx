import {useLayoutEffect,useRef,type ReactNode} from 'react';

const operation=/新增|建立|修改|作廢|匯入|上傳|刪除|移除|套用|更新進度|儲存|保存|確認|匯出|下載|備份|帶入|更正|送出|清除|產生|出貨測試/;
export function ReadOnlyView({enabled,children}:{enabled:boolean;children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!enabled||!root.current)return;
  const original=new Map<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLButtonElement,{disabled:boolean;readOnly?:boolean}>();
  const lock=()=>{
   for(const el of root.current!.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLButtonElement>('input,select,textarea,button')){
    const label=(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('placeholder')||'');
    if(el instanceof HTMLButtonElement&&!operation.test(el.textContent||''))continue;
    if(!(el instanceof HTMLButtonElement)&&(/搜尋|搜索|查詢|篩選/.test(label)||el.closest('.desk-search')))continue;
    if(el instanceof HTMLSelectElement&&el.closest('.desk-toolbar')&&!el.closest('.csq-field-grid'))continue;
    if(!original.has(el))original.set(el,{disabled:el.disabled,...('readOnly' in el?{readOnly:el.readOnly}:{})});
    if(el instanceof HTMLInputElement&&!['checkbox','radio','file','button','submit'].includes(el.type)||el instanceof HTMLTextAreaElement){if(!el.readOnly)el.readOnly=true;}
    else if(!el.disabled)el.disabled=true;
   }
  };
  lock();const observer=new MutationObserver(lock);observer.observe(root.current,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','readonly']});
  return ()=>{observer.disconnect();for(const [el,state] of original){el.disabled=state.disabled;if('readOnly' in el&&state.readOnly!==undefined)el.readOnly=state.readOnly;}};
 },[enabled]);
 return <div ref={root}>{enabled&&<p className="desk-hint" role="status">瀏覽者模式：可查看、搜尋及篩選資料，不能新增、修改、匯入、匯出或執行作業。</p>}{children}</div>;
}
