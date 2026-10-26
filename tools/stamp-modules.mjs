// Đóng dấu phiên bản cho CSS/JS của từng trang (chạy: npm run build:stamp, rồi commit).
// Phiên bản = mã băm nội dung nên tự đổi khi tệp đổi; import map làm cho mọi module phụ thuộc
// cũng được nạp với cùng số phiên bản, tránh trình duyệt giữ module cũ sau khi cập nhật.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const front = resolve(fileURLToPath(new URL('../Frontend/', import.meta.url)));
const CHECK = process.argv.includes('--check');
const PAGES = [['index.html', 'js/app.js'], ['product.html', 'js/product.js']];
const CSS = ['css/style.css', 'css/tailwind.css'];

function graph(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const src = readFileSync(entry, 'utf8');
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    graph(resolve(dirname(entry), m[1] || m[2]), seen);
  }
  return seen;
}

for (const [page, entry] of PAGES) {
  const files = [...graph(resolve(front, entry))].sort();
  const hash = createHash('sha1');
  for (const f of [...files, ...CSS.map(c => resolve(front, c))]) hash.update(readFileSync(f));
  const v = hash.digest('hex').slice(0, 8);
  const imports = {};
  for (const f of files) {
    if (f === resolve(front, entry)) continue;
    const key = './' + relative(front, f);
    imports[key] = `${key}?v=${v}`;
  }
  const map = `<script type="importmap">${JSON.stringify({ imports }, null, 2).replace(/\n/g, '\n  ')}</script>`;
  const file = resolve(front, page);
  let html = readFileSync(file, 'utf8');
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
  html = html.replace(/(href="css\/(?:style|tailwind)\.css)(\?v=\w+)?"/g, `$1?v=${v}"`);
  html = html.replace(new RegExp(`src="${entry.replace('.', '\\.')}(\\?v=\\w+)?"`), `src="${entry}?v=${v}"`);
  html = html.replace(/(\s*)(<script type="module" src="js\/)/, `$1${map}$1$2`);
  if (CHECK) {
    if (html !== readFileSync(file, 'utf8')) { console.error(`${page}: số phiên bản đã cũ, chạy npm run build:stamp`); process.exitCode = 1; }
    continue;
  }
  writeFileSync(file, html);
  console.log(`${page}: v=${v}, ${Object.keys(imports).length} module`);
}
