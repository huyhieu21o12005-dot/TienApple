import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv, parseVnd, parsePercent, normalizeKey, parseSheetDate, parseSheetRows,
  slugify, productNameFor, planNewProducts, parseUsedRows, usedGroup, planUsedProducts } from '../../Frontend/admin/sheetPricing.js';
import { planSync, diffProduct } from '../../Frontend/admin/syncPlan.js';

describe('parseCsv', () => {
  it('bỏ BOM, đọc ô có dấu ngoặc kép, nháy kép đôi và xuống dòng trong ô', () => {
    const t = parseCsv('﻿a,"b ""q"" c","d\ne"\n1,2,3');
    assert.deepEqual(t, [['a', 'b "q" c', 'd\ne'], ['1', '2', '3']]);
  });
  it('xử lý CRLF, CR đơn, dòng cuối không xuống dòng và đầu vào rỗng', () => {
    assert.deepEqual(parseCsv('a,b\r\nc,d\re,f'), [['a', 'b'], ['c', 'd'], ['e', 'f']]);
    assert.deepEqual(parseCsv(null), []);
    assert.deepEqual(parseCsv('x,'), [['x', '']]);
  });
});

describe('parseVnd / parsePercent / normalizeKey / parseSheetDate', () => {
  it('parseVnd: số tiền hợp lệ và không hợp lệ', () => {
    assert.equal(parseVnd('40.500.000 ₫'), 40500000);
    assert.ok(Number.isNaN(parseVnd(null)));
    assert.ok(Number.isNaN(parseVnd('abc')));
  });
  it('parsePercent: dấu phẩy, rỗng, sai', () => {
    assert.equal(parsePercent('7,3%'), 7.3);
    assert.equal(parsePercent(''), 0);
    assert.equal(parsePercent(null), 0);
    assert.ok(Number.isNaN(parsePercent('x%')));
  });
  it('normalizeKey bỏ dấu, hãng, 5G; rỗng thành chuỗi rỗng', () => {
    assert.equal(normalizeKey('Samsung Galaxy S24 5G'), 'galaxys24');
    assert.equal(normalizeKey('Đen Mờ'), 'denmo');
    assert.equal(normalizeKey(null), '');
  });
  it('parseSheetDate lấy ngày cập nhật hoặc rỗng', () => {
    assert.equal(parseSheetDate('x, Cập nhật ngày 25/10/2026 y'), '25/10/2026');
    assert.equal(parseSheetDate('không có'), '');
    assert.equal(parseSheetDate(null), '');
  });
});

const HEADER = 'Mã SP,Hãng,Mẫu Sản Phẩm,Phiên Bản / Bộ Nhớ,RAM,Giá Bán,Sale (%),Giá Sau Sale,Tồn Kho,Trạng Thái,Hiển Thị Web,Bảo Hành,Ghi Chú';

describe('parseSheetRows', () => {
  it('báo thiếu cột bắt buộc', () => {
    const r = parseSheetRows('Mẫu Sản Phẩm,Giá Sau Sale\niPhone 15,1000');
    assert.equal(r.rows.length, 0);
    assert.match(r.errors.join(' '), /Thiếu cột/);
  });
  it('không thấy dòng tiêu đề thì báo lỗi', () => {
    assert.match(parseSheetRows('a,b\n1,2').errors[0], /Không tìm thấy dòng tiêu đề/);
  });
  it('đọc theo vị trí cột cố định khi tiêu đề bị gviz làm hỏng', () => {
    const csv = [',,Mẫu Sản Phẩm,Phiên Bản / Bộ Nhớ,RAM,,Giá Bán,Sale (%),,,Tồn,Trạng Thái', ',Apple,iPhone 15,128GB,6GB,,"20.000.000",10%,"18.000.000",,3,Còn hàng'].join('\n');
    const { rows, errors } = parseSheetRows(csv);
    assert.deepEqual(errors, []);
    assert.equal(rows[0].finalPrice, 18000000);
    assert.equal(rows[0].stock, 3);
    assert.equal(rows[0].code, '');
    assert.equal(rows[0].show, true);
  });
  it('bỏ dòng không có mẫu, báo giá sai, dùng giá bán khi giá gốc hỏng, "Không" thì ẩn, hết hàng thì tồn 0', () => {
    const csv = [
      HEADER,
      'A1,Apple,,128GB,6GB,"1.000",0%,"1.000",1,Còn hàng,Hiện,,',
      'A2,Apple,iPhone 1,128GB,6GB,"1.000",0%,"abc",1,Còn hàng,Hiện,,',
      'A3,Apple,iPhone 2,128GB,6GB,"zz",x%,"2.000.000",abc,Còn hàng,Không,12T,ghi chú',
      'A4,Apple,iPhone 3,128GB,6GB,"3.000.000",0%,"3.000.000",5,Hết hàng,Hiện,,'
    ].join('\n');
    const { rows, errors } = parseSheetRows(csv);
    assert.equal(errors.length, 1);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].listPrice, rows[0].finalPrice);
    assert.equal(rows[0].salePercent, 0);
    assert.equal(rows[0].show, false);
    assert.equal(rows[0].stock, 0);
    assert.equal(rows[1].stock, 0);
  });
});

describe('tên và mã', () => {
  it('slugify xử lý dấu cộng và rỗng', () => {
    assert.equal(slugify('iPhone 15 Pro+ Đen'), 'iphone-15-pro-plus-den');
    assert.equal(slugify(null), '');
  });
  it('productNameFor: ghép hãng khi mẫu chưa có hãng', () => {
    assert.equal(productNameFor({ brand: 'Samsung', model: 'Galaxy S24', storage: '256GB' }), 'Samsung Galaxy S24 256GB');
    assert.equal(productNameFor({ brand: 'Apple', model: 'iPhone 15', storage: '' }), 'iPhone 15');
    assert.equal(productNameFor({ brand: 'Xiaomi', model: 'Xiaomi 14', storage: '256GB' }), 'Xiaomi 14 256GB');
  });
});

const newRow = (o) => ({ line: 2, brand: 'Apple', model: 'iPhone 15', storage: '128GB', ram: '6GB', code: '', show: true, warranty: '12T', note: '', stock: 2, listPrice: 1000, salePercent: 0, finalPrice: 1000, key: normalizeKey(`${o.model || 'iPhone 15'} ${o.storage || '128GB'}`), ...o });

describe('planNewProducts', () => {
  it('đầu vào không phải mảng thì không thêm gì', () => {
    assert.equal(planNewProducts(null, null).items.length, 0);
  });
  it('bỏ không phải điện thoại, bỏ dòng ẩn trong sheet, bỏ trùng theo mã và theo tên', () => {
    const rows = [
      newRow({ model: 'Apple Watch S9', key: 'watch' }),
      newRow({ model: 'iPhone 14', key: 'iphone14128gb', show: false }),
      newRow({ code: 'DA-1', model: 'iPhone 13', key: 'k13' }),
      newRow({ model: 'iPhone 12', key: 'iphone12128gb' })
    ];
    const out = planNewProducts([{ id: 'da-1', name: 'x' }, { id: 'z', name: 'iPhone 12 128GB' }], rows);
    assert.equal(out.notPhone, 1);
    assert.equal(out.hiddenInSheet, 1);
    assert.equal(out.duplicates, 2);
    assert.equal(out.items.length, 0);
  });
  it('cùng mẫu khác màu thì thêm màu vào tên, đụng mã thì thêm đuôi số, có giá gạch ngang khi sale', () => {
    const rows = [
      newRow({ note: 'Cam - VN/A', salePercent: 10, listPrice: 1200, finalPrice: 1000 }),
      newRow({ note: 'Xanh - VN/A', code: 'C2' })
    ];
    const out = planNewProducts([{ id: 'iphone-15-128gb-cam', name: 'khác' }], rows, { visible: true });
    assert.equal(out.items.length, 2);
    assert.match(out.items[0].product.name, /- Cam$/);
    assert.equal(out.items[0].product.id, 'iphone-15-128gb-cam-2');
    assert.equal(out.items[0].product.old_price, 1200);
    assert.equal(out.items[1].product.old_price, null);
    assert.equal(out.items[0].product.is_visible, true);
    assert.equal(out.items[0].product.default_color, 'Cam');
  });
  it('hãng khác có tên thương hiệu riêng, không có bộ nhớ thì storages rỗng', () => {
    const out = planNewProducts([], [newRow({ brand: 'Samsung', model: 'Galaxy S24', storage: '', ram: '--', key: 'galaxys24', warranty: '' })]);
    assert.equal(out.items[0].product.storages.length, 0);
    assert.equal(out.items[0].product.brand, 'samsung');
    assert.doesNotMatch(out.items[0].product.description, /RAM/);
  });
});

const usedLine = (n, model, storage, desc, price, stock = '1', status = 'Còn hàng', brand = 'Apple') =>
  `"${n}","${brand}","${model}","${storage}","8GB","99% Like New","${desc}","${price}","${price}","0%","${price}","0 ₫","${stock}","${status}"`;

describe('máy cũ', () => {
  it('parseUsedRows bỏ dòng không có STT, báo giá sai, mặc định hãng Apple', () => {
    const csv = ['"","Hãng"', usedLine('x', 'iPhone 1', '64GB', 'Đen', '1.000'), usedLine(1, 'iPhone 2', '64GB', 'Đen', 'abc'), usedLine(2, 'iPhone 3', '', 'Đen, pin 90%', '5.000.000', '2', 'Còn hàng', '')].join('\n');
    const { rows, errors } = parseUsedRows(csv);
    assert.equal(errors.length, 1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].brand, 'Apple');
  });
  it('usedGroup nhận ra iPhone, Watch, iPad và mẫu khác', () => {
    assert.equal(usedGroup('iPhone 17  Pro Max'), 'iPhone 17');
    assert.equal(usedGroup('iPhone XS Max'), 'iPhone XS');
    assert.equal(usedGroup('Apple Watch Series 9'), 'Apple Watch');
    assert.equal(usedGroup('iPad Pro 9.7 inch'), 'iPad');
    assert.equal(usedGroup('Galaxy S24 Ultra'), 'Galaxy S24');
    assert.equal(usedGroup(null), '');
  });
  it('planUsedProducts: trùng, hết hàng, phân loại iPad/Watch/khác, đọc pin', () => {
    const mk = (id, model, desc, stock = 1) => ({ id, line: 2, brand: 'x', model, storage: '64GB', ram: '--', condition: '99%', description: desc, listPrice: 5, salePercent: 0, finalPrice: 5, stock, group: 'g' });
    const rows = [mk('a', 'iPhone 11', 'Đen, pin 91%'), mk('b', 'iPad Pro', 'Xám'), mk('c', 'Apple Watch S6', 'Đỏ'), mk('d', 'AirPods', 'Trắng'), mk('e', 'iPhone 8', 'Vàng', 0), mk('dup', 'iPhone 7', 'x')];
    const out = planUsedProducts([{ id: 'dup' }], rows, { visible: true });
    assert.equal(out.duplicates, 1);
    assert.equal(out.soldOut, 1);
    const by = Object.fromEntries(out.items.map(i => [i.product.id, i.product]));
    assert.equal(by.a.kind, 'phone');
    assert.equal(by.a.battery, 'Pin 91%');
    assert.equal(by.b.category, 'tablet');
    assert.equal(by.c.category, 'watch');
    assert.equal(by.d.category, 'other');
    assert.equal(by.a.is_visible, true);
    assert.equal(planUsedProducts(null, null).items.length, 0);
  });
});

describe('diffProduct và planSync: nhánh còn lại', () => {
  const row = (o) => ({ finalPrice: 100, listPrice: 100, salePercent: 0, stock: 1, show: true, ...o });
  it('sản phẩm chưa có giá gốc: dùng giá bán, gạch ngang theo sheet (hàng mới), hết hàng', () => {
    const d = diffProduct({ price: 90, stock: undefined }, row({ finalPrice: 100, listPrice: 130, salePercent: 10, stock: 0 }), 'new');
    assert.equal(d.patch.base_price, 100);
    assert.equal(d.patch.old_price, 130);
    assert.equal(d.patch.stock, undefined);
    assert.equal(d.lines.length, 1);
  });
  it('máy cũ không có giá gạch ngang, hết hàng thì ẩn', () => {
    const d = diffProduct({ price: 100, basePrice: 100, stock: 2, is_visible: true }, row({ stock: 0, listPrice: 200, salePercent: 5 }), 'used');
    assert.equal(d.patch.old_price, undefined);
    assert.equal(d.patch.stock, 0);
    assert.equal(d.patch.is_visible, false);
    assert.ok(d.lines.some(l => /Hết hàng/.test(l)));
  });
  it('giá không đổi nhưng giá gạch ngang đổi: thêm rồi bỏ', () => {
    const add = diffProduct({ price: 100, basePrice: 100, stock: 1, oldPrice: null }, row({ listPrice: 150, salePercent: 10 }), 'new');
    assert.equal(add.patch.old_price, 150);
    assert.match(add.lines[0], /Giá gạch ngang/);
    const drop = diffProduct({ price: 100, basePrice: 100, stock: 1, oldPrice: 150 }, row(), 'new');
    assert.equal(drop.patch.old_price, null);
    assert.match(drop.lines[0], /Bỏ giá gạch ngang/);
  });
  it('sheet đặt "Không" hiển thị thì ẩn khỏi web', () => {
    const d = diffProduct({ price: 100, basePrice: 100, stock: 1, is_visible: true }, row({ show: false }), 'new');
    assert.equal(d.patch.is_visible, false);
  });
  it('đổi giá lớn được đánh dấu cảnh báo và không tick sẵn', () => {
    const plan = planSync([{ id: 'p', name: 'n', kind: 'phone', condition: 'new', price: 100, basePrice: 100, stock: 1 }], { newRows: [newRow({ code: 'P', finalPrice: 500, listPrice: 500 })] });
    assert.equal(plan.items[0].warn, true);
    assert.equal(plan.items[0].checked, false);
  });
  it('cảnh báo mã trùng và dòng chưa có mã; khớp theo tên khi không có mã; đầu vào lạ', () => {
    const rows = [newRow({ code: 'X' }), newRow({ code: 'X' }), newRow({ model: 'iPhone 11', key: normalizeKey('iPhone 11 128GB') })];
    const existing = [{ id: 'k', name: 'iPhone 11 128GB', kind: 'phone', condition: 'new', price: 1, basePrice: 1, stock: 0 }];
    const plan = planSync(existing, { newRows: rows });
    assert.equal(plan.warnings.length, 2);
    assert.ok(plan.items.some(i => i.id === 'k' && i.action === 'update'));
    assert.deepEqual(planSync(null).items, []);
  });
  it('máy cũ không còn trong sheet bị ẩn, máy đã ẩn và hết hàng thì bỏ qua', () => {
    const existing = [
      { id: '2nd-a', name: 'a', stock: 1, is_visible: true },
      { id: '2nd-b', name: 'b', stock: 0, is_visible: false },
      { id: 'khac', name: 'c', stock: 1, is_visible: true }
    ];
    const plan = planSync(existing, { usedRows: [] });
    assert.equal(plan.summary.retire, 1);
    assert.equal(plan.items[0].id, '2nd-a');
  });
});
