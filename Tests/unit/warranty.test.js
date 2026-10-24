import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone, addMonths, warrantyInfo, formatDate, maskName, validateWarranty, filterWarranties
} from '../../Frontend/js/warranty.js';
import { warrantyResultsHtml } from '../../Frontend/js/templates.js';
import { lookupWarranty } from '../../Frontend/js/warrantyApi.js';

const valid = {
  customer_name: 'Nguyễn Văn An', phone: '0912 345 678', device: 'iPhone 15',
  service: 'Thay màn hình', warranty_months: 3, start_date: '2026-01-31'
};

describe('warranty helpers', () => {
  it('normalizePhone chấp nhận 0xx, +84 và dấu cách; từ chối số sai', () => {
    assert.equal(normalizePhone('0912 345 678'), '0912345678');
    assert.equal(normalizePhone('+84912345678'), '0912345678');
    assert.equal(normalizePhone('091-234.5678'), '0912345678');
    assert.equal(normalizePhone('12345'), '');
    assert.equal(normalizePhone('0212345678'), '');
    assert.equal(normalizePhone(null), '');
  });

  it('addMonths giữ ngày cuối tháng và xử lý năm nhuận', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
    assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
    assert.equal(addMonths('2026-02-30', 1), '');
    assert.equal(addMonths('abc', 1), '');
  });

  it('warrantyInfo tính hạn và số ngày còn lại', () => {
    assert.deepEqual(warrantyInfo('2026-01-01', 3, '2026-03-01'), { endDate: '2026-04-01', active: true, daysLeft: 31 });
    assert.equal(warrantyInfo('2026-01-01', 3, '2026-04-01').active, true);
    assert.deepEqual(warrantyInfo('2026-01-01', 3, '2026-04-02'), { endDate: '2026-04-01', active: false, daysLeft: 0 });
    assert.equal(warrantyInfo('x', 3).active, false);
  });

  it('formatDate và maskName', () => {
    assert.equal(formatDate('2026-04-05'), '05/04/2026');
    assert.equal(formatDate('bad'), '');
    assert.equal(maskName('Nguyễn Văn An'), 'N**** V** A*');
    assert.equal(maskName(''), '');
  });

  it('validateWarranty báo lỗi từng trường', () => {
    const ok = validateWarranty(valid);
    assert.equal(ok.valid, true);
    assert.equal(ok.phone, '0912345678');
    const bad = validateWarranty({});
    assert.equal(bad.valid, false);
    assert.equal(bad.errors.length, 6);
    assert.equal(validateWarranty({ ...valid, warranty_months: 61 }).valid, false);
    assert.equal(validateWarranty({ ...valid, warranty_months: 1.5 }).valid, false);
    assert.equal(validateWarranty(null).valid, false);
  });

  it('filterWarranties lọc theo từ khóa, số điện thoại và trạng thái', () => {
    const records = [
      { code: 'BH1', customer_name: 'An', phone: '0912345678', device: 'iPhone 15', service: 'Pin', start_date: '2026-01-01', warranty_months: 3 },
      { code: 'BH2', customer_name: 'Bình', phone: '0987654321', device: 'Samsung', service: 'Màn', start_date: '2025-01-01', warranty_months: 3 }
    ];
    const today = '2026-02-01';
    assert.equal(filterWarranties(records, { today }).length, 2);
    assert.deepEqual(filterWarranties(records, { status: 'active', today }).map(r => r.code), ['BH1']);
    assert.deepEqual(filterWarranties(records, { status: 'expired', today }).map(r => r.code), ['BH2']);
    assert.deepEqual(filterWarranties(records, { query: '0987', today }).map(r => r.code), ['BH2']);
    assert.deepEqual(filterWarranties(records, { query: 'iphone', today }).map(r => r.code), ['BH1']);
    assert.deepEqual(filterWarranties(null), []);
  });
});

describe('warrantyResultsHtml', () => {
  it('hiển thị thông báo khi không có phiếu', () => {
    assert.match(warrantyResultsHtml([]), /Không tìm thấy phiếu bảo hành/);
  });

  it('hiển thị phiếu còn hạn / hết hạn và escape dữ liệu', () => {
    const html = warrantyResultsHtml([
      { code: 'BH1', customer_name_masked: 'N**', device: '<script>x</script>', service: 'Pin', start_date: '2026-01-01', end_date: '2026-04-01', warranty_months: 3, is_active: true, days_left: 10 },
      { code: 'BH2', customer_name_masked: 'B**', device: 'A', service: 'B', start_date: '2025-01-01', end_date: '2025-04-01', warranty_months: 3, is_active: false, days_left: 0 }
    ]);
    assert.match(html, /Còn bảo hành/);
    assert.match(html, /Còn 10 ngày/);
    assert.match(html, /Hết hạn/);
    assert.match(html, /01\/04\/2026/);
    assert.ok(!html.includes('<script>'));
  });
});

describe('lookupWarranty', () => {
  const client = (result) => ({ rpc: async (name, args) => { client.last = { name, args }; if (result instanceof Error) throw result; return result; } });

  it('từ chối số điện thoại sai mà không gọi máy chủ', async () => {
    const r = await lookupWarranty('123', { client: client({ data: [] }) });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_phone');
  });

  it('báo chưa cấu hình khi không có client', async () => {
    const r = await lookupWarranty('0912345678', { client: null });
    assert.equal(r.reason, 'not_configured');
    assert.match(r.message, /0986 455 457/);
  });

  it('gọi rpc lookup_warranty với số đã chuẩn hóa', async () => {
    const c = client({ data: [{ code: 'BH1' }], error: null });
    const r = await lookupWarranty('+84 912 345 678', { client: c });
    assert.equal(r.ok, true);
    assert.equal(r.phone, '0912345678');
    assert.deepEqual(r.records, [{ code: 'BH1' }]);
    assert.deepEqual(client.last, { name: 'lookup_warranty', args: { p_phone: '0912345678' } });
  });

  it('xử lý lỗi từ máy chủ và lỗi mạng', async () => {
    const rejected = await lookupWarranty('0912345678', { client: client({ data: null, error: { message: 'TOO_MANY_REQUESTS' } }) });
    assert.equal(rejected.reason, 'rejected');
    assert.match(rejected.message, /quá nhiều/);
    const net = await lookupWarranty('0912345678', { client: client(new Error('offline')) });
    assert.equal(net.reason, 'network');
    const empty = await lookupWarranty('0912345678', { client: client({ data: null, error: null }) });
    assert.deepEqual(empty.records, []);
  });
});
