import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planNewProducts, brandsOf, parseSheetDate, slugify, productNameFor, parseCsv, parseVnd, parsePercent, normalizeKey, parseSheetRows, planPriceUpdates } from '../../Frontend/admin/sheetPricing.js';

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

describe('sheetPricing - planPriceUpdates', () => {
  const { rows } = parseSheetRows(csv);
  const products = [
    { id: 'a', name: 'iPhone 15 128GB', kind: 'phone', condition: 'new', price: 18990000, oldPrice: 21490000 },
    { id: 'b', name: 'Samsung Galaxy S24 Ultra 256GB', kind: 'phone', condition: 'new', price: 29990000, oldPrice: undefined },
    { id: 'c', name: 'Xiaomi 14 5G 256GB', kind: 'phone', condition: 'new', price: 30000000 },
    { id: 'd', name: 'iPhone 14 128GB Quốc Tế', kind: 'phone', condition: 'likenew', price: 13890000 },
    { id: 'e', name: 'Củ sạc 30W', kind: 'accessory', condition: 'new', price: 650000 },
    { id: 'f', name: 'OPPO Find X7 256GB', kind: 'phone', condition: 'new', price: 17290000 }
  ];
  const plan = planPriceUpdates(products, rows);
  it('chỉ xử lý điện thoại hàng mới; hàng cũ và phụ kiện bị bỏ qua', () => {
    assert.equal(plan.skipped, 2);
  });
  it('đổi giá theo giá sau sale và giá gạch ngang theo giá bán', () => {
    const a = plan.changes.find(c => c.id === 'a');
    assert.equal(a.newPrice, 16440600);
    assert.equal(a.newList, 17490000);
    assert.equal(a.bigChange, false);
  });
  it('không sale thì bỏ giá gạch ngang; giống giá cũ thì vào nhóm không đổi', () => {
    assert.equal(plan.same.length, 1);
    assert.equal(plan.same[0].id, 'b');
  });
  it('báo đổi giá lớn và sản phẩm không có trong sheet', () => {
    assert.equal(plan.changes.find(c => c.id === 'c').bigChange, true);
    assert.deepEqual(plan.unmatched.map(u => u.id), ['f']);
  });
});

describe('sheetPricing - sản phẩm mới', () => {
  const text = csv.replace('TIEN MOBILE - BẢNG BÁO GIÁ,,,,,,', 'TIEN MOBILE | Cập nhật ngày 25/10/2026,,,,,,');
  const { rows } = parseSheetRows(text);
  it('đọc ngày cập nhật và danh sách hãng', () => {
    assert.equal(parseSheetDate(text), '25/10/2026');
    assert.deepEqual(brandsOf(rows).map(b => b.brand), ['Apple', 'Samsung', 'Xiaomi']);
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
    assert.equal(p.image_url, '');
    assert.equal(planNewProducts([], rows, { visible: true }).items[0].product.is_visible, true);
    assert.equal(new Set(plan.items.map(i => i.product.id)).size, plan.items.length);
  });
});
