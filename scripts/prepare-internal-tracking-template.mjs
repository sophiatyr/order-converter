import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
// Preserve original OOXML/style/print parts; strip order values before publishing a reusable template.
const bundled=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python=process.env.CSQ_PYTHON||(fs.existsSync(bundled)?bundled:process.platform==='win32'?'python':'python3');
execFileSync(python,['scripts/prepare-internal-tracking-template.py'],{stdio:'inherit',windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
