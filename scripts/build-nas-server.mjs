import {build} from 'esbuild';
await build({entryPoints:['src/utils/workspace.ts'],outfile:'server/workspace-validation.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
console.log('NAS workspace validation prepared.');
