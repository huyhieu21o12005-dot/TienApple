/**
 * Tien Mobile - Soạn tin gửi qua Zalo cửa hàng (ưu đãi sửa chữa). Thuần logic, kiểm thử trong Node.
 * Zalo không cho điền sẵn nội dung qua đường dẫn, nên trang sao chép tin vào clipboard rồi mở khung chat Zalo.
 */

import { normalizePhone } from './warranty.js';

export const ZALO_PHONE = '0986455457';
export const ZALO_URL = `https://zalo.me/${ZALO_PHONE}`;

const text = (value) => String(value ?? '').trim();

/**
 * @returns {{ valid: boolean, errors: string[], phone: string }}
 */
export function validateZaloOffer(data) {
  const d = data && typeof data === 'object' ? data : {};
  const errors = [];
  const phone = normalizePhone(d.phone);
  if (!text(d.name)) errors.push('Vui lòng nhập họ tên.');
  if (!phone) errors.push('Số điện thoại không hợp lệ (cần 10 chữ số).');
  if (!text(d.device)) errors.push('Vui lòng nhập dòng điện thoại.');
  if (!text(d.service)) errors.push('Vui lòng chọn dịch vụ sửa chữa.');
  return { valid: errors.length === 0, errors, phone };
}

/**
 * Nội dung tin nhắn để khách dán vào Zalo.
 */
export function buildZaloMessage(data) {
  const lines = [
    'ƯU ĐÃI SỬA CHỮA GIẢM 10% - TIEN MOBILE',
    `Họ tên: ${text(data.name).slice(0, 100)}`,
    `SĐT: ${normalizePhone(data.phone) || text(data.phone)}`,
    `Máy: ${text(data.device).slice(0, 100)}`,
    `Dịch vụ: ${text(data.service).slice(0, 100)}`
  ];
  if (text(data.note)) lines.push(`Tình trạng: ${text(data.note).slice(0, 300)}`);
  lines.push('Mình muốn nhận ưu đãi giảm 10%, shop tư vấn giúp mình nhé.');
  return lines.join('\n');
}

/**
 * Tham số gửi lên create_booking khi khách nhận ưu đãi (lưu vào quản trị và báo Telegram).
 */
export function buildOfferBooking(data) {
  const note = ['Ưu đãi sửa chữa giảm 10% (form ưu đãi)'];
  if (text(data.note)) note.push(`Tình trạng: ${text(data.note)}`);
  return {
    name: text(data.name).slice(0, 100),
    phone: normalizePhone(data.phone),
    device: text(data.device).slice(0, 100),
    service: text(data.service).slice(0, 100),
    note: note.join(' | ').slice(0, 500)
  };
}
