/**
 * Tien Mobile - Orders API
 * Gửi đơn hàng và lịch sửa chữa lên Supabase qua hàm create_order / create_booking.
 * Giá và tồn kho được máy chủ tính lại, trình duyệt chỉ gửi mã sản phẩm và số lượng.
 */

import { isSupabaseConfigured } from './config.js';
import { getSupabase } from './productsApi.js';

export const SHOP_HOTLINE = '0986 455 457';

const ERROR_MESSAGES = {
  INVALID_PHONE: 'Số điện thoại không hợp lệ (cần 10 chữ số).',
  INVALID_NAME: 'Vui lòng nhập họ và tên.',
  INVALID_ADDRESS: 'Vui lòng nhập địa chỉ cụ thể để giao hàng.',
  INVALID_ITEMS: 'Thông tin đơn chưa đầy đủ, vui lòng kiểm tra lại.',
  INVALID_QUANTITY: 'Số lượng sản phẩm không hợp lệ.',
  PRODUCT_UNAVAILABLE: 'Có sản phẩm trong giỏ không còn bán. Vui lòng tải lại trang và chọn lại.',
  OUT_OF_STOCK: 'Có sản phẩm không đủ số lượng trong kho. Vui lòng giảm số lượng hoặc liên hệ shop.',
  INVALID_CODE: 'Mã hóa đơn không đúng. Mã có dạng TG1001, ghi trên hóa đơn.',
  INVALID_VOUCHER: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.',
  TOO_MANY_REQUESTS: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau hoặc gọi hotline.'
};

const GENERIC_ERROR = `Chưa gửi được yêu cầu. Vui lòng thử lại hoặc gọi hotline ${SHOP_HOTLINE}.`;
const NOT_CONFIGURED = `Hệ thống nhận đơn online đang bảo trì. Vui lòng gọi hotline ${SHOP_HOTLINE} hoặc nhắn Zalo để đặt hàng.`;

/**
 * Lấy thông báo tiếng Việt từ lỗi Supabase (mã lỗi nằm trong message).
 * @param {{ message?: string }|null} error
 * @returns {string}
 */
export function parseApiError(error) {
  const text = error && typeof error.message === 'string' ? error.message : '';
  const code = Object.keys(ERROR_MESSAGES).find(key => text.includes(key));
  return code ? ERROR_MESSAGES[code] : GENERIC_ERROR;
}

/**
 * Chuyển các dòng trong giỏ hàng thành dữ liệu gửi lên máy chủ (không gồm giá).
 * @param {Array<{ product: { id: string }, quantity: number, color?: string, storage?: string }>} cartItems
 */
export function buildOrderItems(cartItems) {
  return (Array.isArray(cartItems) ? cartItems : [])
    .filter(item => item && item.product && item.product.id)
    .map(item => ({
      id: String(item.product.id),
      quantity: Math.max(1, Math.floor(Number(item.quantity)) || 1),
      color: item.color || '',
      storage: item.storage || ''
    }));
}

async function resolveClient(options) {
  // Truyền client tường minh (kể cả null = coi như chưa cấu hình) dùng cho kiểm thử, không đụng mạng thật
  if (options && 'client' in options) return options.client || null;
  if (!isSupabaseConfigured()) return null;
  return getSupabase();
}

/**
 * Gửi đơn hàng.
 * @returns {Promise<{ ok: true, code: string, total: number } | { ok: false, reason: string, message: string }>}
 */
export async function submitOrder({ name, phone, address, note, items, voucher } = {}, options = {}) {
  const client = await resolveClient(options);
  if (!client) return { ok: false, reason: 'not_configured', message: NOT_CONFIGURED };

  try {
    const { data, error } = await client.rpc('create_order', {
      p_name: name || '',
      p_phone: phone || '',
      p_address: address || '',
      p_note: note || null,
      p_items: items || [],
      p_voucher: voucher || null
    });
    if (error) return { ok: false, reason: 'rejected', message: parseApiError(error) };

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.order_code) return { ok: false, reason: 'error', message: GENERIC_ERROR };
    return { ok: true, code: row.order_code, total: Number(row.order_total) || 0 };
  } catch (err) {
    return { ok: false, reason: 'network', message: GENERIC_ERROR };
  }
}

/**
 * Gửi lịch hẹn sửa chữa.
 * @returns {Promise<{ ok: true, code: string } | { ok: false, reason: string, message: string }>}
 */
export async function submitBooking({ name, phone, device, service, note } = {}, options = {}) {
  const client = await resolveClient(options);
  if (!client) return { ok: false, reason: 'not_configured', message: NOT_CONFIGURED };

  try {
    const { data, error } = await client.rpc('create_booking', {
      p_name: name || '',
      p_phone: phone || '',
      p_device: device || '',
      p_service: service || '',
      p_note: note || null
    });
    if (error) return { ok: false, reason: 'rejected', message: parseApiError(error) };

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.booking_code) return { ok: false, reason: 'error', message: GENERIC_ERROR };
    return { ok: true, code: row.booking_code };
  } catch (err) {
    return { ok: false, reason: 'network', message: GENERIC_ERROR };
  }
}
