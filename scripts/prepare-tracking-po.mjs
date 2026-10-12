import {build} from 'esbuild';
await build({entryPoints:['scripts/prepare-tracking-po.ts'],outfile:'work/prepare-tracking-po.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
await import('../work/prepare-tracking-po.mjs');
