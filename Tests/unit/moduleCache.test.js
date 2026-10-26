import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const front = resolve(root, 'Frontend');

/** Mọi module .js mà trang nạp (theo import tương đối), tính từ một tệp đầu vào. */
function graph(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const src = readFileSync(entry, 'utf8');
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    graph(resolve(dirname(entry), m[1] || m[2]), seen);
  }
  return seen;
}

describe('bản mới của module luôn được tải (import map có số phiên bản)', () => {
  for (const [page, entry] of [['index.html', 'js/app.js'], ['product.html', 'js/product.js']]) {
    it(`${page}: import map phủ mọi module phụ thuộc, cùng một số phiên bản với tệp đầu vào`, () => {
      const html = readFileSync(resolve(front, page), 'utf8');
      const mapSrc = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html)?.[1];
      assert.ok(mapSrc, 'thiếu import map');
      assert.ok(html.indexOf('type="importmap"') < html.indexOf('type="module"'), 'import map phải đứng trước script module');
      const imports = JSON.parse(mapSrc).imports;
      const version = /src="js\/[a-z0-9]+\.js\?v=([\w.]+)"/i.exec(html)?.[1];
      assert.ok(version, 'tệp đầu vào thiếu ?v=');
      const missing = [];
      for (const file of graph(resolve(front, entry))) {
        const key = './' + relative(front, file);
        if (file === resolve(front, entry)) continue;
        if (imports[key] !== `${key}?v=${version}`) missing.push(key);
      }
      assert.deepEqual(missing, []);
    });
  }

  it('số phiên bản trong trang khớp nội dung CSS/JS hiện tại (nếu sửa mã mà chưa chạy npm run build:stamp thì báo lỗi)', async () => {
    const { execFileSync } = await import('node:child_process');
    execFileSync('node', ['tools/stamp-modules.mjs', '--check'], { cwd: root, stdio: 'pipe' });
  });
});
