import {randomBytes} from 'node:crypto';

// A fixed administrator-configured destination, never an arbitrary proxy URL.
export function createNasSyncRelay({target=process.env.CSQ_SYNC_NAS_URL||'http://192.168.1.6:8888',fetcher=fetch}={}){
 const base=new URL(target);if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw new Error('NAS 同步網址格式不符');
 const sessions=new Map(),cookieName='csq_nas_sync';
 const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const call=async(route,cookie,body,method='POST')=>fetcher(base.origin+route,{method:body===undefined?'GET':method,headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(60000)});
 return async(req,res)=>{
  if(!['localhost','127.0.0.1','[::1]'].includes(new URL(`http://${req.headers.host}`).hostname)){send(res,403,{error:'同步服務僅供本機工作站使用'});return;}
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){send(res,403,{error:'請從本機工作站操作同步'});return;}
  const route=new URL(req.url,'http://localhost').pathname.slice('/api/nas-sync'.length);
  const allowed=route==='/login'||route==='/logout'||route==='/apply'?req.method==='POST':route==='/status'||route==='/workspace'?req.method==='GET':false;
  if(!allowed){send(res,405,{error:'同步操作不支援'});return;}
  try{
   let body;if(req.method==='POST'){
    if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,{error:'同步請使用 JSON 格式'});return;}
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>30*1024*1024){send(res,413,{error:'同步資料過大'});return;}chunks.push(chunk);}body=JSON.parse(Buffer.concat(chunks).toString());
   }
   const id=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1),session=sessions.get(id);
   for(const [key,value] of sessions)if(value.expires<Date.now())sessions.delete(key);
   if(route==='/status'){send(res,200,{target:base.origin,connected:!!session&&session.expires>Date.now(),user:session?.user});return;}
   if(route==='/login'){
    const r=await call('/api/shared/login','',{username:body.username,password:body.password}),data=await r.json();
    if(!r.ok){send(res,r.status,{error:data.error||'NAS 登入失敗'});return;}
    const cookie=r.headers.get('set-cookie')?.split(';')[0];
    if(!cookie||data.user?.role!=='admin'){if(cookie)await call('/api/shared/logout',cookie,{});send(res,403,{error:'同步請使用 NAS 管理員帳號，以便先備份資料'});return;}
    if(id)sessions.delete(id);const token=randomBytes(32).toString('hex');sessions.set(token,{cookie,user:data.user,expires:Date.now()+12*3600000});
    res.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api/nas-sync; Max-Age=43200`);send(res,200,{target:base.origin,user:data.user});return;
   }
   if(!session||session.expires<Date.now()){send(res,401,{error:'請先登入 NAS 管理員帳號'});return;}
   if(route==='/logout'){await call('/api/shared/logout',session.cookie,{});sessions.delete(id);res.setHeader('Set-Cookie',`${cookieName}=; HttpOnly; SameSite=Strict; Path=/api/nas-sync; Max-Age=0`);send(res,200,{ok:true});return;}
   if(route==='/apply'){
    if(!Array.isArray(body.changes)||body.changes.some(c=>!c||c.after==null)){send(res,400,{error:'同步不支援刪除資料'});return;}
    const backup=await call('/api/shared/backup',session.cookie,{});
    if(!backup.ok){await backup.body?.cancel();send(res,backup.status,{error:'NAS 備份失敗，尚未同步任何資料'});return;}await backup.body?.cancel();
   }
   const r=await call(route==='/workspace'?'/api/shared/workspace':'/api/shared/restore',session.cookie,route==='/apply'?{changes:body.changes}:undefined),data=await r.json();
   send(res,r.status,data);
  }catch{send(res,502,{error:'NAS 連線失敗或回應逾時。請確認公司網路，再重新檢查差異；本機資料保留。'});}
 };
}
