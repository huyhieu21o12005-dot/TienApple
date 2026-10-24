import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateTradeIn, buildTradeInBooking, TRADE_IN_SERVICE } from '../../Frontend/js/tradeIn.js';

const valid = {
  brand: 'Apple', model: 'iPhone 13 Pro', storage: '256GB', condition: 'Trầy xước nhẹ',
  battery: '87', accessories: true, name: 'Nguyễn An', phone: '0912 345 678', note: 'Muốn lên iPhone 16'
};

describe('tradeIn', () => {
  it('chấp nhận biểu mẫu hợp lệ và chuẩn hóa số điện thoại', () => {
    const r = validateTradeIn(valid);
    assert.equal(r.valid, true);
    assert.equal(r.phone, '0912345678');
  });

  it('pin và ghi chú là tùy chọn', () => {
    assert.equal(validateTradeIn({ ...valid, battery: '', note: '' }).valid, true);
  });

  it('báo lỗi từng trường bắt buộc', () => {
    assert.equal(validateTradeIn({}).errors.length, 6);
    assert.equal(validateTradeIn(null).valid, false);
    assert.equal(validateTradeIn({ ...valid, brand: 'Nokia' }).valid, false);
    assert.equal(validateTradeIn({ ...valid, storage: '1GB' }).valid, false);
    assert.equal(validateTradeIn({ ...valid, battery: '120' }).valid, false);
    assert.equal(validateTradeIn({ ...valid, battery: '8.5' }).valid, false);
    assert.equal(validateTradeIn({ ...valid, phone: '123' }).valid, false);
  });

  it('buildTradeInBooking tạo dữ liệu lịch hẹn trong giới hạn của cơ sở dữ liệu', () => {
    const b = buildTradeInBooking(valid);
    assert.equal(b.service, TRADE_IN_SERVICE);
    assert.equal(b.device, 'Thu cũ: iPhone 13 Pro');
    assert.equal(b.phone, '0912345678');
    assert.match(b.note, /Pin: 87%/);
    assert.match(b.note, /Đủ hộp\/phụ kiện: có/);
    assert.match(b.note, /Muốn lên iPhone 16/);
    const long = buildTradeInBooking({ ...valid, model: 'x'.repeat(300), note: 'y'.repeat(900), name: 'z'.repeat(300) });
    assert.ok(long.device.length <= 100 && long.note.length <= 500 && long.name.length <= 100);
    assert.ok(TRADE_IN_SERVICE.length <= 100);
  });
});
