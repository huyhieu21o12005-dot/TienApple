import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absoluteUrl, productImage, productMeta, ogHtml, LOGO_PATH } from '../../api/_og.js';

const O = 'https://tienappletd.com';

test('absoluteUrl: đường dẫn web thành https tuyệt đối, bỏ địa chỉ lạ', () => {
  assert.equal(absoluteUrl('/assets/models/a.png', O), `${O}/assets/models/a.png`);
  assert.equal(absoluteUrl('//cdn.x/a.png', O), 'https://cdn.x/a.png');
  assert.equal(absoluteUrl('https://a/b.png', O), 'https://a/b.png');
  assert.equal(absoluteUrl('javascript:alert(1)', O), '');
  assert.equal(absoluteUrl('', O), '');
});

test('productImage: ưu tiên ảnh đã chọn, trống thì ảnh theo mẫu, không có thì logo web', () => {
  assert.equal(productImage({ name: 'X', image_url: 'https://s/p.png' }, O), 'https://s/p.png');
  assert.match(productImage({ name: 'iPhone 15 Pro Max', image_url: '' }, O), /^https:\/\//);
  assert.equal(productImage({ name: 'Món lạ không có ảnh', image_url: '' }, O), `${O}${LOGO_PATH}`);
});

test('productMeta + ogHtml: có tên, giá, ảnh, link và thoát ký tự HTML', () => {
  const m = productMeta({ id: 'a&b', name: 'iPhone <15>', price: 12500000, image_url: 'https://s/p.png', condition_label: 'Mới 100%' }, O);
  assert.equal(m.url, `${O}/product.html?id=a%26b`);
  assert.match(m.desc, /12\.500\.000đ/);
  const html = ogHtml(m);
  assert.match(html, /property="og:image" content="https:\/\/s\/p\.png"/);
  assert.doesNotMatch(html, /iPhone <15>/);
  assert.match(html, /iPhone &lt;15&gt;/);
});
