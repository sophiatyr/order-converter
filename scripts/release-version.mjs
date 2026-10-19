import fs from 'node:fs';
import path from 'node:path';

export function nextVersion(previous, date = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(date).replaceAll('-', '.');
  const match = /^(\d{4}\.\d{2}\.\d{2})\.(\d+)$/.exec(previous || '');
  // Keep versions increasing even if the workstation clock moves backwards.
  const prefix = match && match[1] > day ? match[1] : day;
  return `${prefix}.${match && match[1] === prefix ? Number(match[2]) + 1 : 1}`;
}

export function reserveRelease(root = process.cwd()) {
  const file = path.join(root, 'release.json'), lock = file + '.lock';
  const fd = fs.openSync(lock, 'wx');
  try {
    const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).version : '';
    const release = {version:nextVersion(previous), builtAt:new Date().toISOString()};
    fs.writeFileSync(file, JSON.stringify(release, null, 2) + '\n');
    return release;
  } finally {fs.closeSync(fd); fs.unlinkSync(lock);}
}
