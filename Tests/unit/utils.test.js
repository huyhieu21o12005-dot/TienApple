import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  jsArg,
  safeUrl,
  safeColor,
  isAccessory,
  partitionProducts,
  discountPercent
} from '../../Frontend/js/utils.js';

describe('utils - chống XSS và phân loại sản phẩm', () => {
  it('escapeHtml escape đủ 5 ký tự nguy hiểm và chịu được null/undefined/số', () => {
    assert.equal(escapeHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(42), '42');
  });

  it('jsArg tạo đối số chuỗi an toàn cho onclick, không thoát khỏi chuỗi JS', () => {
    const payload = `x');alert(1);('`;
    const out = jsArg(payload);
    // Sau khi trình duyệt giải mã thực thể HTML, phải là một chuỗi JSON hợp lệ duy nhất
    const decoded = out.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    assert.equal(JSON.parse(decoded), payload);
    assert.ok(!out.includes('"'), 'không còn dấu nháy kép thô trong thuộc tính');
    assert.equal(jsArg(null), '&quot;&quot;');
  });

  it('safeUrl chỉ cho http(s), data:image, đường dẫn tương đối', () => {
    assert.equal(safeUrl('https://a.com/x.png'), 'https://a.com/x.png');
    assert.equal(safeUrl('  http://a.com/x.png '), 'http://a.com/x.png');
    assert.equal(safeUrl('assets/a.png'), 'assets/a.png');
    assert.equal(safeUrl('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
    assert.equal(safeUrl('javascript:alert(1)'), '');
    assert.equal(safeUrl('JaVaScRiPt:alert(1)'), '');
    assert.equal(safeUrl('data:text/html;base64,AAAA'), '');
    assert.equal(safeUrl('//evil.com/x.png'), '');
    assert.equal(safeUrl(''), '');
    assert.equal(safeUrl(null), '');
    assert.equal(safeUrl(123), '');
  });

  it('safeColor chỉ nhận mã hex hợp lệ', () => {
    assert.equal(safeColor('#fff'), '#fff');
    assert.equal(safeColor(' #8E8D8A '), '#8E8D8A');
    assert.equal(safeColor('red; background:url(x)'), '#FFFFFF');
    assert.equal(safeColor('#12', '#000'), '#000');
    assert.equal(safeColor(undefined), '#FFFFFF');
  });

  it('isAccessory và partitionProducts phân loại đúng cả dữ liệu cũ lẫn dữ liệu Supabase', () => {
    assert.equal(isAccessory({ kind: 'accessory' }), true);
    assert.equal(isAccessory({ category: 'case' }), true);
    assert.equal(isAccessory({ kind: 'phone', category: 'case' }), false);
    assert.equal(isAccessory({ kind: 'phone' }), false);
    assert.equal(isAccessory(null), false);

    const { phones, accessories } = partitionProducts([
      { id: 'a', kind: 'phone' },
      { id: 'b', category: 'case' },
      null,
      { id: 'c' }
    ]);
    assert.deepEqual(phones.map(p => p.id), ['a', 'c']);
    assert.deepEqual(accessories.map(p => p.id), ['b']);
    assert.deepEqual(partitionProducts(undefined), { phones: [], accessories: [] });
  });

  it('discountPercent trả 0 khi dữ liệu không hợp lệ', () => {
    assert.equal(discountPercent(90, 100), 10);
    assert.equal(discountPercent(100, 100), 0);
    assert.equal(discountPercent(120, 100), 0);
    assert.equal(discountPercent(50, 0), 0);
    assert.equal(discountPercent(50, undefined), 0);
    assert.equal(discountPercent(-5, 100), 0);
    assert.equal(discountPercent('abc', 100), 0);
  });
});
