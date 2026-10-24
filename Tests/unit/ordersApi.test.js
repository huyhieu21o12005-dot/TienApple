import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOP_HOTLINE,
  parseApiError,
  buildOrderItems,
  submitOrder,
  submitBooking
} from '../../Frontend/js/ordersApi.js';

/** Supabase client giả: ghi lại lời gọi rpc và trả kết quả đã cấu hình */
function fakeClient(result, calls = []) {
  return {
    async rpc(name, args) {
      calls.push({ name, args });
      if (result instanceof Error) throw result;
      return result;
    }
  };
}

describe('ordersApi - thông báo lỗi và dữ liệu gửi đi', () => {
  it('parseApiError đổi mã lỗi của máy chủ sang tiếng Việt', () => {
    assert.match(parseApiError({ message: 'INVALID_PHONE' }), /Số điện thoại/);
    assert.match(parseApiError({ message: 'P0001: OUT_OF_STOCK' }), /kho/);
    assert.match(parseApiError({ message: 'PRODUCT_UNAVAILABLE' }), /không còn bán/);
    assert.match(parseApiError({ message: 'TOO_MANY_REQUESTS' }), /quá nhiều/);
    assert.match(parseApiError({ message: 'lỗi lạ' }), new RegExp(SHOP_HOTLINE));
    assert.match(parseApiError(null), new RegExp(SHOP_HOTLINE));
  });

  it('buildOrderItems chỉ gửi mã, số lượng, màu, dung lượng (không gửi giá)', () => {
    const items = buildOrderItems([
      { product: { id: 'a', price: 1 }, quantity: 2, color: 'Đen', storage: '256GB' },
      { product: { id: 'b' }, quantity: 0 },
      { product: {}, quantity: 1 },
      null
    ]);
    assert.deepEqual(items, [
      { id: 'a', quantity: 2, color: 'Đen', storage: '256GB' },
      { id: 'b', quantity: 1, color: '', storage: '' }
    ]);
    assert.ok(!('price' in items[0]));
    assert.deepEqual(buildOrderItems(undefined), []);
  });
});

describe('ordersApi - submitOrder', () => {
  const input = { name: 'An', phone: '0912345678', address: '12 Nguyễn Huệ', items: [{ id: 'a', quantity: 1 }], voucher: 'VIP10' };

  it('báo chưa cấu hình khi không có Supabase (không giả vờ thành công)', async () => {
    const result = await submitOrder(input, { client: null });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not_configured');
    assert.match(result.message, new RegExp(SHOP_HOTLINE));
  });

  it('gọi create_order với đúng tham số và trả mã đơn, tổng tiền từ máy chủ', async () => {
    const calls = [];
    const client = fakeClient({ data: [{ order_code: 'DH1001', order_total: '28990000' }], error: null }, calls);
    const result = await submitOrder({ ...input, note: 'Giao giờ hành chính' }, { client });
    assert.deepEqual(result, { ok: true, code: 'DH1001', total: 28990000 });
    assert.equal(calls[0].name, 'create_order');
    assert.equal(calls[0].args.p_voucher, 'VIP10');
    assert.equal(calls[0].args.p_note, 'Giao giờ hành chính');
    assert.deepEqual(calls[0].args.p_items, input.items);
  });

  it('điền giá trị rỗng khi thiếu trường và chấp nhận kết quả không phải mảng', async () => {
    const calls = [];
    const client = fakeClient({ data: { order_code: 'DH1', order_total: 5 }, error: null }, calls);
    const result = await submitOrder(undefined, { client });
    assert.equal(result.ok, true);
    assert.deepEqual(calls[0].args, { p_name: '', p_phone: '', p_address: '', p_note: null, p_items: [], p_voucher: null });
  });

  it('chuyển lỗi máy chủ thành thông báo dễ hiểu', async () => {
    const result = await submitOrder(input, { client: fakeClient({ data: null, error: { message: 'OUT_OF_STOCK' } }) });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'rejected');
    assert.match(result.message, /kho/);
  });

  it('xử lý phản hồi thiếu mã đơn và lỗi mạng', async () => {
    const empty = await submitOrder(input, { client: fakeClient({ data: [], error: null }) });
    assert.equal(empty.ok, false);
    assert.equal(empty.reason, 'error');
    const net = await submitOrder(input, { client: fakeClient(new Error('network')) });
    assert.equal(net.ok, false);
    assert.equal(net.reason, 'network');
  });
});

describe('ordersApi - submitBooking', () => {
  const input = { name: 'An', phone: '0912345678', device: 'iPhone 15', service: 'Thay pin' };

  it('báo chưa cấu hình khi không có Supabase', async () => {
    assert.equal((await submitBooking(input, { client: null })).reason, 'not_configured');
  });

  it('gọi create_booking và trả mã lịch', async () => {
    const calls = [];
    const result = await submitBooking(input, { client: fakeClient({ data: [{ booking_code: 'SC1001' }], error: null }, calls) });
    assert.deepEqual(result, { ok: true, code: 'SC1001' });
    assert.equal(calls[0].name, 'create_booking');
    assert.equal(calls[0].args.p_device, 'iPhone 15');
    assert.equal(calls[0].args.p_note, null);
  });

  it('xử lý lỗi máy chủ, thiếu mã và lỗi mạng, và đầu vào rỗng', async () => {
    assert.equal((await submitBooking(input, { client: fakeClient({ data: null, error: { message: 'INVALID_PHONE' } }) })).reason, 'rejected');
    assert.equal((await submitBooking(input, { client: fakeClient({ data: [{}], error: null }) })).reason, 'error');
    assert.equal((await submitBooking(input, { client: fakeClient(new Error('x')) })).reason, 'network');
    const calls = [];
    await submitBooking(undefined, { client: fakeClient({ data: [{ booking_code: 'SC2' }], error: null }, calls) });
    assert.equal(calls[0].args.p_name, '');
  });
});
