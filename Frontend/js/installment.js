/**
 * Tien Mobile - Trả góp: công thức tính, kiểm tra hồ sơ do cửa hàng nhập, hiển thị tra cứu.
 * Thuần logic (không DOM) để kiểm thử trong Node. Công thức phải trùng hàm trigger trong supabase/installment.sql.
 *
 *   khoản vay      = giá gốc - trả trước
 *   tiền góp/tháng = làm tròn lên nghìn của (khoản vay / số tháng + khoản vay * lãi%/tháng)
 *   thành tiền     = trả trước + tiền góp/tháng * số tháng
 */

import { normalizePhone, addMonths } from './warranty.js';

/** Lãi suất tham khảo (%/tháng) điền sẵn ở máy tính tư vấn trên website. 0 = chỉ chia đều. */
export const INSTALLMENT_REFERENCE_RATE = 0;

export const INSTALLMENT_MAX_PRICE = 500000000;
export const INSTALLMENT_MAX_TERM = 60;
export const INSTALLMENT_PAY_METHODS = ['Tiền mặt', 'Chuyển khoản', 'Quẹt thẻ', 'Công ty tài chính'];
export const INSTALLMENT_DOCUMENTS = [
  'CCCD / CMND',
  'Bằng lái xe',
  'Sổ hộ khẩu / KT3',
  'Hợp đồng lao động / bảng lương',
  'Sao kê ngân hàng',
  'Hóa đơn điện / nước'
];
export const INSTALLMENT_STATUSES = [
  ['active', 'Đang góp'],
  ['completed', 'Đã tất toán'],
  ['cancelled', 'Đã hủy']
];

const text = (value) => String(value ?? '').trim();

/** "30.000.000" / "30000000" -> 30000000, sai -> NaN. */
export function parseMoney(value) {
  const cleaned = String(value ?? '').replace(/[\s.,đ₫]/gi, '');
  return /^\d+$/.test(cleaned) ? Number(cleaned) : NaN;
}

/** "1,5" / "1.5" -> 1.5, sai -> NaN. */
export function parseRate(value) {
  const raw = text(value).replace(',', '.').replace('%', '');
  if (raw === '') return 0;
  return /^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw) : NaN;
}

export function installmentStatusLabel(status) {
  const found = INSTALLMENT_STATUSES.find(([key]) => key === status);
  return found ? found[1] : String(status ?? '');
}

/**
 * @param {{ price: *, downPayment?: *, rate?: *, term: * }} input giá gốc, trả trước, lãi %/tháng, số tháng
 * @returns {{ valid: boolean, loan: number, interest: number, monthly: number, total: number }}
 */
export function calcInstallment({ price, downPayment, rate, term } = {}) {
  const empty = { valid: false, loan: 0, interest: 0, monthly: 0, total: 0 };
  const p = parseMoney(price);
  const d = text(downPayment) === '' ? 0 : parseMoney(downPayment);
  const r = parseRate(rate);
  const t = Number(term);
  if (!Number.isFinite(p) || !Number.isFinite(d) || !Number.isFinite(r)) return empty;
  if (!Number.isInteger(t) || t < 1 || t > INSTALLMENT_MAX_TERM) return empty;
  if (p <= 0 || p > INSTALLMENT_MAX_PRICE || d < 0 || d >= p || r < 0 || r > 100) return empty;
  const loan = p - d;
  const monthly = Math.ceil((loan / t + (loan * r) / 100) / 1000) * 1000;
  const total = d + monthly * t;
  return { valid: true, loan, interest: monthly * t - loan, monthly, total };
}

/**
 * Kiểm tra hồ sơ cửa hàng nhập ở trang quản trị.
 * @returns {{ valid: boolean, errors: string[], phone: string }}
 */
export function validateInstallmentRecord(data) {
  const d = data && typeof data === 'object' ? data : {};
  const errors = [];
  const phone = normalizePhone(d.phone);
  const price = parseMoney(d.price);
  const down = text(d.downPayment) === '' ? 0 : parseMoney(d.downPayment);
  const rate = parseRate(d.rate);
  const term = Number(d.term);

  if (!text(d.name)) errors.push('Vui lòng nhập tên khách hàng.');
  if (!phone) errors.push('Số điện thoại không hợp lệ (cần 10 chữ số).');
  if (!text(d.product)) errors.push('Vui lòng nhập tên máy.');
  if (!Number.isFinite(price) || price <= 0) errors.push('Vui lòng nhập giá gốc.');
  else if (price > INSTALLMENT_MAX_PRICE) errors.push('Giá gốc vượt mức cho phép.');
  if (!Number.isFinite(down) || down < 0) errors.push('Số tiền trả trước không hợp lệ.');
  else if (Number.isFinite(price) && price > 0 && down >= price) errors.push('Trả trước phải nhỏ hơn giá gốc.');
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) errors.push('Lãi suất phải từ 0 đến 100 (%/tháng).');
  if (!Number.isInteger(term) || term < 1 || term > INSTALLMENT_MAX_TERM) errors.push(`Kỳ hạn phải từ 1 đến ${INSTALLMENT_MAX_TERM} tháng.`);
  if (!INSTALLMENT_PAY_METHODS.includes(text(d.payMethod))) errors.push('Vui lòng chọn hình thức trả.');
  const docs = Array.isArray(d.documents) ? d.documents : [];
  if (docs.some(doc => !INSTALLMENT_DOCUMENTS.includes(doc))) errors.push('Danh sách giấy tờ không hợp lệ.');
  if (text(d.startDate) && !/^\d{4}-\d{2}-\d{2}$/.test(text(d.startDate))) errors.push('Ngày bắt đầu không hợp lệ.');
  const paid = text(d.paidMonths) === '' ? 0 : Number(d.paidMonths);
  if (!Number.isInteger(paid) || paid < 0 || (Number.isInteger(term) && paid > term)) errors.push('Số kỳ đã đóng không hợp lệ.');
  return { valid: errors.length === 0, errors, phone };
}

/**
 * Chuyển biểu mẫu đã hợp lệ thành dòng của bảng installments (thành tiền do cơ sở dữ liệu tự tính).
 */
export function buildInstallmentRow(data) {
  const docs = (Array.isArray(data.documents) ? data.documents : []).filter(doc => INSTALLMENT_DOCUMENTS.includes(doc));
  return {
    customer_name: text(data.name).slice(0, 100),
    phone: normalizePhone(data.phone),
    product: text(data.product).slice(0, 100),
    original_price: parseMoney(data.price),
    down_payment: text(data.downPayment) === '' ? 0 : parseMoney(data.downPayment),
    interest_rate: parseRate(data.rate),
    term_months: Number(data.term),
    pay_method: text(data.payMethod),
    documents: docs.length ? docs.join(', ').slice(0, 300) : null,
    note: text(data.note).slice(0, 500) || null,
    start_date: text(data.startDate) || undefined,
    paid_months: text(data.paidMonths) === '' ? 0 : Number(data.paidMonths)
  };
}

/** Ngày đến hạn kỳ tiếp theo (YYYY-MM-DD), rỗng nếu đã đóng đủ hoặc dữ liệu sai. */
export function nextDueDate(startDate, paidMonths, termMonths) {
  const paid = Number(paidMonths);
  if (!Number.isInteger(paid) || paid >= Number(termMonths)) return '';
  return addMonths(startDate, paid + 1);
}

/**
 * Lọc hồ sơ cho trang quản trị theo trạng thái và từ khóa (mã, tên, số điện thoại, máy).
 */
export function filterInstallments(list, { status = 'all', query = '' } = {}) {
  const q = text(query).toLowerCase();
  return (Array.isArray(list) ? list : []).filter(r => {
    if (!r) return false;
    if (status !== 'all' && r.status !== status) return false;
    if (!q) return true;
    return [r.code, r.customer_name, r.phone, r.product].some(v => String(v ?? '').toLowerCase().includes(q));
  });
}
