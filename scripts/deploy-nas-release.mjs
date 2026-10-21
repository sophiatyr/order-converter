import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function frontendFiles(root) {
  const names = ['index.html','release.json'];
  if(fs.existsSync(path.join(root,'csq-factory-packing-standard.xlsx')))names.push('csq-factory-packing-standard.xlsx');
  function walk(dir) {
    if (!fs.existsSync(path.join(root,dir))) return;
    for (const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
      const name = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(name);
      else if (e.isFile()) names.push(name);
      else throw new Error('更新包不能包含連結');
    }
  }
  for (const dir of ['assets','branding','vendor']) walk(dir);
  return names;
}

export async function deployFrontend({source,target,backup,base,fetcher=fetch}) {
  const release = JSON.parse(fs.readFileSync(path.join(source,'release.json'),'utf8'));
  if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release.version)) throw Error('缺少有效版號');
  const files = frontendFiles(source), html = fs.readFileSync(path.join(source,'index.html'),'utf8');
  if (!html.includes(`content="${release.version}"`)) throw Error('網頁與版號不一致');
  fs.mkdirSync(backup,{recursive:true});
  const old = new Map();
  // All overwritten files are backed up before the first write. Company data is never selected.
  for (const name of files) {
    const dest = path.join(target,name);
    old.set(name,fs.existsSync(dest) ? fs.readFileSync(dest) : null);
    if (old.get(name)) {fs.mkdirSync(path.dirname(path.join(backup,name)),{recursive:true});fs.writeFileSync(path.join(backup,name),old.get(name));}
  }
  try {
    // Publish the entry page last, keeping the existing page usable during asset transfer.
    for (const name of [...files.filter(n=>n!=='index.html'),'index.html']) {
      const bytes = fs.readFileSync(path.join(source,name)), dest = path.join(target,name);
      fs.mkdirSync(path.dirname(dest),{recursive:true});
      if (!old.get(name) || hash(old.get(name))!==hash(bytes)) fs.writeFileSync(dest,bytes);
      if (hash(fs.readFileSync(dest))!==hash(bytes)) throw Error('NAS 檔案核對失敗：'+name);
    }
    // Verify the HTTP-served bytes, rather than assuming a copied file is live.
    for (const name of files.filter(n=>n==='index.html'||n.startsWith('assets/'))) {
      const response = await fetcher(`${base}/${name==='index.html'?'':name}?release=${release.version}`,{signal:AbortSignal.timeout(20000),cache:'no-store'});
      if (!response.ok || hash(Buffer.from(await response.arrayBuffer()))!==hash(fs.readFileSync(path.join(source,name)))) throw Error('NAS 上線核對失敗：'+name);
    }
    const report = {...release,frontendVerified:true,files:files.length,databaseUntouched:true};
    fs.writeFileSync(path.join(backup,'report.json'),JSON.stringify(report,null,2));
    return report;
  } catch (error) {
    // Restore the old entry first. New hashed assets can remain unused for investigation.
    for (const name of ['index.html',...files.filter(n=>n!=='index.html')]) if (old.get(name)) fs.writeFileSync(path.join(target,name),old.get(name));
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = path.resolve('work/program-build');
  const release = JSON.parse(fs.readFileSync(path.join(source,'release.json'),'utf8'));
  const target = '\\\\192.168.1.6\\docker\\Cisalfa';
  const backup = path.resolve(`work/nas-release-before-${release.version}-${new Date().toISOString().replace(/[:.]/g,'-')}`);
  const report = await deployFrontend({source,target:path.join(target,'dist'),backup,base:'http://192.168.1.6:8888'});
  const serverFiles=['nasServer.mjs','nasDatabase.mjs','workspace-validation.mjs'];
  const serverHash=createHash('sha256');for(const name of serverFiles)serverHash.update(name).update(fs.readFileSync(path.join('server',name)));report.expectedServerDigest=serverHash.digest('hex');
  const health=await(await fetch('http://192.168.1.6:8888/api/health',{signal:AbortSignal.timeout(15000)})).json();
  report.runningServerVerified=health.ok===true&&health.serverDigest===report.expectedServerDigest;
  report.serverRebuildRequired = serverFiles.some(name=>!fs.existsSync(path.join(target,'server',name))||hash(fs.readFileSync(path.join(target,'server',name)))!==hash(fs.readFileSync(path.join('server',name))))
    || !report.runningServerVerified
    || ['package.json','package-lock.json'].some(name=>!fs.existsSync(path.join(target,name))||hash(fs.readFileSync(path.join(target,name)))!==hash(fs.readFileSync(name)));
  // Stage the complete server update separately; do not change the running server's source.
  const stage = path.join(target,'program-updates',release.version);
  fs.mkdirSync(path.join(stage,'server'),{recursive:true});
  for (const name of serverFiles) fs.copyFileSync(path.join('server',name),path.join(stage,'server',name));
  for (const name of ['package.json','package-lock.json']) fs.copyFileSync(name,path.join(stage,name));
  fs.copyFileSync('deploy/nas/Dockerfile',path.join(stage,'Dockerfile'));
  fs.writeFileSync(path.join(stage,'release.json'),JSON.stringify(release,null,2));
  fs.writeFileSync(path.join(backup,'report.json'),JSON.stringify({...report,stage},null,2));
  console.log(JSON.stringify({...report,backup,stage},null,2));
  if(report.serverRebuildRequired) {console.error('網頁已同步；伺服器更新包已準備，仍須重建 NAS 服務，尚未宣告整體升級完成。');process.exitCode=2;}
}
