import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productCardHtml } from '../../Frontend/js/templates.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const BLUR_ATTR = /class="[^"]*\bimg-blur\b[^"]*"[\s\S]*?onload="this\.classList\.add\('is-loaded'\)"[\s\S]*?onerror="this\.classList\.add\('is-loaded'\)"/;

describe('ảnh mờ dần khi đang tải (blur-up)', () => {
  it('ảnh trên thẻ sản phẩm có lớp img-blur và gỡ mờ khi tải xong hoặc lỗi', () => {
    const html = productCardHtml({ id: 'a', name: 'iPhone 15', price: 1000000, image: 'https://x/y.png', colors: [], storages: [] });
    assert.match(html, BLUR_ATTR);
  });
  it('ảnh chính ở trang chi tiết sản phẩm cũng mờ dần', () => {
    const js = read('Frontend/js/product.js');
    assert.match(js, /class="[^"]*\bimg-blur\b[^"]*"/);
    assert.match(js, /onload="this\.classList\.add\('is-loaded'\)"/);
  });
  it('CSS: ảnh mờ khi chưa tải, rõ khi tải xong, và tắt hiệu ứng nếu người dùng giảm chuyển động', () => {
    const css = read('Frontend/css/style.css');
    assert.match(css, /\.img-blur\s*\{[^}]*filter:\s*blur\(/);
    assert.match(css, /\.img-blur\.is-loaded\s*\{[^}]*filter:\s*none/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.sk-card/);
  });
});

describe('khung chờ mờ thay cho ô trống khi chưa có sản phẩm', () => {
  const html = read('Frontend/index.html');
  const grid = (id) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('</div>', html.indexOf(`id="${id}"`) + 400) + 6);
  it('lưới điện thoại và phụ kiện có sẵn các thẻ chờ, báo aria-busy cho trình đọc màn hình', () => {
    const phone = html.slice(html.indexOf('id="productGrid"'), html.indexOf('id="productGrid"') + 6000);
    assert.ok((phone.match(/class="sk-card"/g) || []).length >= 8, 'cần ít nhất 8 thẻ chờ');
    assert.match(html, /id="productGrid"[^>]*aria-busy="true"/);
    const acc = html.slice(html.indexOf('id="accessoryGrid"'), html.indexOf('id="accessoryGrid"') + 4000);
    assert.ok((acc.match(/class="sk-card"/g) || []).length >= 4);
    assert.ok(grid('productGrid').length > 0);
  });
  it('CSS thẻ chờ: khối mờ có hiệu ứng lướt sáng', () => {
    const css = read('Frontend/css/style.css');
    assert.match(css, /\.sk-card\s*\{/);
    assert.match(css, /@keyframes sk-shimmer/);
    assert.match(css, /\.sk-card[^{]*\{[^}]*filter:\s*blur\(/);
  });
  it('khi có dữ liệu thật thì bỏ aria-busy', () => {
    assert.match(read('Frontend/js/app.js'), /removeAttribute\('aria-busy'\)/);
  });
});
