/**
 * Tien Mobile - Trả góp: tính tiền góp ước tính, kiểm tra biểu mẫu đăng ký, nhãn trạng thái cho trang quản trị.
 * Thuần logic (không DOM) để kiểm thử trong Node.
 */

import { normalizePhone } from './warranty.js';

/**
 * Lãi suất ước tính mỗi tháng (tính trên dư nợ gốc ban đầu). 0 = chỉ chia đều tiền vay.
 * Phải trùng với hàm installment_monthly() trong supabase/installment.sql.
 */
export const INSTALLMENT_MONTHLY_RATE = 0;

export const INSTALLMENT_TERMS = [3, 6, 9, 12, 18, 24];
export const INSTALLMENT_METHODS = ['Công ty tài chính', 'Thẻ tín dụng', 'Trả góp tại cửa hàng'];
export const INSTALLMENT_OCCUPATIONS = ['Nhân viên văn phòng', 'Công nhân', 'Kinh doanh tự do', 'Sinh viên', 'Khác'];
export const INSTALLMENT_DOCUMENTS = [
  'CCCD / CMND',
  'Bằng lái xe',
  'Sổ hộ khẩu / KT3',
  'Hợp đồng lao động / bảng lương',
  'Sao kê ngân hàng',
  'Hóa đơn điện / nước'
];

export const INSTALLMENT_MAX_PRICE = 200000000;

export const INSTALLMENT_STATUSES = [
  ['new', 'Mới'],
  ['reviewing', 'Đang xét hồ sơ'],
  ['approved', 'Đã duyệt'],
  ['rejected', 'Từ chối'],
  ['cancelled', 'Đã hủy']
];

const text = (value) => String(value ?? '').trim();
const toInt = (value) => {
  const cleaned = String(value ?? '').replace(/[\s.,]/g, '');
  return /^\d+$/.test(cleaned) ? Number(cleaned) : NaN;
};

export function installmentStatusLabel(status) {
  const found = INSTALLMENT_STATUSES.find(([key]) => key === status);
  return found ? found[1] : String(status ?? '');
}

/**
 * Tiền góp mỗi tháng ước tính: (vay / số tháng) + vay * lãi tháng, làm tròn lên nghìn đồng.
 * @returns {{ valid: boolean, loan: number, monthly: number, total: number }}
 */
export function calcInstallment({ price, downPayment, term } = {}, rate = INSTALLMENT_MONTHLY_RATE) {
  const p = toInt(price);
  const d = text(downPayment) === '' ? 0 : toInt(downPayment);
  const t = Number(term);
  const empty = { valid: false, loan: 0, monthly: 0, total: 0 };
  if (!Number.isFinite(p) || !Number.isFinite(d) || !INSTALLMENT_TERMS.includes(t)) return empty;
  if (p <= 0 || p > INSTALLMENT_MAX_PRICE || d < 0 || d >= p) return empty;
  const loan = p - d;
  const monthly = Math.ceil((loan / t + loan * rate) / 1000) * 1000;
  return { valid: true, loan, monthly, total: d + monthly * t };
}

/**
 * @returns {{ valid: boolean, errors: string[], phone: string }}
 */
export function validateInstallment(data) {
  const d = data && typeof data === 'object' ? data : {};
  const errors = [];
  const phone = normalizePhone(d.phone);
  const price = toInt(d.price);
  const down = text(d.downPayment) === '' ? 0 : toInt(d.downPayment);

  if (!text(d.product)) errors.push('Vui lòng nhập máy muốn mua trả góp (ví dụ iPhone 15 Pro Max).');
  if (!Number.isFinite(price) || price <= 0) errors.push('Vui lòng nhập giá máy dự kiến.');
  else if (price > INSTALLMENT_MAX_PRICE) errors.push('Giá máy vượt mức hỗ trợ, vui lòng gọi hotline để được tư vấn.');
  if (!Number.isFinite(down) || down < 0) errors.push('Số tiền trả trước không hợp lệ.');
  else if (Number.isFinite(price) && price > 0 && down >= price) errors.push('Số tiền trả trước phải nhỏ hơn giá máy.');
  if (!INSTALLMENT_TERMS.includes(Number(d.term))) errors.push('Vui lòng chọn kỳ hạn trả góp.');
  if (!INSTALLMENT_METHODS.includes(text(d.method))) errors.push('Vui lòng chọn hình thức trả góp.');
  if (!INSTALLMENT_OCCUPATIONS.includes(text(d.occupation))) errors.push('Vui lòng chọn nghề nghiệp.');
  const docs = Array.isArray(d.documents) ? d.documents : [];
  if (docs.some(doc => !INSTALLMENT_DOCUMENTS.includes(doc))) errors.push('Danh sách hồ sơ không hợp lệ.');
  if (!text(d.name)) errors.push('Vui lòng nhập họ tên.');
  if (!phone) errors.push('Số điện thoại không hợp lệ (cần 10 chữ số).');
  return { valid: errors.length === 0, errors, phone };
}

/**
 * Tham số gửi lên hàm create_installment (giá trị tiền là số nguyên đồng).
 */
export function buildInstallmentPayload(data) {
  const price = toInt(data.price);
  const down = text(data.downPayment) === '' ? 0 : toInt(data.downPayment);
  const docs = (Array.isArray(data.documents) ? data.documents : []).filter(doc => INSTALLMENT_DOCUMENTS.includes(doc));
  return {
    name: text(data.name).slice(0, 100),
    phone: normalizePhone(data.phone),
    product: text(data.product).slice(0, 100),
    price,
    downPayment: down,
    term: Number(data.term),
    method: text(data.method),
    occupation: text(data.occupation),
    documents: docs.join(', ').slice(0, 300),
    note: text(data.note).slice(0, 500)
  };
}

/**
 * Lọc danh sách hồ sơ cho trang quản trị theo trạng thái và từ khóa.
 */
export function filterInstallments(list, { status = 'all', query = '' } = {}) {
  const q = text(query).toLowerCase();
  return (Array.isArray(list) ? list : []).filter(r => {
    if (status !== 'all' && r.status !== status) return false;
    if (!q) return true;
    return [r.code, r.customer_name, r.phone, r.product].some(v => String(v ?? '').toLowerCase().includes(q));
  });
}
