import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSheetRows, parseUsedRows, usedBaseId } from '../../Frontend/admin/sheetPricing.js';
import { parseAccessoryRows } from '../../Frontend/admin/accessorySheet.js';
import { planSync, diffProduct } from '../../Frontend/admin/syncPlan.js';

const NEW_CSV = [
  'Mã SP,Hãng,Mẫu Sản Phẩm,Phiên Bản / Bộ Nhớ,RAM,Giá Bán,Sale (%),Giá Sau Sale,Tồn Kho,Trạng Thái,Hiển Thị Web,Bảo Hành,Ghi Chú',
  'IPK-001,Apple,iPhone 17 Pro Max,256GB,12GB,"31.800.000 ₫",0%,"31.800.000 ₫",1,Còn hàng,Hiện,12 Tháng,Cam - VN/A - New',
  'IPK-002,Apple,iPhone 17 Pro Max,256GB,12GB,"32.500.000 ₫",0%,"32.500.000 ₫",2,Còn hàng,Hiện,12 Tháng,Xanh - VN/A - New',
  'IPK-003,Apple,iPhone 17 Pro,256GB,12GB,"31.300.000 ₫",0%,"31.300.000 ₫",0,Hết hàng,Hiện,12 Tháng,Trắng - VN/A'
].join('\n');

// cột dùng vị trí cố định như tab 2ND thật: STT, Hãng, Mẫu, Bộ nhớ, RAM, Tình trạng, Mô tả, ., Giá gốc, Sale, Giá sau, ., Tồn, Trạng thái
const usedLine = (n, model, storage, desc, price, stock = '1', status = 'Còn hàng') =>
  `"${n}","Apple","${model}","${storage}","8GB","99% Like New","${desc}","${price}","${price}","0%","${price}","0 ₫","${stock}","${status}"`;
const USED_CSV = (lines) => ['"","Hãng","Mẫu Sản Phẩm","Phiên Bản / Bộ Nhớ","RAM","Tình Trạng (Độ mới)","Mô Tả","","","","","","","Trạng Thái"', ...lines].join('\n');

const used = (...lines) => parseUsedRows(USED_CSV(lines)).rows;

test('usedBaseId bỏ pin để cập nhật hằng ngày không thành máy mới', () => {
  assert.equal(usedBaseId('iPhone 16 Pro', '128GB', 'Vàng, bản KH/A, pin 91%'), usedBaseId('iPhone 16 Pro', '128GB', 'Vàng, bản KH/A, pin 90%'));
  assert.notEqual(usedBaseId('iPhone 16 Pro', '128GB', 'Vàng, bản KH/A'), usedBaseId('iPhone 16 Pro', '128GB', 'Đen, bản KH/A'));
});

test('máy cũ giống hệt nhau trong sheet có mã -2 ổn định', () => {
  const rows = used(
    usedLine(1, 'iPhone 15', '128GB', 'Hồng, bản VN/A, pin 90%', '11.000.000 ₫'),
    usedLine(2, 'iPhone 15', '128GB', 'Hồng, bản VN/A, pin 88%', '10.900.000 ₫')
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[1].id, `${rows[0].id}-2`);
});

test('đồng bộ lần đầu: thêm mới, hàng cùng mẫu khác màu có tên khác nhau', () => {
  const { rows } = parseSheetRows(NEW_CSV);
  const plan = planSync([], { newRows: rows });
  assert.equal(plan.summary.addNew, 3);
  const names = plan.items.map(i => i.name);
  assert.equal(new Set(names).size, 3);
  assert.ok(names.some(n => /Cam/.test(n)));
  assert.ok(plan.items.every(i => i.product.is_visible === false));
  assert.deepEqual(plan.items.map(i => i.id), ['ipk-001', 'ipk-002', 'ipk-003']);
});

test('đồng bộ lần hai: đổi giá giữ phần cộng thêm, tồn kho, hết hàng', () => {
  const { rows } = parseSheetRows(NEW_CSV);
  const existing = [
    { id: 'ipk-001', name: 'iPhone 17 Pro Max 256GB - Cam', kind: 'phone', condition: 'new', price: 32300000, basePrice: 31800000, stock: 1, is_visible: true },
    { id: 'ipk-002', name: 'x', kind: 'phone', condition: 'new', price: 33000000, basePrice: 33000000, stock: 2, is_visible: true },
    { id: 'ipk-003', name: 'y', kind: 'phone', condition: 'new', price: 31300000, basePrice: 31300000, stock: 4, is_visible: true }
  ];
  const plan = planSync(existing, { newRows: rows });
  assert.equal(plan.summary.same, 1);
  const byId = Object.fromEntries(plan.items.map(i => [i.id, i]));
  assert.equal(byId['ipk-002'].patch.base_price, 32500000);
  assert.equal(byId['ipk-002'].patch.price, 32500000);
  assert.equal(byId['ipk-003'].patch.stock, 0);
  assert.equal(byId['ipk-001'], undefined);
  const keep = diffProduct({ id: 'a', price: 32300000, basePrice: 31800000, stock: 1 }, { finalPrice: 31000000, listPrice: 31000000, salePercent: 0, stock: 1 }, 'new');
  assert.equal(keep.patch.price, 31500000);
  assert.equal(keep.patch.base_price, 31000000);
});

test('máy cũ: đổi giá, bán hết (tồn 0), biến mất khỏi sheet', () => {
  const day1 = used(
    usedLine(1, 'iPhone 16 Pro', '128GB', 'Vàng, bản KH/A, pin 91%', '19.200.000 ₫'),
    usedLine(2, 'iPhone 16 Pro', '128GB', 'Trắng, bản VN/A, pin 90%', '18.700.000 ₫'),
    usedLine(3, 'iPhone 14', '128GB', 'Đen, bản VN/A, pin 91%', '8.100.000 ₫')
  );
  const first = planSync([], { usedRows: day1 }, { visible: true });
  assert.equal(first.summary.addUsed, 3);
  const existing = first.items.map(i => ({ ...i.product, kind: 'phone', condition: 'likenew', oldPrice: undefined, basePrice: i.product.base_price }));

  const day2 = used(
    usedLine(1, 'iPhone 16 Pro', '128GB', 'Vàng, bản KH/A, pin 90%', '19.000.000 ₫'),
    usedLine(2, 'iPhone 16 Pro', '128GB', 'Trắng, bản VN/A, pin 90%', '18.700.000 ₫', '0', 'Hết hàng')
  );
  const second = planSync(existing, { usedRows: day2 });
  assert.equal(second.summary.addUsed, 0);
  const byName = Object.fromEntries(second.items.map(i => [i.action + ':' + i.id, i]));
  const upd = second.items.find(i => i.action === 'update' && i.patch.base_price === 19000000);
  assert.ok(upd, 'đổi giá máy 1 dù pin đổi');
  const sold = second.items.find(i => i.action === 'update' && i.patch.stock === 0);
  assert.equal(sold.patch.is_visible, false);
  const gone = second.items.find(i => i.action === 'retire');
  assert.equal(gone.patch.stock, 0);
  assert.equal(gone.patch.is_visible, false);
  assert.equal(Object.keys(byName).length, 3);
});

test('giá lệch quá 30% không tự chọn; cảnh báo mã trùng và thiếu mã', () => {
  const dup = NEW_CSV + '\nIPK-001,Apple,iPhone 17 Pro Max,512GB,12GB,"40.000.000 ₫",0%,"40.000.000 ₫",1,Còn hàng,Hiện,12 Tháng,Đen';
  const plan = planSync([{ id: 'ipk-002', name: 'x', kind: 'phone', condition: 'new', price: 10000000, basePrice: 10000000, stock: 2, is_visible: true }], { newRows: parseSheetRows(dup).rows });
  assert.ok(plan.warnings.some(w => /IPK-001/.test(w)));
  const big = plan.items.find(i => i.id === 'ipk-002');
  assert.equal(big.warn, true);
  assert.equal(big.checked, false);
});

test('phụ kiện: thêm mới và cập nhật theo sheet', () => {
  const csv = 'Mã SP,Nhóm,Hãng,Tên Phụ Kiện,Phân Loại / Màu,Giá Bán,Sale (%),Giá Sau Sale,Tồn Kho,Trạng Thái,Hiển Thị Web,Bảo Hành,Link Ảnh,Ghi Chú\nPK-1,Củ sạc & Cáp,Apple,Củ sạc 20W,Trắng,"450.000 ₫",0%,"450.000 ₫",5,Còn hàng,Hiện,12 Tháng,,';
  const rows = parseAccessoryRows(csv).rows;
  const first = planSync([], { accRows: rows });
  assert.equal(first.summary.addAcc, 1);
  const existing = [{ ...first.items[0].product, kind: 'accessory', basePrice: 450000, oldPrice: undefined }];
  const changed = parseAccessoryRows(csv.replace('"450.000 ₫",0%,"450.000 ₫",5', '"500.000 ₫",0%,"500.000 ₫",0')).rows;
  const second = planSync(existing, { accRows: changed });
  assert.equal(second.items[0].action, 'update');
  assert.equal(second.items[0].patch.price, 500000);
  assert.equal(second.items[0].patch.stock, 0);
});
