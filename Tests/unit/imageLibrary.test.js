import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_SOURCES } from '../../Frontend/admin/modelImages.js';
import { libraryFileName, libraryKeyOf, buildLibraryMap, planImageLinks, productKey } from '../../Frontend/admin/imageLibrary.js';

const SRC = { 'iphone12promax-vang': 'https://cdn.tgdd.vn/a.jpg', 'iphone15-hong': 'https://apple/15.png' };

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
    assert.equal(productKey('iPhone 12 Pro Max 256GB - Vàng - 98% Phẩy nhẹ'), 'iphone12promax-vang');
    assert.equal(productKey('iPhone XS Max 256GB - Đen'), '');
    assert.equal(productKey('iPhone 18 Pro Max 256GB', 'Đỏ'), 'iphone18promax-do');
  });
  it('máy chưa có ảnh: lấy từ kho nếu có, không thì tải từ nguồn vào kho', () => {
    const library = new Map([['iphone15-hong', 'https://s/model-iphone15-hong.png']]);
    const plan = planImageLinks([
      { id: 'a', name: 'iPhone 15 128GB - Hồng', image: '' },
      { id: 'b', name: 'iPhone 12 Pro Max 256GB - Vàng', image: '' },
      { id: 'c', name: 'iPhone 11 128GB', image: '' },
      { id: 'd', name: 'iPhone XS Max 256GB - Đen', image: '' }
    ], library, { sources: SRC });
    assert.deepEqual(plan.items.map(i => [i.id, i.source]), [['a', 'kho'], ['b', 'upload']]);
    assert.deepEqual(plan.uploads, [{ key: 'iphone12promax-vang', url: 'https://cdn.tgdd.vn/a.jpg' }]);
    assert.deepEqual(plan.missing, ['iPhone 11', 'iPhone XS Max']);
  });
  it('ảnh sai màu (ảnh mặc định của mẫu) bị thay hoặc gỡ khi không có ảnh đúng màu', () => {
    const wrong = 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone-14-pro-finish-select-202209-6-7inch-deeppurple?wid=800&hei=800&fmt=png-alpha';
    const plan = planImageLinks([
      { id: 'a', name: 'iPhone 14 Pro Max 128GB - Đen', image: wrong },
      { id: 'b', name: 'iPhone XS Max 256GB - Đen', image: IMAGE_SOURCES['iphonexsmax-vang'] }
    ], new Map());
    assert.deepEqual(plan.items.map(i => [i.id, i.source]), [['a', 'upload'], ['b', 'clear']]);
    assert.match(plan.items[0].image, /spaceblack/);
  });
  it('chuyển link ngoài mặc định vào kho, giữ ảnh chụp riêng', () => {
    const library = new Map([['iphone15-hong', 'https://s/model-iphone15-hong.png']]);
    const products = [
      { id: 'a', name: 'iPhone 15 128GB - Hồng', image: IMAGE_SOURCES['iphone15-hong'] },
      { id: 'b', name: 'iPhone 15 256GB - Hồng', image: 'https://shop/anh-that-cua-shop.jpg' },
      { id: 'c', name: 'iPhone 15 512GB - Hồng', image: 'https://s/model-iphone15-hong.png' }
    ];
    const plan = planImageLinks(products, library);
    assert.deepEqual(plan.items.map(i => i.id), ['a']);
    assert.equal(plan.keep, 2);
    assert.equal(planImageLinks(products, library, { replaceExternal: false }).items.length, 0);
  });
});
