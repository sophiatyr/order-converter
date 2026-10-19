import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {nextVersion,reserveRelease} from '../scripts/release-version.mjs';
import {deployFrontend} from '../scripts/deploy-nas-release.mjs';
import {versionedCompose} from '../scripts/nas-image-version.mjs';
const yaml='services:\r\n  csq:\r\n    build: .\r\n    volumes:\r\n      - ./data:/data\r\n  other:\r\n    image: keep:latest\r\n';
const tagged=versionedCompose(yaml,'2026.10.19.3');assert.equal(tagged.replace('    image: cisalfa-csq:2026.10.19.3\r\n',''),yaml);assert.equal(versionedCompose(tagged,'2026.10.19.4').replace('2026.10.19.4','2026.10.19.3'),tagged);assert.throws(()=>versionedCompose(yaml.replace('build: .','image: custom:latest'),'2026.10.19.3'));
assert.equal(nextVersion('2026.10.19.2',new Date('2026-10-19T08:00:00Z')),'2026.10.19.3');
assert.equal(nextVersion('2026.10.19.2',new Date('2026-10-19T16:01:00Z')),'2026.10.20.1');
assert.equal(nextVersion('2026.10.20.2',new Date('2026-10-19T08:00:00Z')),'2026.10.20.3');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'csq-release-'));
try {
  const first=reserveRelease(root),second=reserveRelease(root);assert.notEqual(first.version,second.version);
  const source=path.join(root,'source'),target=path.join(root,'target');
  fs.mkdirSync(path.join(source,'assets'),{recursive:true});fs.mkdirSync(target);
  fs.writeFileSync(path.join(source,'index.html'),`<meta content="${second.version}"><script src="assets/new.js"></script>`);
  fs.writeFileSync(path.join(source,'release.json'),JSON.stringify(second));fs.writeFileSync(path.join(source,'assets/new.js'),'new');
  fs.writeFileSync(path.join(target,'index.html'),'old');fs.writeFileSync(path.join(target,'company.json'),'private data');
  const options={source,target,backup:path.join(root,'backup'),base:'http://example.test'};
  await assert.rejects(deployFrontend({...options,fetcher:async()=>new Response('wrong')}),/上線核對失敗/);
  assert.equal(fs.readFileSync(path.join(target,'index.html'),'utf8'),'old');
  const report=await deployFrontend({...options,backup:path.join(root,'backup2'),fetcher:async url=>new Response(fs.readFileSync(path.join(target,new URL(url).pathname.slice(1)||'index.html')))});
  assert.equal(report.frontendVerified,true);assert.equal(fs.readFileSync(path.join(target,'company.json'),'utf8'),'private data');
} finally {fs.rmSync(root,{recursive:true,force:true});}
console.log('Release numbering, NAS verification, rollback and data preservation passed.');
