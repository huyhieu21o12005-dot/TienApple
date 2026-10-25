import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productCardHtml, cartItemHtml } from '../../Frontend/js/templates.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const p = { id: 'a', name: 'iPhone 15', price: 100, image: 'https://x/a.png', description: '' };
const imgTags = (html) => [...html.matchAll(/<img\b[^>]*>/gs)].map(m => m[0]);

describe('thẻ ảnh sản phẩm: tải lười, giải mã nền, có alt', () => {
  it('ảnh thẻ sản phẩm tải lười, giải mã bất đồng bộ và có alt là tên máy', () => {
    const [img] = imgTags(productCardHtml(p));
    assert.match(img, /loading="lazy"/);
    assert.match(img, /decoding="async"/);
    assert.match(img, /alt="iPhone 15"/);
  });
  it('ảnh trong giỏ hàng tải lười và giải mã bất đồng bộ', () => {
    const [img] = imgTags(cartItemHtml({ product: p, quantity: 1 }, 0));
    assert.match(img, /loading="lazy"/);
    assert.match(img, /decoding="async"/);
  });
  it('ảnh chính trang chi tiết sản phẩm được ưu tiên tải (không lười)', () => {
    const s = read('Frontend/js/product.js');
    const main = /<img src="\$\{escapeHtml\(safeUrl\(p\.image\)[^>]*>/.exec(s)[0];
    assert.match(main, /fetchpriority="high"/);
    assert.match(main, /decoding="async"/);
    assert.doesNotMatch(main, /loading="lazy"/);
  });
  it('ảnh kết quả tìm kiếm trên thanh đầu tải lười và giải mã bất đồng bộ', () => {
    const s = read('Frontend/js/app.js');
    const search = /<img src="\$\{escapeHtml\(safeUrl\(p\.image\)\)\}"[^>]*>/.exec(s)[0];
    assert.match(search, /loading="lazy"/);
    assert.match(search, /decoding="async"/);
  });
  it('mọi ảnh tĩnh trong index.html có thuộc tính alt (ảnh trang trí để alt rỗng)', () => {
    const tags = imgTags(read('Frontend/index.html'));
    assert.ok(tags.length > 0);
    assert.deepEqual(tags.filter(t => !/\balt=/.test(t)), []);
  });
});
