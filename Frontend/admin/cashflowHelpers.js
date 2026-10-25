/**
 * Tien Mobile - Sổ thu chi: kiểm tra khoản nhập, lọc theo tháng, thống kê thu / chi / lợi nhuận.
 * Thuần logic (không DOM) để kiểm thử trong Node.
 */

import { parseMoney } from '../js/installment.js';

export const CASHFLOW_KINDS = [['in', 'Thu'], ['out', 'Chi']];
export const CATEGORIES_IN = ['Bán máy', 'Sửa chữa', 'Trả góp', 'Phụ kiện', 'Khác'];
export const CATEGORIES_OUT = ['Nhập hàng', 'Linh kiện sửa chữa', 'Mặt bằng', 'Lương', 'Điện nước', 'Marketing', 'Khác'];

const text = (value) => String(value ?? '').trim();

export function categoriesFor(kind) {
  return kind === 'out' ? CATEGORIES_OUT : CATEGORIES_IN;
}

/** @returns {{ valid: boolean, errors: string[], row: object|null }} */
export function validateEntry(data) {
  const d = data && typeof data === 'object' ? data : {};
  const errors = [];
  const kind = text(d.kind);
  const amount = parseMoney(d.amount);
  const category = text(d.category);
  const date = text(d.date);
  if (!['in', 'out'].includes(kind)) errors.push('Chọn thu hoặc chi.');
  if (!Number.isFinite(amount) || amount <= 0) errors.push('Số tiền phải lớn hơn 0.');
  else if (amount > 100000000000) errors.push('Số tiền quá lớn.');
  if (!category) errors.push('Chọn nhóm.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Ngày không hợp lệ.');
  if (errors.length) return { valid: false, errors, row: null };
  return {
    valid: true,
    errors,
    row: {
      kind,
      amount,
      category: category.slice(0, 60),
      note: text(d.note).slice(0, 300) || null,
      entry_date: date,
      ref_code: text(d.refCode).slice(0, 30) || null
    }
  };
}

/** "2026-10" cho tháng của một ngày YYYY-MM-DD, rỗng nếu sai. */
export function monthKey(date) {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(text(date));
  return m ? `${m[1]}-${m[2]}` : '';
}

/** Danh sách tháng có dữ liệu (mới nhất trước), luôn gồm tháng hiện tại. */
export function monthOptions(entries, currentMonth) {
  const set = new Set((Array.isArray(entries) ? entries : []).map(e => monthKey(e.entry_date)).filter(Boolean));
  if (currentMonth) set.add(currentMonth);
  return [...set].sort().reverse();
}

/** month = 'YYYY-MM' hoặc 'all'; kind = 'in' | 'out' | 'all'. */
export function filterEntries(entries, { month = 'all', kind = 'all' } = {}) {
  return (Array.isArray(entries) ? entries : []).filter(e => {
    if (!e) return false;
    if (month !== 'all' && monthKey(e.entry_date) !== month) return false;
    if (kind !== 'all' && e.kind !== kind) return false;
    return true;
  });
}

/**
 * @returns {{ totalIn: number, totalOut: number, profit: number, countIn: number, countOut: number,
 *             byCategory: { in: Array<[string, number]>, out: Array<[string, number]> } }}
 */
export function summarize(entries) {
  const out = { totalIn: 0, totalOut: 0, profit: 0, countIn: 0, countOut: 0, byCategory: { in: [], out: [] } };
  const maps = { in: new Map(), out: new Map() };
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || (e.kind !== 'in' && e.kind !== 'out')) continue;
    const amount = Number(e.amount) || 0;
    if (e.kind === 'in') { out.totalIn += amount; out.countIn += 1; } else { out.totalOut += amount; out.countOut += 1; }
    maps[e.kind].set(e.category, (maps[e.kind].get(e.category) || 0) + amount);
  }
  out.profit = out.totalIn - out.totalOut;
  for (const kind of ['in', 'out']) out.byCategory[kind] = [...maps[kind].entries()].sort((a, b) => b[1] - a[1]);
  return out;
}

/** Danh mục gợi ý khi ghi thu từ hóa đơn theo loại phiếu. */
export function categoryForInvoice(type) {
  return { order: 'Bán máy', booking: 'Sửa chữa', warranty: 'Sửa chữa', installment: 'Trả góp' }[type] || 'Khác';
}
