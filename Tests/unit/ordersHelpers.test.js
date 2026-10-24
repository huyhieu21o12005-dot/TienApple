import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_STATUSES,
  BOOKING_STATUSES,
  statusesFor,
  statusLabel,
  countByStatus,
  filterRecords,
  summarizeItems,
  formatDateTime,
  telHref
} from '../../Frontend/admin/ordersHelpers.js';

const records = [
  { code: 'DH1001', status: 'new', customer_name: 'Nguyễn An', phone: '0912345678', device: 'iPhone 15', service: 'Thay pin' },
  { code: 'DH1002', status: 'done', customer_name: 'Trần Bình', phone: '0987654321' },
  { code: 'DH1003', status: 'new', customer_name: 'Lê Chi', phone: '0933266179' }
];

describe('ordersHelpers - trạng thái', () => {
  it('statusesFor chọn đúng danh sách theo loại', () => {
    assert.equal(statusesFor('orders'), ORDER_STATUSES);
    assert.equal(statusesFor('bookings'), BOOKING_STATUSES);
    assert.equal(statusesFor('khac'), ORDER_STATUSES);
  });

  it('statusLabel trả nhãn tiếng Việt hoặc chính giá trị khi không biết', () => {
    assert.equal(statusLabel('orders', 'shipping'), 'Đang giao');
    assert.equal(statusLabel('bookings', 'in_progress'), 'Đang sửa');
    assert.equal(statusLabel('orders', 'lạ'), 'lạ');
    assert.equal(statusLabel('orders', undefined), '');
  });

  it('countByStatus đếm đúng và bỏ qua phần tử rỗng', () => {
    assert.deepEqual(countByStatus([...records, null]), { all: 3, new: 2, done: 1 });
    assert.deepEqual(countByStatus(undefined), { all: 0 });
  });
});

describe('ordersHelpers - lọc và hiển thị', () => {
  it('filterRecords lọc theo trạng thái', () => {
    assert.equal(filterRecords(records, { status: 'new' }).length, 2);
    assert.equal(filterRecords(records).length, 3);
    assert.equal(filterRecords(null).length, 0);
  });

  it('filterRecords tìm theo mã, tên, thiết bị và số điện thoại', () => {
    assert.deepEqual(filterRecords(records, { query: 'dh1002' }).map(r => r.code), ['DH1002']);
    assert.deepEqual(filterRecords(records, { query: 'lê chi' }).map(r => r.code), ['DH1003']);
    assert.deepEqual(filterRecords(records, { query: 'iphone' }).map(r => r.code), ['DH1001']);
    assert.deepEqual(filterRecords(records, { query: '098 765' }).map(r => r.code), ['DH1002']);
    assert.equal(filterRecords(records, { query: '12' }).length, 0);
    assert.equal(filterRecords([...records, null], { query: 'zzz' }).length, 0);
  });

  it('summarizeItems rút gọn danh sách hàng', () => {
    assert.equal(summarizeItems([{ name: 'A', quantity: 2 }, { id: 'b' }]), 'A x2, b x1');
    assert.equal(
      summarizeItems([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }]),
      'A x1, B x1, C x1 và 2 sản phẩm khác'
    );
    assert.equal(summarizeItems([]), '');
    assert.equal(summarizeItems(null), '');
  });

  it('formatDateTime và telHref', () => {
    assert.match(formatDateTime('2026-10-23T09:05:00'), /^23\/10\/2026 09:05$/);
    assert.equal(formatDateTime('không phải ngày'), '');
    assert.equal(telHref('0986 455-457'), 'tel:0986455457');
    assert.equal(telHref(''), '');
    assert.equal(telHref(undefined), '');
  });
});
