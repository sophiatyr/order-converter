import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const candidates=[process.env.CSQ_PYTHON,path.join(process.env.USERPROFILE||'','\.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),'python'];
let done=false;
for(const executable of candidates.filter(Boolean)){const check=spawnSync(executable,['-c','import openpyxl'],{windowsHide:true,stdio:'ignore'});if(check.status!==0)continue;const result=spawnSync(executable,['scripts/prepare-document-templates.py'],{windowsHide:true,stdio:'inherit',env:{...process.env,PYTHONIOENCODING:'utf-8'}});if(result.status!==0)throw new Error('文件範本建立失敗，原始檔保留。');done=true;break;}
if(!done){if(existsSync('public/csq-document-templates.json'))console.log('Using the saved offline document layouts. Python with openpyxl is needed to refresh source templates.');else throw new Error('尚無文件範本；需以 Python + openpyxl 建立本機範本快照。');}
