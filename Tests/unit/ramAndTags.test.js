import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withoutRam, descriptionFor } from '../../Frontend/js/utils.js';
import { planNewProducts, planUsedProducts } from '../../Frontend/admin/sheetPricing.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('bỏ RAM khỏi mô tả iPhone', () => {
  it('withoutRam bỏ đoạn RAM trong chuỗi ngăn bởi dấu chấm tròn', () => {
    assert.equal(withoutRam('Vàng, pin 90% • RAM 8GB • Ảnh minh họa'), 'Vàng, pin 90% • Ảnh minh họa');
    assert.equal(withoutRam('RAM 12GB • Bộ nhớ 256GB • Bảo hành 12T'), 'Bộ nhớ 256GB • Bảo hành 12T');
    assert.equal(withoutRam('Đen, RAM 6GB, pin 100%'), 'Đen, pin 100%');
    assert.equal(withoutRam(''), '');
    assert.equal(withoutRam(null), '');
    assert.equal(withoutRam('Không nhắc gì'), 'Không nhắc gì');
  });
  it('descriptionFor chỉ bỏ RAM với iPhone, iPad giữ nguyên', () => {
    assert.equal(descriptionFor({ name: 'iPhone 16 Pro', description: 'Đen • RAM 8GB' }), 'Đen');
    assert.equal(descriptionFor({ name: 'iPad Air 11', description: 'Wifi • RAM 8GB' }), 'Wifi • RAM 8GB');
    assert.equal(descriptionFor({ name: 'iPhone 15' }), '');
  });
  it('productsApi dùng descriptionFor khi dựng sản phẩm hiển thị', () => {
    assert.match(read('Frontend/js/productsApi.js'), /descriptionFor\(/);
  });
});

describe('đồng bộ Sheet không ghi RAM cho iPhone', () => {
  const newHeader = ['', 'Hãng', 'Mẫu Sản Phẩm', 'Phiên Bản / Bộ Nhớ', 'RAM', 'Giá Bán', 'Sale (%)', 'Giá Sau Sale', 'Tồn Kho', 'Trạng Thái'];
  it('mã nguồn: phần mô tả của sản phẩm Apple/iPhone không còn ghép RAM', () => {
    const src = read('Frontend/admin/sheetPricing.js');
    assert.match(src, /!isIphone\([^)]*\) && r\.ram/);
    assert.match(src, /!isPhone && r\.ram/);
  });
  it('planNewProducts / planUsedProducts vẫn là hàm', () => {
    assert.equal(typeof planNewProducts, 'function');
    assert.equal(typeof planUsedProducts, 'function');
    assert.ok(newHeader.length);
  });
});

describe('thẻ iPhone / iPad trong menu mobile giống thẻ trên web máy tính', () => {
  const idx = read('Frontend/index.html');
  const js = read('Frontend/js/app.js');
  const css = read('Frontend/css/style.css');
  it('thẻ nằm ngay dưới mục "Điện thoại" trong menu, không đứng riêng ở đầu menu', () => {
    const panel = idx.slice(idx.indexOf('id="mobileMenuPanel"'));
    assert.ok(panel.indexOf('data-layer="layer-dienthoai"') < panel.indexOf('id="mobileQuick"'));
    assert.ok(panel.indexOf('id="mobileQuick"') < panel.indexOf('data-layer="layer-suachua"'));
  });
  it('dùng cùng kiểu mega-tag (kèm số lượng) như menu trên web', () => {
    assert.doesNotMatch(js, /class="mega-chip"/);
    assert.match(js, /quick\.innerHTML = .*link\('phone', 'all', 'iPhone'/);
    assert.match(js, /link\('acc', 'tablet', 'iPad'/);
    assert.doesNotMatch(css, /\.mega-chip/);
  });
});

describe('cỡ chữ các thẻ đồng bộ 13px', () => {
  const css = read('Frontend/css/style.css');
  const sizeIn = (selector) => {
    const m = new RegExp(`${selector.replace(/[.\\[\\]]/g, '\\$&')}\\s*\\{[^}]*font-size:\\s*(\\d+)px`).exec(css);
    return m && Number(m[1]);
  };
  it('thẻ chọn, thẻ nhanh, nút Lọc, thẻ menu đều 13px', () => {
    for (const sel of ['.filter-chip', '.filter-toggle', '.catalog-tags .cs-trigger', '.mega-tag']) assert.equal(sizeIn(sel), 13, sel);
  });
  it('nhãn nhóm trong bộ lọc 11px', () => {
    assert.equal(sizeIn('.filter-chip-label'), 11);
  });
});
