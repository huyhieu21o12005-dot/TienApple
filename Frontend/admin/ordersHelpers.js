/**
 * Tien Mobile - Admin Orders pure helpers (testable in Node, không phụ thuộc DOM)
 */

export const ORDER_STATUSES = [
  { value: 'new', label: 'Mới' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'shipping', label: 'Đang giao' },
  { value: 'done', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' }
];

export const BOOKING_STATUSES = [
  { value: 'new', label: 'Mới' },
  { value: 'confirmed', label: 'Đã hẹn' },
  { value: 'in_progress', label: 'Đang sửa' },
  { value: 'done', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' }
];

/**
 * @param {'orders'|'bookings'} kind
 * @returns {Array<{ value: string, label: string }>}
 */
export function statusesFor(kind) {
  return kind === 'bookings' ? BOOKING_STATUSES : ORDER_STATUSES;
}

/**
 * Nhãn tiếng Việt của trạng thái, trả lại chính giá trị nếu không biết.
 */
export function statusLabel(kind, value) {
  const found = statusesFor(kind).find(s => s.value === value);
  return found ? found.label : String(value ?? '');
}

/**
 * Đếm số bản ghi theo trạng thái, kèm tổng với khoá 'all'.
 * @param {Array<{ status: string }>} records
 * @returns {Record<string, number>}
 */
export function countByStatus(records) {
  const counts = { all: 0 };
  for (const r of Array.isArray(records) ? records : []) {
    if (!r) continue;
    counts.all++;
    counts[r.status] = (counts[r.status] || 0) + 1;
  }
  return counts;
}

/**
 * Lọc theo trạng thái và từ khoá (mã, tên, số điện thoại, thiết bị).
 */
export function filterRecords(records, { status = 'all', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  return (Array.isArray(records) ? records : []).filter(r => {
    if (!r) return false;
    if (status !== 'all' && r.status !== status) return false;
    if (!q) return true;
    const text = [r.code, r.customer_name, r.device, r.service].filter(Boolean).join(' ').toLowerCase();
    return text.includes(q) || (digits.length >= 3 && String(r.phone || '').includes(digits));
  });
}

/**
 * Tóm tắt các dòng hàng: "iPhone 16 Pro x1, Sạc 30W x2".
 */
export function summarizeItems(items, maxLines = 3) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) return '';
  const shown = list.slice(0, maxLines).map(i => `${i.name || i.id} x${Number(i.quantity) || 1}`);
  const more = list.length - shown.length;
  return shown.join(', ') + (more > 0 ? ` và ${more} sản phẩm khác` : '');
}

/**
 * Ngày giờ theo định dạng Việt Nam, rỗng nếu không hợp lệ.
 */
export function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Đường dẫn gọi điện, chỉ giữ chữ số.
 */
export function telHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `tel:${digits}` : '';
}
