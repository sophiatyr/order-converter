import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const root = path.resolve(fs.existsSync('CSQ參考資料/訂單作業/工廠採購單') ? 'CSQ參考資料/訂單作業/工廠採購單' : 'CSQ參考資料/工廠採購單');
const records = [], warnings = [];
function walk(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(folder, e.name)) : [path.join(folder, e.name)]);
}
for (const file of walk(root).filter(f => /\.xlsx?$/i.test(f) && !path.basename(f).startsWith('~$'))) {
  try {
    const book = XLSX.readFile(file);
    for (const sheet of book.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(book.Sheets[sheet], { header: 1, defval: '' });
      const poNumbers = [...new Set(rows.flat().join(' ').match(/\b\d{2}OF\d{6}\b/g) || [])];
      for (let r = 0; r < rows.length; r++) {
        const style = String(rows[r][1] || '').trim().toUpperCase();
        if (!/^\d+$/.test(String(rows[r][0]).trim()) || !/^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*$/.test(style)) continue;
        const lines = [];
        for (let j = r + 1; j < Math.min(r + 9, rows.length); j++) {
          if (String(rows[j][0]).trim() || String(rows[j][1]).trim()) break;
          const line = String(rows[j][2] || '').trim();
          if (/尺寸|尺碼|尺码/.test(line)) break;
          if (line) lines.push(line);
        }
        const spec = lines.join('\n').replace(/^面料\s*[:：]\s*/, '');
        if (spec) records.push({ style, name: String(rows[r][2] || '').trim(), spec, poNumbers,
          sourceFile: path.relative(path.resolve('CSQ參考資料'), file).replaceAll('\\', '/'), sheet, row: r + 1 });
      }
    }
  } catch { warnings.push(path.basename(file)); }
}
const destination = 'public/csq-reference-products.json';
if (fs.existsSync(root)) {
  fs.writeFileSync(destination, JSON.stringify({ updatedAt: new Date().toISOString(), records, warnings }, null, 2));
  console.log(`CSQ reference compositions: ${records.length} entries; ${warnings.length} unreadable files.`);
} else console.log('Reference folder absent; existing snapshot retained, otherwise original PO descriptions are used.');
