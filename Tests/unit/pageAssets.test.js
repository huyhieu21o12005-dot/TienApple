import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const pages = ['Frontend/index.html', 'Frontend/product.html'];

describe('CSS Tailwind biên dịch sẵn thay cho bản chạy trong trình duyệt', () => {
  it('trang không còn tải script Tailwind từ CDN', () => {
    for (const p of pages) assert.doesNotMatch(read(p), /cdn\.tailwindcss\.com/, p);
  });
  it('trang liên kết css/tailwind.css sau css/style.css (giữ thứ tự ưu tiên như trước)', () => {
    for (const p of pages) {
      const h = read(p);
      const a = h.indexOf('css/style.css');
      const b = h.indexOf('css/tailwind.css');
      assert.ok(a >= 0 && b > a, p);
    }
  });
  it('tệp CSS có sẵn, gọn và chứa các lớp đang dùng ở trang bán hàng', () => {
    assert.ok(statSync(new URL('../../Frontend/css/tailwind.css', import.meta.url)).size < 80 * 1024);
    const css = read('Frontend/css/tailwind.css');
    for (const needle of ['.line-clamp-2', '.min-h-\\[2\\.75em\\]', '.h-44', '.bg-\\[\\#F5F5F7\\]', 'font-family:Inter', '.xl\\:flex']) {
      assert.ok(css.includes(needle), needle);
    }
  });
  it('mọi lớp tiện ích Tailwind dùng trong trang và mã JS đều có trong CSS biên dịch (nhắc chạy npm run build:css)', () => {
    const css = read('Frontend/css/tailwind.css');
    const own = read('Frontend/css/style.css');
    const files = ['Frontend/js/templates.js', 'Frontend/js/product.js', 'Frontend/js/app.js', 'Frontend/index.html', 'Frontend/product.html'];
    const esc = (c) => c.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
    const ownClass = /^(product-card|tm-|hero-|info-|nav-|cart-|brand-|search-|site-|material-symbols|mega-|mobile-|booking-|header-|layer|swatch|chip|btn|toast|modal|tag-|filter|field|form-|cta-|contact|maps-|water|phone-|is-|active|animate-|scroll|price|rating|stock|badge|empty|faq|step|trade|install|warranty|repair|service|promo|footer|section|metric|stat|card|grid|list|item|panel|dialog|overlay|drawer|close|open|show|hidden-|js-|data-)/;
    const missing = [];
    for (const f of files) {
      const src = read(f);
      for (const m of src.matchAll(/class="([^"$]*)"/g)) for (const c of m[1].split(/\s+/)) {
        if (!c || ownClass.test(c)) continue;
        if (!/^(?:[a-z0-9-]+:)*-?[a-z]+(?:-[a-z0-9.\/\[\]#%_,()+-]+)*(?:\[[^\]]+\])?$/i.test(c)) continue;
        if (!css.includes(`.${esc(c)}`) && !own.includes(`.${c}`)) missing.push(`${f}: ${c}`);
      }
    }
    assert.deepEqual([...new Set(missing)], []);
  });
});

describe('phông biểu tượng chỉ tải đúng các biểu tượng đang dùng', () => {
  const usedIcons = () => {
    const files = ['Frontend/index.html', 'Frontend/product.html', 'Frontend/js/app.js', 'Frontend/js/templates.js', 'Frontend/js/product.js'];
    const set = new Set();
    for (const f of files) {
      const s = read(f);
      for (const m of s.matchAll(/material-symbols-outlined[^>]*>([a-z][a-z_0-9]*)</g)) set.add(m[1]);
      for (const m of s.matchAll(/icon\.textContent\s*=\s*(?:[^'?]*\?\s*)?'([a-z_0-9]+)'(?:\s*:\s*'([a-z_0-9]+)')?/g)) { set.add(m[1]); if (m[2]) set.add(m[2]); }
    }
    return set;
  };
  const listed = (html) => {
    const m = /fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined[^"]*?icon_names=([a-z_0-9,]+)/.exec(html);
    return m ? m[1].split(',') : null;
  };
  for (const p of pages) {
    it(`${p}: có icon_names (đã sắp xếp) và đủ mọi biểu tượng dùng trong mã`, () => {
      const names = listed(read(p));
      assert.ok(names, 'thiếu icon_names');
      assert.deepEqual(names, [...names].sort(), 'icon_names phải sắp theo thứ tự chữ cái');
      const used = [...usedIcons()];
      assert.ok(used.length >= 20);
      assert.deepEqual(used.filter(n => !names.includes(n)), []);
    });
    it(`${p}: phông biểu tượng dùng display=block để không lộ tên biểu tượng dạng chữ`, () => {
      assert.match(read(p), /Material\+Symbols\+Outlined[^"]*display=block/);
    });
  }
});

describe('three.js và mô hình 3D không chặn lần vẽ đầu', () => {
  it('trang chủ không nhúng sẵn three.js, GLTFLoader hay tải trước file .glb', () => {
    const h = read('Frontend/index.html');
    assert.doesNotMatch(h, /<script[^>]+three\.min\.js/);
    assert.doesNotMatch(h, /<script[^>]+GLTFLoader\.js/);
    assert.doesNotMatch(h, /rel="preload"[^>]+\.glb/);
  });
  it('hero3d tự nạp three.js khi trình duyệt rảnh', () => {
    const s = read('Frontend/js/hero3d.js');
    assert.match(s, /from '\.\/lazyScripts\.js'/);
    assert.match(s, /whenPageIdle/);
    assert.match(s, /js\/three\.min\.js/);
  });
});
