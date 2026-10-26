import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { foldText, queryTokens, matchesQuery } from '../../Frontend/js/searchMatch.js';
import { readFileSync } from 'node:fs';
import { ProductFilter } from '../../Frontend/js/store.js';

const p = (name, extra = {}) => ({ id: name, name, brandName: 'Apple iPhone', ...extra });
const i18 = p('iPhone 18 Pro Max 256GB - Đỏ');
const i17 = p('iPhone 17 Pro 128GB');
const i128 = p('iPhone 12 Pro 128GB');
const i118 = p('iPhone 11 64GB - 118% pin');
const all = [i18, i17, i128, i118];

describe('searchMatch: chuẩn hóa chữ', () => {
  it('bỏ dấu tiếng Việt, đ thành d, chữ thường', () => {
    assert.equal(foldText('Đỏ Sa Mạc'), 'do sa mac');
    assert.equal(foldText(null), '');
  });
  it('tách chữ và số dính nhau, đổi từ viết tắt', () => {
    assert.deepEqual(queryTokens('ip18'), ['iphone', '18']);
    assert.deepEqual(queryTokens('ip 18 pm'), ['iphone', '18', 'pro', 'max']);
    assert.deepEqual(queryTokens('17promax'), ['17', 'pro', 'max']);
    assert.deepEqual(queryTokens('  '), []);
  });
});

describe('searchMatch: tìm theo cách gọi tắt', () => {
  const find = (q) => all.filter(x => matchesQuery(x, q)).map(x => x.name);
  it('"18", "ip 18", "ip18", "iphone18" đều ra iPhone 18, không lẫn 128 hay 118', () => {
    for (const q of ['18', 'ip 18', 'ip18', 'iphone18', 'iPhone 18', 'I P 18'.replace('I P', 'ip')]) {
      assert.deepEqual(find(q), [i18.name], q);
    }
  });
  it('"17pm", "ip17 pro", "17 pro" ra đúng đời máy', () => {
    assert.deepEqual(find('17 pro'), [i17.name]);
    assert.deepEqual(find('ip17 pro'), [i17.name]);
    assert.deepEqual(find('18pm'), [i18.name]);
  });
  it('dung lượng gõ số: "256", "128 pro" khớp theo từng số nguyên', () => {
    assert.deepEqual(find('256'), [i18.name]);
    assert.deepEqual(find('128 pro'), [i17.name, i128.name]);
  });
  it('gõ không dấu vẫn ra tên có dấu; từ không có thì không ra', () => {
    assert.deepEqual(find('do'), [i18.name]);
    assert.deepEqual(find('samsung'), []);
  });
  it('ô trống thì khớp mọi sản phẩm; tìm cả trong chip và mô tả', () => {
    assert.equal(matchesQuery(i18, ''), true);
    assert.equal(matchesQuery(p('Máy A', { chip: 'A19 Pro' }), 'a19'), true);
    assert.equal(matchesQuery(p('Máy B', { description: 'pin mới thay' }), 'pin moi'), true);
  });
  it('ô tìm kiếm nhanh trên đầu trang dùng đúng luật này; danh mục không còn ô tìm riêng', () => {
    const app = readFileSync(new URL('../../Frontend/js/app.js', import.meta.url), 'utf8');
    assert.match(app, /matchesQuery\(p, input\.value\)/);
    assert.equal(ProductFilter.searchProducts, undefined);
  });
});

describe('ProductFilter: lọc theo dung lượng', () => {
  it('lấy danh sách dung lượng có thật, xếp tăng dần (GB trước TB)', () => {
    assert.deepEqual(ProductFilter.storageOptions([p('A 1TB'), p('B 128GB'), p('C 64 GB'), p('D 256GB'), p('E không ghi')]), ['64GB', '128GB', '256GB', '1TB']);
  });
  it('lọc theo dung lượng; "all" giữ nguyên', () => {
    assert.deepEqual(ProductFilter.filterByStorage(all, '128GB').map(x => x.name), [i17.name, i128.name]);
    assert.equal(ProductFilter.filterByStorage(all, 'all').length, 4);
  });
  it('activeFilterCount tính cả dung lượng', () => {
    assert.equal(ProductFilter.activeFilterCount({ storage: '256GB' }), 1);
    assert.equal(ProductFilter.activeFilterCount({ storage: 'all' }), 0);
  });
});
