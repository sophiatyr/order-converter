import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {reserveRelease} from './scripts/release-version.mjs';

export default defineConfig(({command}) => {
  const release = command === 'build' ? reserveRelease() : {version:'開發中',builtAt:''};
  return {
    base: './',
    define: {__CSQ_RELEASE__:JSON.stringify(release)},
    plugins: [react(), tailwindcss(), {
      name:'csq-release',
      transformIndexHtml: () => [{tag:'meta',attrs:{name:'csq-version',content:release.version},injectTo:'head'}],
      generateBundle() {this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify(release,null,2)});},
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
