/**
 * Tien Mobile - Thu cũ: kiểm tra biểu mẫu báo giá và đổi sang dữ liệu lịch hẹn (testable trong Node).
 * Biểu mẫu được lưu như một lịch hẹn (create_booking) với dịch vụ "Thu cũ - báo giá".
 */

import { normalizePhone } from './warranty.js';

export const TRADE_IN_SERVICE = 'Thu cũ - báo giá';

export const TRADE_IN_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Khác'];
export const TRADE_IN_STORAGES = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'];
export const TRADE_IN_CONDITIONS = [
  'Như mới, không trầy',
  'Trầy xước nhẹ',
  'Cấn móp, trầy nhiều',
  'Lỗi màn hình',
  'Lỗi khác / không lên nguồn'
];

const text = (value) => String(value ?? '').trim();

/**
 * @returns {{ valid: boolean, errors: string[], phone: string }}
 */
export function validateTradeIn(data) {
  const d = data && typeof data === 'object' ? data : {};
  const errors = [];
  const phone = normalizePhone(d.phone);
  if (!TRADE_IN_BRANDS.includes(text(d.brand))) errors.push('Vui lòng chọn hãng máy.');
  if (!text(d.model)) errors.push('Vui lòng nhập dòng máy (ví dụ iPhone 13 Pro).');
  if (!TRADE_IN_STORAGES.includes(text(d.storage))) errors.push('Vui lòng chọn dung lượng.');
  if (!TRADE_IN_CONDITIONS.includes(text(d.condition))) errors.push('Vui lòng chọn tình trạng máy.');
  if (text(d.battery) !== '') {
    const battery = Number(d.battery);
    if (!Number.isInteger(battery) || battery < 1 || battery > 100) errors.push('Sức khỏe pin phải từ 1 đến 100%.');
  }
  if (!text(d.name)) errors.push('Vui lòng nhập họ tên.');
  if (!phone) errors.push('Số điện thoại không hợp lệ (cần 10 chữ số).');
  return { valid: errors.length === 0, errors, phone };
}

/**
 * Chuyển biểu mẫu đã hợp lệ thành tham số của submitBooking.
 */
export function buildTradeInBooking(data) {
  const parts = [
    `Hãng: ${text(data.brand)}`,
    `Dung lượng: ${text(data.storage)}`,
    `Tình trạng: ${text(data.condition)}`
  ];
  if (text(data.battery) !== '') parts.push(`Pin: ${Number(data.battery)}%`);
  parts.push(`Đủ hộp/phụ kiện: ${data.accessories ? 'có' : 'không'}`);
  if (text(data.note)) parts.push(`Ghi chú: ${text(data.note)}`);

  return {
    name: text(data.name).slice(0, 100),
    phone: normalizePhone(data.phone),
    device: `Thu cũ: ${text(data.model)}`.slice(0, 100),
    service: TRADE_IN_SERVICE,
    note: parts.join(' | ').slice(0, 500)
  };
}
