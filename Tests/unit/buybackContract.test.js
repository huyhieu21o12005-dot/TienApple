import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moneyInWords, validateBuyback, buildBuybackContract } from '../../Frontend/admin/buybackContract.js';
import { brandMarkHtml, contractHtml } from '../../Frontend/admin/invoiceHelpers.js';

describe('buybackContract', () => {
  it('đọc số tiền bằng chữ', () => {
    assert.equal(moneyInWords(12500000), 'Mười hai triệu năm trăm nghìn đồng');
    assert.equal(moneyInWords(9700000), 'Chín triệu bảy trăm nghìn đồng');
    assert.equal(moneyInWords(1005000), 'Một triệu không trăm lẻ năm nghìn đồng');
    assert.equal(moneyInWords(21000000), 'Hai mươi mốt triệu đồng');
    assert.equal(moneyInWords(15), 'Mười lăm đồng');
    assert.equal(moneyInWords(0), 'Không đồng');
    assert.equal(moneyInWords('abc'), '');
  });
  it('kiểm tra biểu mẫu thiếu thông tin', () => {
    assert.equal(validateBuyback({}).valid, false);
    assert.equal(validateBuyback({ sellerName: 'A', sellerCccd: '1', model: 'iPhone 15', imei: '35', price: '9.700.000' }).valid, true);
  });
  it('dựng hợp đồng và in an toàn (escape HTML)', () => {
    const c = buildBuybackContract({ sellerName: '<b>Nguyễn Văn A</b>', model: 'iPhone 15 Pro', imei: '3567', price: '9.700.000', payMethod: 'cash', date: '2026-10-25T10:30:00' });
    assert.match(c.number, /^Số: TM-20261025-1030$/);
    assert.match(c.dateText, /ngày 25 tháng 10 năm 2026/);
    const html = contractHtml(c);
    assert.ok(!html.includes('<b>Nguyễn'));
    assert.match(html, /Chín triệu bảy trăm nghìn đồng/);
    assert.match(html, /iCloud/);
    assert.match(html, /☒ Tiền mặt/);
  });
  it('thiếu thông tin thì chừa chỗ trống để điền tay', () => {
    const html = contractHtml(buildBuybackContract({}));
    assert.match(html, /\.{10,}/);
  });
});

describe('logo trên bản in', () => {
  it('hóa đơn và hợp đồng in có logo cửa hàng', () => {
    assert.match(brandMarkHtml(), /<svg[\s\S]*Tien Mobile[\s\S]*Thu Duc/);
    assert.match(contractHtml({ title: 'T', number: 'N', place: 'P', dateText: 'D', intro: 'I', parties: [], articles: [], signatures: [] }), /brand-mark/);
  });
});
