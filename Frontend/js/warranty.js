/**
 * Tien Mobile - Warranty pure helpers (dùng chung cho website và trang quản trị, testable trong Node)
 */

const PHONE_RE = /^0[35789][0-9]{8}$/;

/**
 * Chuẩn hóa số điện thoại Việt Nam về dạng 0xxxxxxxxx.
 * @param {string} input
 * @returns {string} số hợp lệ hoặc chuỗi rỗng
 */
export function normalizePhone(input) {
  const cleaned = String(input ?? '').replace(/[\s.-]/g, '').replace(/^\+?84/, '0');
  return PHONE_RE.test(cleaned) ? cleaned : '';
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Cộng số tháng vào một ngày (YYYY-MM-DD). Ngày cuối tháng được giữ trong tháng
 * đích (31/01 + 1 tháng = 28/02 hoặc 29/02), giống phép cộng tháng của PostgreSQL.
 * @returns {string} YYYY-MM-DD, hoặc rỗng nếu đầu vào sai
 */
export function addMonths(startDate, months) {
  const start = parseDate(startDate);
  const n = Math.floor(Number(months));
  if (!start || !isFinite(n)) return '';
  const total = start.getUTCFullYear() * 12 + start.getUTCMonth() + n;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay))));
}

/**
 * Tình trạng bảo hành tại một ngày. Còn hạn đến hết ngày kết thúc.
 * @param {string} startDate YYYY-MM-DD
 * @param {number} months
 * @param {string} [today] YYYY-MM-DD, mặc định hôm nay
 * @returns {{ endDate: string, active: boolean, daysLeft: number }}
 */
export function warrantyInfo(startDate, months, today = toIso(new Date())) {
  const endDate = addMonths(startDate, months);
  const end = parseDate(endDate);
  const now = parseDate(today);
  if (!end || !now) return { endDate: '', active: false, daysLeft: 0 };
  const diff = Math.round((end - now) / 86400000);
  return { endDate, active: diff >= 0, daysLeft: Math.max(0, diff) };
}

/**
 * YYYY-MM-DD -> DD/MM/YYYY, rỗng nếu không hợp lệ.
 */
export function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

/**
 * Kiểm tra dữ liệu phiếu bảo hành trước khi lưu.
 * @returns {{ valid: boolean, errors: string[], phone: string }}
 */
export function validateWarranty(data) {
  const errors = [];
  const d = data && typeof data === 'object' ? data : {};
  const phone = normalizePhone(d.phone);
  if (!String(d.customer_name ?? '').trim()) errors.push('Vui lòng nhập tên khách hàng.');
  if (!phone) errors.push('Số điện thoại không hợp lệ (cần 10 chữ số).');
  if (!String(d.device ?? '').trim()) errors.push('Vui lòng nhập tên máy.');
  if (!String(d.service ?? '').trim()) errors.push('Vui lòng nhập nội dung sửa chữa.');
  const months = Number(d.warranty_months);
  if (!Number.isInteger(months) || months < 1 || months > 60) errors.push('Thời gian bảo hành phải từ 1 đến 60 tháng.');
  if (!parseDate(d.start_date)) errors.push('Ngày bắt đầu bảo hành không hợp lệ.');
  return { valid: errors.length === 0, errors, phone };
}

/**
 * Lọc phiếu theo từ khóa (mã, tên, số điện thoại, máy) và trạng thái.
 * @param {Array<object>} records
 * @param {{ query?: string, status?: 'all'|'active'|'expired', today?: string }} [opts]
 */
export function filterWarranties(records, { query = '', status = 'all', today } = {}) {
  const q = String(query).trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  return (Array.isArray(records) ? records : []).filter(r => {
    if (!r) return false;
    if (status !== 'all') {
      const info = warrantyInfo(r.start_date, r.warranty_months, today);
      if ((status === 'active') !== info.active) return false;
    }
    if (!q) return true;
    const text = [r.code, r.customer_name, r.device, r.service].filter(Boolean).join(' ').toLowerCase();
    return text.includes(q) || (digits.length >= 3 && String(r.phone ?? '').includes(digits));
  });
}
