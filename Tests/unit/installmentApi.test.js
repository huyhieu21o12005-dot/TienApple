import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lookupInstallment } from '../../Frontend/js/installmentApi.js';
import { installmentResultHtml } from '../../Frontend/js/templates.js';

const fakeClient = (result, calls = []) => ({
  rpc: async (name, args) => {
    calls.push({ name, args });
    if (result instanceof Error) throw result;
    return result;
  }
});

describe('installmentApi - lookupInstallment', () => {
  it('kiểm tra số điện thoại và mã trước khi gọi máy chủ', async () => {
    assert.equal((await lookupInstallment('123', 'TG1001', { client: null })).reason, 'invalid_phone');
    assert.equal((await lookupInstallment('0912345678', 'XX1', { client: null })).reason, 'invalid_code');
    assert.equal((await lookupInstallment('0912345678', 'TG1001', { client: null })).reason, 'not_configured');
  });

  it('chuẩn hóa đầu vào và trả hồ sơ', async () => {
    const calls = [];
    const row = { code: 'TG1001' };
    const result = await lookupInstallment('0912 345 678', ' tg1001 ', { client: fakeClient({ data: [row], error: null }, calls) });
    assert.deepEqual(result, { ok: true, record: row });
    assert.deepEqual(calls[0], { name: 'lookup_installment', args: { p_phone: '0912345678', p_code: 'TG1001' } });
  });

  it('không có hồ sơ khớp trả record null; xử lý lỗi máy chủ và mạng', async () => {
    assert.deepEqual(await lookupInstallment('0912345678', 'TG1001', { client: fakeClient({ data: [], error: null }) }), { ok: true, record: null });
    const rejected = await lookupInstallment('0912345678', 'TG1001', { client: fakeClient({ data: null, error: { message: 'TOO_MANY_REQUESTS' } }) });
    assert.equal(rejected.reason, 'rejected');
    assert.match(rejected.message, /quá nhiều/);
    assert.equal((await lookupInstallment('0912345678', 'TG1001', { client: fakeClient(new Error('x')) })).reason, 'network');
  });
});

describe('templates - installmentResultHtml', () => {
  const record = {
    code: 'TG1001', customer_name_masked: 'N**** A*', product: 'iPhone <15>', original_price: 30000000, down_payment: 10000000,
    interest_rate: 1.5, term_months: 6, monthly_payment: 3634000, total_amount: 31804000, pay_method: 'Tiền mặt',
    paid_months: 2, remaining_months: 4, remaining_amount: 14536000, status: 'active', start_date: '2026-10-24', next_due_date: '2026-12-24'
  };

  it('hiện tiến độ, tiền và escape dữ liệu', () => {
    const html = installmentResultHtml(record);
    assert.match(html, /TG1001/);
    assert.match(html, /Đã đóng 2\/6 kỳ/);
    assert.match(html, /33%/);
    assert.match(html, /1,5%\/tháng/);
    assert.match(html, /Kỳ tới/);
    assert.doesNotMatch(html, /iPhone <15>/);
    assert.match(html, /iPhone &lt;15&gt;/);
  });

  it('hồ sơ đã tất toán không có dòng kỳ tới; không có hồ sơ thì báo không tìm thấy', () => {
    assert.doesNotMatch(installmentResultHtml({ ...record, status: 'completed', paid_months: 6 }), /Kỳ tới/);
    assert.match(installmentResultHtml(null), /Không tìm thấy/);
  });
});
