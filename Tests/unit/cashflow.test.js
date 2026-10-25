import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, monthKey, monthOptions, filterEntries, summarize, categoriesFor, categoryForInvoice } from '../../Frontend/admin/cashflowHelpers.js';

const entries = [
  { kind: 'in', amount: 30000000, category: 'Bán máy', entry_date: '2026-10-05' },
  { kind: 'in', amount: 500000, category: 'Sửa chữa', entry_date: '2026-10-20' },
  { kind: 'out', amount: 20000000, category: 'Nhập hàng', entry_date: '2026-10-02' },
  { kind: 'out', amount: 3000000, category: 'Mặt bằng', entry_date: '2026-09-30' },
  { kind: 'in', amount: 1000000, category: 'Bán máy', entry_date: '2026-09-15' }
];

describe('cashflow - validateEntry', () => {
  const ok = { kind: 'in', amount: '1.500.000', category: 'Bán máy', date: '2026-10-25', note: ' ghi chú ' };
  it('hợp lệ', () => {
    const r = validateEntry(ok);
    assert.equal(r.valid, true);
    assert.deepEqual(r.row, { kind: 'in', amount: 1500000, category: 'Bán máy', note: 'ghi chú', entry_date: '2026-10-25', ref_code: null });
  });
  it('báo lỗi dữ liệu sai', () => {
    assert.equal(validateEntry(null).valid, false);
    assert.equal(validateEntry({ ...ok, kind: 'x' }).valid, false);
    assert.equal(validateEntry({ ...ok, amount: '0' }).valid, false);
    assert.equal(validateEntry({ ...ok, amount: 'abc' }).valid, false);
    assert.equal(validateEntry({ ...ok, category: '' }).valid, false);
    assert.equal(validateEntry({ ...ok, date: '25/10/2026' }).valid, false);
  });
  it('giữ mã phiếu', () => assert.equal(validateEntry({ ...ok, refCode: 'DH1001' }).row.ref_code, 'DH1001'));
});

describe('cashflow - tháng và thống kê', () => {
  it('monthKey / monthOptions', () => {
    assert.equal(monthKey('2026-10-05'), '2026-10');
    assert.equal(monthKey('bad'), '');
    assert.deepEqual(monthOptions(entries, '2026-11'), ['2026-11', '2026-10', '2026-09']);
  });
  it('lọc theo tháng và loại', () => {
    assert.equal(filterEntries(entries, { month: '2026-10' }).length, 3);
    assert.equal(filterEntries(entries, { month: '2026-10', kind: 'out' }).length, 1);
    assert.equal(filterEntries(entries).length, 5);
  });
  it('tổng thu, chi, lợi nhuận và theo nhóm', () => {
    const s = summarize(filterEntries(entries, { month: '2026-10' }));
    assert.equal(s.totalIn, 30500000);
    assert.equal(s.totalOut, 20000000);
    assert.equal(s.profit, 10500000);
    assert.deepEqual(s.byCategory.in[0], ['Bán máy', 30000000]);
    assert.equal(summarize(null).profit, 0);
  });
  it('nhóm và danh mục theo loại phiếu', () => {
    assert.ok(categoriesFor('out').includes('Nhập hàng'));
    assert.ok(categoriesFor('in').includes('Bán máy'));
    assert.equal(categoryForInvoice('installment'), 'Trả góp');
    assert.equal(categoryForInvoice('x'), 'Khác');
  });
});
