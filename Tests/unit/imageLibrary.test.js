import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { libraryFileName, libraryKeyOf, buildLibraryMap, planImageLinks, productKey } from '../../Frontend/admin/imageLibrary.js';

const SRC = { iphone12promax: 'https://cdn.tgdd.vn/a.jpg', iphone15: 'https://apple/15.png' };

describe('imageLibrary', () => {
  it('tên file kho theo khóa mẫu', () => {
    assert.equal(libraryFileName('iphone12promax'), 'model-iphone12promax.png');
    assert.equal(libraryKeyOf('model-iphone12promax.png'), 'iphone12promax');
    assert.equal(libraryKeyOf('iphone-123.jpg'), '');
  });
  it('buildLibraryMap bỏ file không phải ảnh mẫu', () => {
    const map = buildLibraryMap([{ name: 'model-iphone15.png' }, { name: 'abc-123.jpg' }], (n) => `https://s/${n}`);
    assert.deepEqual([...map], [['iphone15', 'https://s/model-iphone15.png']]);
  });
  it('productKey bỏ dung lượng, màu, tình trạng', () => {
    assert.equal(productKey('iPhone 12 Pro Max 256GB - Vàng - 98% Phẩy nhẹ'), 'iphone12promax');
  });
  it('máy chưa có ảnh: lấy từ kho nếu có, không thì tải từ nguồn vào kho', () => {
    const library = new Map([['iphone15', 'https://s/model-iphone15.png']]);
    const plan = planImageLinks([
      { id: 'a', name: 'iPhone 15 128GB - Hồng', image: '' },
      { id: 'b', name: 'iPhone 12 Pro Max 256GB - Vàng', image: '' },
      { id: 'c', name: 'iPhone 11 128GB', image: '' }
    ], library, { sources: SRC });
    assert.deepEqual(plan.items.map(i => [i.id, i.source]), [['a', 'kho'], ['b', 'upload']]);
    assert.deepEqual(plan.uploads, [{ key: 'iphone12promax', url: 'https://cdn.tgdd.vn/a.jpg' }]);
    assert.deepEqual(plan.missing, ['iPhone 11']);
  });
  it('chuyển link ngoài mặc định vào kho, giữ ảnh chụp riêng', () => {
    const library = new Map([['iphone15', 'https://s/model-iphone15.png']]);
    const products = [
      { id: 'a', name: 'iPhone 15 128GB', image: 'https://apple/15.png' },
      { id: 'b', name: 'iPhone 15 256GB', image: 'https://shop/anh-that-cua-shop.jpg' },
      { id: 'c', name: 'iPhone 15 512GB', image: 'https://s/model-iphone15.png' }
    ];
    const plan = planImageLinks(products, library, { sources: SRC });
    assert.deepEqual(plan.items.map(i => i.id), ['a']);
    assert.equal(plan.keep, 2);
    assert.equal(planImageLinks(products, library, { sources: SRC, replaceExternal: false }).items.length, 0);
  });
});
