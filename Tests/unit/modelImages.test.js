import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { modelKey, modelOf, imageFor, MODEL_IMAGES } from '../../Frontend/admin/modelImages.js';
import { parseUsedRows, planUsedProducts, USED_IMAGE_NOTE } from '../../Frontend/admin/sheetPricing.js';

describe('modelImages', () => {
  it('modelOf lấy tên mẫu trước dung lượng', () => {
    assert.equal(modelOf('iPhone 16 Pro Max 256GB - Cam - 99% Like New'), 'iPhone 16 Pro Max');
    assert.equal(modelOf('Samsung Galaxy S24 Ultra 256GB'), 'Samsung Galaxy S24 Ultra');
    assert.equal(modelOf('iPad Air 11 M2 (Air 7) 128GB - Wifi'), 'iPad Air 11 M2 Air 7');
    assert.equal(modelOf('iPhone 18 Pro Max (Đỏ - VN/A) 256GB'), 'iPhone 18 Pro Max');
  });
  it('modelKey bỏ hãng, dấu và khoảng trắng', () => {
    assert.equal(modelKey('Apple Watch Series 9'), 'watchseries9');
    assert.equal(modelKey('iPhone 16 Pro Max'), 'iphone16promax');
  });
  it('chỉ ghép khi tên mẫu khớp chính xác', () => {
    assert.match(imageFor('iPhone 16 Pro Max 256GB'), /^https:\/\/store\.storeimages\.cdn-apple\.com\//);
    assert.notEqual(imageFor('iPhone 16 Pro 128GB'), imageFor('iPhone 16 Pro Max 256GB'));
    assert.notEqual(imageFor('iPhone 16 Plus 128GB'), imageFor('iPhone 16 128GB'));
    assert.equal(imageFor('iPhone 12 Pro Max 256GB'), '');
    assert.equal(imageFor('iPhone 17 Air 256GB'), '');
    assert.equal(imageFor('Galaxy S24 Ultra 256GB'), '');
    assert.equal(imageFor(''), '');
  });
  it('mọi ảnh trong bảng là https', () => {
    for (const url of Object.values(MODEL_IMAGES)) assert.match(url, /^https:\/\//);
  });
  it('máy cũ có ảnh minh họa thì thêm ghi chú vào mô tả, không có ảnh thì không', () => {
    const nd = [
      '"","Hãng","Mẫu Sản Phẩm","Phiên Bản / Bộ Nhớ","RAM","Tình Trạng","Mô Tả"',
      '1,Apple,iPhone 16 Pro Max,256GB,8GB,99% Like New,"Vàng, bản VN/A, pin 90%","1 ₫","1 ₫",0%,"23.500.000 ₫","0 ₫",1,Còn hàng',
      '2,Apple,iPhone 17 Air,256GB,8GB,99% Like New,"Xanh, bản VN/A, pin 100%","1 ₫","1 ₫",0%,"19.000.000 ₫","0 ₫",1,Còn hàng'
    ].join('\n');
    const plan = planUsedProducts([], parseUsedRows(nd).rows);
    assert.ok(plan.items[0].product.image_url);
    assert.ok(plan.items[0].product.description.includes(USED_IMAGE_NOTE));
    assert.equal(plan.items[1].product.image_url, '');
    assert.ok(!plan.items[1].product.description.includes(USED_IMAGE_NOTE));
  });
});
