import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseUsedRows, usedGroup, planUsedProducts, planNewProducts, parseSheetDate, slugify, productNameFor, parseCsv, parseVnd, parsePercent, normalizeKey, parseSheetRows } from '../../Frontend/admin/sheetPricing.js';

const csv = [
  'TIEN MOBILE - BẢNG BÁO GIÁ,,,,,,',
  'STT,Hãng,Mẫu Sản Phẩm,Phiên Bản / Bộ Nhớ,Giá Bán,Sale (%),Giá Sau Sale',
  '1,Apple,iPhone 15,128GB,"17.490.000 ₫",6%,"16.440.600 ₫"',
  '2,Apple,iPhone 15,256GB,"20.190.000 ₫",8%,"18.574.800 ₫"',
  '3,Samsung,Galaxy S24 Ultra,256GB,"29.990.000 ₫",0%,"29.990.000 ₫"',
  '4,Xiaomi,Xiaomi 14,256GB,"18.290.000 ₫",8%,"16.826.800 ₫"',
  '5,Vivo,Lỗi,128GB,abc,5%,xyz'
].join('\n');

describe('sheetPricing - đọc dữ liệu', () => {
  it('parseCsv xử lý ngoặc kép, dấu phẩy và CRLF', () => {
    assert.deepEqual(parseCsv('a,"b,c",d\r\n"x ""y""",,z'), [['a', 'b,c', 'd'], ['x "y"', '', 'z']]);
  });
  it('parseVnd / parsePercent', () => {
    assert.equal(parseVnd('40.500.000 ₫'), 40500000);
    assert.ok(Number.isNaN(parseVnd('abc')));
    assert.equal(parsePercent('7,3%'), 7.3);
    assert.equal(parsePercent(''), 0);
  });
  it('normalizeKey bỏ hãng, 5G và dấu', () => {
    assert.equal(normalizeKey('Samsung Galaxy S24 Ultra 256GB'), normalizeKey('Galaxy S24 Ultra 256GB'));
    assert.equal(normalizeKey('Xiaomi 14 5G 256GB'), normalizeKey('Xiaomi 14 256GB'));
    assert.notEqual(normalizeKey('iPhone 15 128GB'), normalizeKey('iPhone 15 Pro 128GB'));
  });
  it('parseSheetRows lấy dòng hợp lệ và báo dòng lỗi', () => {
    const { rows, errors } = parseSheetRows(csv);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].finalPrice, 16440600);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Dòng 7/);
    assert.equal(parseSheetRows('x,y').errors.length, 1);
  });
});

describe('sheetPricing - CSV dạng gviz (tiêu đề ô gộp bị mất)', () => {
  it('dùng vị trí cột cố định khi dòng tiêu đề thiếu', () => {
    const gviz = [
      '"TIEN MOBILE - BẢNG BÁO GIÁ","","","","","","","","","","",""',
      '"","Hãng","Mẫu Sản Phẩm","Phiên Bản / Bộ Nhớ","RAM","","","","","","","Trạng Thái"',
      '"1","Apple","iPhone 15","128GB","6GB","14.000.000 ₫","17.490.000 ₫","6%","16.440.600 ₫","2.440.600 ₫","8","Còn hàng"'
    ].join('\n');
    const { rows, errors } = parseSheetRows(gviz);
    assert.equal(errors.length, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].finalPrice, 16440600);
    assert.equal(rows[0].listPrice, 17490000);
    assert.equal(rows[0].salePercent, 6);
  });
});

describe('sheetPricing - sản phẩm mới', () => {
  const text = csv.replace('TIEN MOBILE - BẢNG BÁO GIÁ,,,,,,', 'TIEN MOBILE | Cập nhật ngày 25/10/2026,,,,,,');
  const { rows } = parseSheetRows(text);
  it('đọc ngày cập nhật', () => {
    assert.equal(parseSheetDate(text), '25/10/2026');
  });
  it('slug và tên hiển thị', () => {
    assert.equal(slugify('iPhone 16 Pro Max 256GB'), 'iphone-16-pro-max-256gb');
    assert.equal(slugify('Galaxy S24+ 256GB'), 'galaxy-s24-plus-256gb');
    assert.equal(productNameFor({ brand: 'Samsung', model: 'Galaxy S24 Ultra', storage: '256GB' }), 'Samsung Galaxy S24 Ultra 256GB');
    assert.equal(productNameFor({ brand: 'Xiaomi', model: 'Xiaomi 14', storage: '256GB' }), 'Xiaomi 14 256GB');
    assert.equal(productNameFor({ brand: 'Apple', model: 'iPhone 15', storage: '128GB' }), 'iPhone 15 128GB');
  });
  it('bỏ máy đã có, tạo máy mới ẩn, mã không trùng', () => {
    const plan = planNewProducts([{ id: 'ip15-pink', name: 'iPhone 15 128GB' }, { id: 'galaxy-s24-ultra-256gb', name: 'x' }], rows);
    assert.equal(plan.duplicates, 1);
    assert.equal(plan.items.length, 3);
    const p = plan.items.find(i => i.product.name.includes('256GB') && i.brand === 'Apple').product;
    assert.equal(p.is_visible, false);
    assert.equal(p.condition, 'new');
    assert.equal(p.price, 18574800);
    assert.equal(p.old_price, 20190000);
    assert.match(p.image_url, /iphone-15-finish-select/);
    assert.equal(planNewProducts([], rows, { visible: true }).items[0].product.is_visible, true);
    assert.equal(new Set(plan.items.map(i => i.product.id)).size, plan.items.length);
  });
});

describe('sheetPricing - máy cũ (2ND)', () => {
  const nd = [
    'TIEN MOBILE - BẢNG BÁO GIÁ CŨ,,,,,,,,,,,,,',
    '"","Hãng","Mẫu Sản Phẩm","Phiên Bản / Bộ Nhớ","RAM","Tình Trạng (Độ mới)","Mô Tả","","","","","","","Trạng Thái"',
    '1,Apple,iPhone 17 Pro Max,512GB,12GB,99% Like New,"Cam, bản VN/A, pin 94%","31.800.000 ₫","31.800.000 ₫",0%,"31.800.000 ₫","0 ₫",1,Còn hàng',
    '2,Apple,iPhone 17 Pro Max,512GB,12GB,99% Like New,"Cam, bản VN/A, pin 94%","31.000.000 ₫","31.000.000 ₫",0%,"31.000.000 ₫","0 ₫",1,Còn hàng',
    '3,Apple,Apple Watch Series 9,64GB,1GB,99% Like New,"45mm, Trắng","4.600.000 ₫","4.600.000 ₫",0%,"4.600.000 ₫","0 ₫",0,Hết hàng',
    '4,Apple,iPhone 16,128GB,8GB,98% Phẩy nhẹ,"Hồng, bản LL/A, pin 100%","14.600.000 ₫","14.600.000 ₫",0%,"14.600.000 ₫","0 ₫",1,Còn hàng'
  ].join('\n');
  const { rows } = parseUsedRows(nd);
  it('đọc 4 dòng, không đọc giá gốc', () => {
    assert.equal(rows.length, 4);
    assert.equal(rows[0].finalPrice, 31800000);
    assert.equal(rows[0].group, 'iPhone 17');
    assert.equal(rows[2].stock, 0);
  });
  it('nhóm hiển thị', () => {
    assert.equal(usedGroup('iPhone 12 Pro Max'), 'iPhone 12');
    assert.equal(usedGroup('iPhone XS Max'), 'iPhone XS');
    assert.equal(usedGroup('Apple Watch Series 9'), 'Apple Watch');
    assert.equal(usedGroup('iPad Air 11 M2 (Air 7)'), 'iPad');
  });
  it('mỗi máy một sản phẩm Like New, bỏ máy hết hàng, mã không trùng', () => {
    const plan = planUsedProducts([], rows);
    assert.equal(plan.items.length, 3);
    assert.equal(plan.soldOut, 1);
    const ids = plan.items.map(i => i.product.id);
    assert.equal(new Set(ids).size, 3);
    const p = plan.items[0].product;
    assert.equal(p.condition, 'like_new');
    assert.equal(p.stock, 1);
    assert.equal(p.is_visible, false);
    assert.equal(p.battery, 'Pin 94%');
    assert.equal(p.price, 31800000);
    assert.match(p.name, /iPhone 17 Pro Max 512GB - Cam - 99% Like New/);
  });
  it('bỏ qua máy đã có trên web (theo mã)', () => {
    const first = planUsedProducts([], rows);
    const again = planUsedProducts(first.items.map(i => ({ id: i.product.id })), rows);
    assert.equal(again.items.length, 0);
    assert.equal(again.duplicates, 3);
  });
});
