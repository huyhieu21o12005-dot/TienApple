import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateZaloOffer, buildZaloMessage, buildOfferBooking, ZALO_URL } from '../../Frontend/js/zalo.js';

const valid = { name: 'Nguyễn An', phone: '0912 345 678', device: 'iPhone 13 Pro Max', service: 'Thay pin', note: 'Pin chai' };

describe('zalo offer', () => {
  it('chấp nhận thông tin hợp lệ và chuẩn hóa số điện thoại', () => {
    const r = validateZaloOffer(valid);
    assert.equal(r.valid, true);
    assert.equal(r.phone, '0912345678');
  });

  it('báo lỗi từng trường bắt buộc', () => {
    assert.equal(validateZaloOffer({}).errors.length, 4);
    assert.equal(validateZaloOffer(null).valid, false);
    assert.equal(validateZaloOffer({ ...valid, phone: '123' }).valid, false);
    assert.equal(validateZaloOffer({ ...valid, name: ' ' }).valid, false);
    assert.equal(validateZaloOffer({ ...valid, device: '' }).valid, false);
    assert.equal(validateZaloOffer({ ...valid, service: '' }).valid, false);
  });

  it('soạn tin gồm đủ thông tin, ghi chú là tùy chọn', () => {
    const msg = buildZaloMessage(valid);
    assert.match(msg, /ƯU ĐÃI SỬA CHỮA GIẢM 10%/);
    assert.match(msg, /Họ tên: Nguyễn An/);
    assert.match(msg, /SĐT: 0912345678/);
    assert.match(msg, /Máy: iPhone 13 Pro Max/);
    assert.match(msg, /Dịch vụ: Thay pin/);
    assert.match(msg, /Tình trạng: Pin chai/);
    assert.doesNotMatch(buildZaloMessage({ ...valid, note: '' }), /Tình trạng/);
  });

  it('cắt độ dài và giữ số điện thoại gốc nếu không chuẩn hóa được', () => {
    const msg = buildZaloMessage({ ...valid, name: 'x'.repeat(300), phone: 'abc' });
    assert.ok(msg.split('\n')[1].length <= 'Họ tên: '.length + 100);
    assert.match(msg, /SĐT: abc/);
    assert.match(ZALO_URL, /^https:\/\/zalo\.me\/0986455457$/);
  });
});

describe('zalo offer - buildOfferBooking', () => {
  it('tạo lịch hẹn có ghi chú ưu đãi và tình trạng máy', () => {
    const b = buildOfferBooking(valid);
    assert.equal(b.phone, '0912345678');
    assert.equal(b.device, 'iPhone 13 Pro Max');
    assert.equal(b.service, 'Thay pin');
    assert.match(b.note, /Ưu đãi sửa chữa giảm 10%/);
    assert.match(b.note, /Tình trạng: Pin chai/);
  });

  it('không có tình trạng thì chỉ ghi ưu đãi; cắt độ dài', () => {
    assert.doesNotMatch(buildOfferBooking({ ...valid, note: '' }).note, /Tình trạng/);
    const long = buildOfferBooking({ ...valid, name: 'x'.repeat(300), device: 'y'.repeat(300), service: 'z'.repeat(300), note: 'n'.repeat(900) });
    assert.ok(long.name.length <= 100 && long.device.length <= 100 && long.service.length <= 100 && long.note.length <= 500);
  });
});
