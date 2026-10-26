import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoice, invoiceHtml, buildContract, contractHtml, CONTRACT_TYPES, INVOICE_TYPES, INVOICE_TABLES } from '../../Frontend/admin/invoiceHelpers.js';

const order = {
  code: 'DH1001', created_at: '2026-10-24T08:30:00Z', customer_name: 'An <b>', phone: '0912345678', address: '12 Lê Lợi',
  items: [{ name: 'iPhone 16', price: 20000000, quantity: 2, color: 'Đen', storage: '256GB' }],
  subtotal: 40000000, discount: 300000, voucher: 'MEMBER', shipping_fee: 30000, total: 39730000, note: 'Giao giờ hành chính'
};
const booking = { code: 'SC1001', created_at: '2026-10-24T08:30:00Z', customer_name: 'Bình', phone: '0987654321', device: 'iPhone 13', service: 'Thay pin', note: 'Pin chai' };
const warranty = { code: 'BH1001', created_at: '2026-10-24T08:30:00Z', customer_name: 'Chi', phone: '0911111111', device: 'iPhone 14', service: 'Thay màn', warranty_months: 3, start_date: '2026-01-31', note: null };
const installment = {
  code: 'TG1001', created_at: '2026-10-24T08:30:00Z', customer_name: 'Dũng', phone: '0922222222', product: 'iPhone 15', original_price: 30000000,
  down_payment: 10000000, interest_rate: 1.5, term_months: 6, loan_amount: 20000000, monthly_payment: 3634000, total_amount: 31804000,
  pay_method: 'Chuyển khoản', paid_months: 2, status: 'active', start_date: '2026-10-24', documents: 'CCCD / CMND', note: null
};

describe('invoice - buildInvoice', () => {
  it('từ chối loại hoặc dữ liệu sai', () => {
    assert.equal(buildInvoice('x', order), null);
    assert.equal(buildInvoice('order', null), null);
    assert.equal(buildInvoice('order', 'abc'), null);
    assert.equal(INVOICE_TYPES.every(t => INVOICE_TABLES[t]), true);
  });

  it('hóa đơn bán hàng có dòng hàng, giảm giá, ship và tổng', () => {
    const inv = buildInvoice('order', order);
    assert.equal(inv.title, 'HÓA ĐƠN BÁN HÀNG');
    assert.equal(inv.items.length, 1);
    assert.equal(inv.items[0].qty, 2);
    assert.equal(inv.items[0].detail, 'Đen / 256GB');
    assert.deepEqual(inv.totals.map(t => t[0]), ['Tạm tính', 'Giảm giá (MEMBER)', 'Phí vận chuyển', 'TỔNG CỘNG']);
    assert.equal(inv.totals[3][2], true);
    assert.ok(inv.customer.some(([k]) => k === 'Địa chỉ'));
  });

  it('đơn không giảm giá/ship thì bỏ hai dòng đó; thiếu items vẫn chạy', () => {
    const inv = buildInvoice('order', { ...order, discount: 0, shipping_fee: 0, voucher: null, note: '', items: undefined });
    assert.deepEqual(inv.totals.map(t => t[0]), ['Tạm tính', 'TỔNG CỘNG']);
    assert.equal(inv.items.length, 0);
    assert.equal(buildInvoice('order', { ...order, discount: 5, voucher: null }).totals[1][0], 'Giảm giá');
  });

  it('phiếu sửa chữa, bảo hành (hạn cuối tháng) và trả góp', () => {
    const b = buildInvoice('booking', booking);
    assert.equal(b.title, 'PHIẾU TIẾP NHẬN SỬA CHỮA');
    assert.ok(b.notes.some(n => n.includes('Pin chai')));

    const w = buildInvoice('warranty', warranty);
    assert.equal(w.title, 'PHIẾU BẢO HÀNH');
    const rows = Object.fromEntries(w.sections[0].rows);
    assert.equal(rows['Đến ngày'], '30/04/2026');
    assert.equal(rows['Thời hạn'], '3 tháng');

    const i = buildInvoice('installment', installment);
    assert.equal(i.title, 'HÓA ĐƠN TRẢ GÓP');
    assert.deepEqual(i.totals[0].slice(0, 1), ['THÀNH TIỀN']);
    const terms = Object.fromEntries(i.sections[1].rows);
    assert.equal(terms['Lãi suất'], '1,5%/tháng');
    assert.equal(terms['Đã đóng'], '2/6 kỳ');
    assert.equal(terms['Kỳ tới'], '24/01/2027');
    assert.equal(buildInvoice('installment', { ...installment, documents: null, paid_months: 6, status: 'completed' }).sections[2].rows[0][1], 'Không có');
  });
});

describe('invoice - invoiceHtml', () => {
  it('escape dữ liệu khách và hiện thông tin cửa hàng', () => {
    const html = invoiceHtml(buildInvoice('order', order));
    assert.match(html, /Tien Mobile/);
    assert.match(html, /shop-contact[\s\S]*Hotline/);
    assert.match(html, /DH1001/);
    assert.match(html, /An &lt;b&gt;/);
    assert.doesNotMatch(html, /An <b>/);
    assert.match(html, /Cảm ơn quý khách/);
  });

  it('mỗi loại đều dựng được HTML; dữ liệu null có thông báo', () => {
    for (const [type, rec] of [['booking', booking], ['warranty', warranty], ['installment', installment]]) {
      assert.match(invoiceHtml(buildInvoice(type, rec)), /inv-title/);
    }
    assert.match(invoiceHtml(null), /Không tìm thấy/);
  });
});

describe('contract - buildContract / contractHtml', () => {
  it('chỉ hỗ trợ đơn hàng và trả góp, dữ liệu sai trả null', () => {
    assert.deepEqual(CONTRACT_TYPES, ['order', 'installment']);
    assert.equal(buildContract('warranty', warranty), null);
    assert.equal(buildContract('order', null), null);
  });

  it('hợp đồng đơn hàng có bên A, bên B, hàng hóa và điều khoản bảo hành', () => {
    const c = buildContract('order', order);
    assert.match(c.title, /MUA BÁN/);
    assert.equal(c.number, `Số: HD-${order.code}`);
    assert.equal(c.parties.length, 2);
    assert.ok(c.articles[0].items.length >= 1);
    assert.ok(c.articles.some(a => /Bảo hành/.test(a.heading)));
  });

  it('hợp đồng trả góp liệt kê điều khoản trả góp', () => {
    const c = buildContract('installment', installment);
    assert.match(c.title, /TRẢ GÓP/);
    const labels = c.articles[1].rows.map(r => r[0]);
    for (const k of ['Trả trước', 'Khoản vay', 'Lãi suất', 'Kỳ hạn', 'Góp mỗi tháng', 'Thành tiền']) assert.ok(labels.includes(k), k);
  });

  it('HTML escape dữ liệu khách nhập', () => {
    const html = contractHtml(buildContract('order', { ...order, customer_name: '<script>x</script>' }));
    assert.ok(!html.includes('<script>'));
    assert.match(html, /ct-title/);
    assert.match(contractHtml(null), /Không tìm thấy/);
  });
});

describe('invoice - seri/IMEI, giảm giá thêm, VAT', () => {
  it('không nhập thêm thì giữ tổng đã lưu', () => {
    const inv = buildInvoice('order', order, {});
    assert.equal(inv.totals.at(-1)[1], buildInvoice('order', order).totals.at(-1)[1]);
    assert.equal(inv.sections.length, 0);
  });

  it('thêm IMEI, giảm giá và VAT cộng trên số sau giảm giá', () => {
    const inv = buildInvoice('order', order, { imei: '356938035643809', discount: '700.000', vat: '10' });
    assert.deepEqual(inv.sections[0].rows, [['Số seri / IMEI', '356938035643809']]);
    const labels = inv.totals.map(t => t[0]);
    assert.ok(labels.some(l => l.startsWith('Thuế VAT (10%')));
    // (40.000.000 - 300.000 - 700.000) = 39.000.000; x1,1 + 30.000 = 42.930.000
    assert.match(inv.totals.at(-1)[1].replace(/\D/g, ''), /^42930000/);
  });

  it('phiếu sửa chữa có chi phí thì tính tổng, không thì để trống', () => {
    assert.equal(buildInvoice('booking', booking).totals[0][0], 'Chi phí');
    const inv = buildInvoice('booking', booking, { price: '500000', vat: '8' });
    assert.match(inv.totals.at(-1)[1].replace(/\D/g, ''), /^540000/);
  });

  it('IMEI hiện ở phiếu bảo hành và trả góp', () => {
    assert.ok(buildInvoice('warranty', warranty, { imei: '123' }).sections[0].rows.some(r => r[0] === 'Số seri / IMEI'));
    assert.ok(buildInvoice('installment', installment, { imei: '123' }).sections[0].rows.some(r => r[0] === 'Số seri / IMEI'));
  });
});
