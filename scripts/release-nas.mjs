import {spawnSync} from 'node:child_process';
function run(file,args) {
  const result=spawnSync(process.execPath,[file,...args],{stdio:'inherit',windowsHide:true});
  if(result.status!==0)process.exit(result.status||1);
}
// One build reserves one version; both workstations receive those exact bytes.
run('node_modules/typescript/bin/tsc',['--noEmit']);
run('scripts/build-code.mjs',[]);
run('scripts/package-local.mjs',['work/program-build']);
run('scripts/package-nas-update.mjs',[]);
run('scripts/deploy-nas-release.mjs',[]);
