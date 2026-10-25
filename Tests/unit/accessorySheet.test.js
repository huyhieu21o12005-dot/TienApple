import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryFor, parseAccessoryRows, planAccessories, accessoryNameFor } from '../../Frontend/admin/accessorySheet.js';

const CSV = [
  'Mã SP,Nhóm,Hãng,Tên Phụ Kiện,Phân Loại / Màu,Giá Bán,Sale (%),Giá Sau Sale,Tồn Kho,Trạng Thái,Hiển Thị Web,Bảo Hành,Link Ảnh,Ghi Chú',
  'PK-001,Củ sạc & Cáp,Apple,Củ sạc nhanh 20W,Trắng,"450.000 ₫",10%,"405.000 ₫",5,Còn hàng,Hiện,12 Tháng,https://example.com/a.jpg,Chính hãng',
  'PK-002,Tai nghe,Apple,AirPods Pro 2,,"5.490.000 ₫",0%,"5.490.000 ₫",2,Còn hàng,Hiện,12 Tháng,,',
  ',Ốp lưng & Cường lực,,Ốp lưng silicon iPhone 15,Đen,"250.000 ₫",,,0,Hết hàng,Không,,,',
  ',Khác,,Dòng không giá,,,,,,,,,,'
].join('\n');

test('categoryFor gom nhóm về thẻ lọc của web', () => {
  assert.equal(categoryFor('Củ sạc & Cáp'), 'charger');
  assert.equal(categoryFor('Tai nghe AirPods'), 'audio');
  assert.equal(categoryFor('Ốp lưng & Cường lực'), 'case');
  assert.equal(categoryFor('Giá đỡ'), 'other');
});

test('parseAccessoryRows đọc theo tên cột, bỏ dòng không giá', () => {
  const { rows, errors } = parseAccessoryRows(CSV);
  assert.equal(rows.length, 3);
  assert.equal(errors.length, 1);
  assert.equal(rows[0].finalPrice, 405000);
  assert.equal(rows[0].salePercent, 10);
  assert.equal(rows[0].image, 'https://example.com/a.jpg');
  assert.equal(rows[2].finalPrice, 250000);
  assert.equal(rows[2].show, false);
  assert.equal(rows[2].stock, 0);
});

test('thiếu dòng tiêu đề thì báo lỗi', () => {
  assert.ok(parseAccessoryRows('a,b\n1,2').errors.length > 0);
});

test('planAccessories: thêm mới, bỏ dòng ẩn, nhận diện đã có và đổi giá giữ phần cộng thêm', () => {
  const { rows } = parseAccessoryRows(CSV);
  const plan = planAccessories([], rows);
  assert.equal(plan.items.length, 2);
  assert.equal(plan.hiddenInSheet, 1);
  const first = plan.items[0].product;
  assert.equal(first.id, 'pk-001');
  assert.equal(first.kind, 'accessory');
  assert.equal(first.category, 'charger');
  assert.equal(first.price, 405000);
  assert.equal(first.old_price, 450000);
  assert.equal(first.is_visible, false);
  assert.equal(first.base_price, 405000);

  const existing = [{ id: 'pk-001', name: 'x', kind: 'accessory', price: 455000, basePrice: 405000, oldPrice: 450000 }, { id: 'pk-002', name: 'y', kind: 'accessory', price: 5000000, basePrice: 5000000 }];
  const again = planAccessories(existing, rows);
  assert.equal(again.items.length, 0);
  assert.equal(again.changes.length, 1);
  assert.equal(again.changes[0].id, 'pk-002');
  assert.equal(again.changes[0].newPrice, 5490000);
  assert.equal(again.changes[0].markup, 0);
});

test('accessoryNameFor thêm hãng và phân loại', () => {
  assert.equal(accessoryNameFor({ brand: 'Apple', name: 'Củ sạc 20W', variant: 'Trắng' }), 'Apple Củ sạc 20W - Trắng');
  assert.equal(accessoryNameFor({ brand: 'Apple', name: 'Apple AirPods', variant: '' }), 'Apple AirPods');
});
