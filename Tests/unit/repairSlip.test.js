import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHOP_INFO } from '../../Frontend/js/shopInfo.js';
import { slipRows, buildRepairSlip, repairSlipHtml } from '../../Frontend/js/repairSlip.js';
import { SHOP, buildInvoice, invoiceHtml, INVOICE_TYPES, INVOICE_TABLES } from '../../Frontend/admin/invoiceHelpers.js';
import { categoryForInvoice } from '../../Frontend/admin/cashflowHelpers.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const booking = { id: 'u1', code: 'SC1007', created_at: '2026-10-29T03:15:00Z', customer_name: 'Lê <i>Hoa</i>', phone: '0912345678', device: 'iPhone 14 Pro Max', service: 'Thay pin', note: 'Máy sập nguồn', status: 'done' };

describe('địa chỉ cửa hàng', () => {
  it('có sẵn địa chỉ và dùng chung cho web, hóa đơn, phiếu', () => {
    assert.equal(SHOP_INFO.address, '54A8 Ngô Chí Quốc, Tam Bình, Thủ Đức');
    assert.equal(SHOP.address, SHOP_INFO.address);
    assert.match(invoiceHtml(buildInvoice('order', { items: [] })), /54A8 Ngô Chí Quốc, Tam Bình, Thủ Đức/);
  });
  it('sửa SHOP khi in không làm đổi thông tin gốc', () => {
    const old = SHOP.name; SHOP.name = 'ABC';
    assert.notEqual(SHOP_INFO.name, 'ABC');
    SHOP.name = old;
  });
});

describe('phiếu hẹn sửa chữa (web) và phiếu lấy máy (quản trị) dùng chung một nguồn dữ liệu', () => {
  it('slipRows lấy đúng mã, khách, điện thoại, thiết bị, dịch vụ, ghi chú từ bản ghi', () => {
    const rows = slipRows(booking);
    assert.deepEqual(rows.map(r => r[0]), ['Mã phiếu', 'Khách hàng', 'Điện thoại', 'Thiết bị', 'Dịch vụ', 'Ghi chú']);
    assert.equal(rows[0][1], 'SC1007');
    assert.equal(rows[3][1], 'iPhone 14 Pro Max');
  });
  it('bỏ dòng ghi chú khi trống', () => {
    assert.equal(slipRows({ ...booking, note: '' }).length, 5);
  });
  it('phiếu hẹn và phiếu lấy máy cùng mã và cùng dữ liệu khách/máy', () => {
    const a = buildRepairSlip('appointment', booking);
    const p = buildRepairSlip('pickup', booking);
    assert.equal(a.title, 'PHIẾU HẸN SỬA CHỮA');
    assert.equal(p.title, 'PHIẾU LẤY MÁY');
    assert.equal(a.code, p.code);
    assert.deepEqual(a.rows, p.rows);
    assert.match(a.notes.join(' '), /mang phiếu này/i);
    assert.match(p.notes.join(' '), /nhận lại máy/i);
  });
  it('kind lạ hoặc bản ghi sai trả null', () => {
    assert.equal(buildRepairSlip('x', booking), null);
    assert.equal(buildRepairSlip('pickup', null), null);
  });
  it('HTML phiếu thoát ký tự đặc biệt, có mã, địa chỉ và hotline cửa hàng', () => {
    const html = repairSlipHtml(buildRepairSlip('appointment', booking));
    assert.match(html, /SC1007/);
    assert.match(html, /Lê &lt;i&gt;Hoa&lt;\/i&gt;/);
    assert.doesNotMatch(html, /<i>Hoa/);
    assert.match(html, /54A8 Ngô Chí Quốc/);
    assert.match(html, /0986 455 457/);
  });
});

describe('quản trị: in phiếu lấy máy', () => {
  it('pickup là loại in hợp lệ, cùng bảng lịch sửa chữa, tính vào sổ thu mục Sửa chữa', () => {
    assert.ok(INVOICE_TYPES.includes('pickup'));
    assert.equal(INVOICE_TABLES.pickup, 'repair_bookings');
    assert.equal(categoryForInvoice('pickup'), 'Sửa chữa');
  });
  it('buildInvoice("pickup") cùng mã và hàng thông tin máy với phiếu hẹn', () => {
    const inv = buildInvoice('pickup', booking);
    assert.equal(inv.title, 'PHIẾU LẤY MÁY');
    assert.equal(inv.code, 'SC1007');
    const shared = buildRepairSlip('pickup', booking).rows.map(r => r[1]);
    const text = JSON.stringify(inv);
    for (const v of ['iPhone 14 Pro Max', 'Thay pin']) assert.ok(text.includes(v), v);
    assert.ok(shared.includes('SC1007'));
    assert.deepEqual(inv.signatures, ['Khách hàng', 'Kỹ thuật viên']);
    assert.match(invoiceHtml(inv), /PHIẾU LẤY MÁY/);
  });
  it('trang lịch sửa chữa có nút In phiếu lấy máy; print.js nhận loại pickup', () => {
    const orders = read('Frontend/admin/orders.js');
    assert.match(orders, /print\.html\?type=pickup/);
    assert.match(orders, /In phiếu lấy máy/);
    assert.match(read('Frontend/admin/print.js'), /docType === 'pickup'/);
  });
});

describe('web: phiếu hẹn sửa chữa sau khi đặt lịch', () => {
  const idx = read('Frontend/index.html');
  const js = read('Frontend/js/app.js');
  it('có hộp phiếu hẹn với nút In/Lưu PDF, Sao chép mã, Đóng', () => {
    assert.match(idx, /id="repairSlipModal"/);
    for (const id of ['repairSlipPrint', 'repairSlipCopy', 'repairSlipClose', 'repairSlipBody']) assert.match(idx, new RegExp(`id="${id}"`), id);
  });
  it('đặt lịch thành công thì hiện phiếu hẹn thay cho hộp thoại chữ', () => {
    assert.match(js, /buildRepairSlip\('appointment'/);
    assert.match(js, /showRepairSlip\(/);
    assert.doesNotMatch(js, /ĐÃ ĐẶT LỊCH HẸN!\\n\\nMã lịch/);
  });
  it('CSS in: chỉ in phần phiếu', () => {
    const css = read('Frontend/css/style.css');
    assert.match(css, /@media print[\s\S]*#repairSlipModal/);
  });
});

describe('trang sản phẩm: khung chờ và Facebook', () => {
  const p = read('Frontend/product.html');
  it('có biểu tượng Facebook và khung chờ mờ khi đang tải sản phẩm', () => {
    assert.match(p, /facebook\.com\/van\.tien\.201660/);
    assert.match(p, /class="sk-card"/);
    assert.match(read('Frontend/js/product.js'), /removeAttribute\('aria-busy'\)/);
  });
});
