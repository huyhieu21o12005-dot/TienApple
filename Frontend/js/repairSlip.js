/**
 * Tien Mobile - Phiếu hẹn sửa chữa (web) và phiếu lấy máy (quản trị).
 * Hai phiếu dùng chung một nguồn: cùng mã SC, cùng thông tin khách và máy; chỉ khác tiêu đề, ghi chú và chữ ký.
 */
import { escapeHtml } from './utils.js';
import { SHOP_INFO, shopHeadHtml } from './shopInfo.js';
import { formatDateTime } from '../admin/ordersHelpers.js';

const KINDS = {
  appointment: {
    title: 'PHIẾU HẸN SỬA CHỮA',
    notes: [
      'Vui lòng mang phiếu này khi đến cửa hàng.',
      'Kỹ thuật viên sẽ gọi xác nhận lịch hẹn với quý khách.',
      'Giờ làm việc: 7h - 21h (T2 - CN).'
    ],
    signatures: ['Khách hàng', 'Cửa hàng']
  },
  pickup: {
    title: 'PHIẾU LẤY MÁY',
    notes: [
      'Quý khách đã nhận lại máy và kiểm tra tình trạng hoạt động.',
      'Bảo hành theo phiếu bảo hành kèm theo (nếu có).'
    ],
    signatures: ['Khách hàng', 'Kỹ thuật viên']
  }
};

/** Các dòng về máy, dùng chung cho phiếu hẹn và phiếu lấy máy. */
export function slipMachineRows(r) {
  const rows = [['Thiết bị', String(r?.device ?? '')], ['Dịch vụ', String(r?.service ?? '')]];
  if (r?.note) rows.push(['Ghi chú', String(r.note)]);
  return rows;
}

/** Toàn bộ dòng thông tin của một phiếu: mã, khách, điện thoại, máy. */
export function slipRows(r) {
  return [
    ['Mã phiếu', String(r?.code ?? '')],
    ['Khách hàng', String(r?.customer_name ?? '')],
    ['Điện thoại', String(r?.phone ?? '')],
    ...slipMachineRows(r)
  ];
}

export function slipNotes(kind) {
  return KINDS[kind] ? [...KINDS[kind].notes] : [];
}

export function slipSignatures(kind) {
  return KINDS[kind] ? [...KINDS[kind].signatures] : [];
}

/** @returns {{ kind: string, title: string, code: string, dateText: string, rows: string[][], notes: string[], signatures: string[] } | null} */
export function buildRepairSlip(kind, record) {
  const def = KINDS[kind];
  if (!def || !record || typeof record !== 'object') return null;
  return {
    kind,
    title: def.title,
    code: String(record.code ?? ''),
    dateText: formatDateTime(record.created_at),
    rows: slipRows(record),
    notes: [...def.notes],
    signatures: [...def.signatures]
  };
}

/** HTML của phiếu (mọi chuỗi đã escape), dùng cho hộp phiếu hẹn trên web. */
export function repairSlipHtml(slip, shop = SHOP_INFO) {
  if (!slip) return '';
  const rows = slip.rows.map(([k, v]) => `<div class="slip-row"><span class="slip-k">${escapeHtml(k)}</span><span class="slip-v">${escapeHtml(v)}</span></div>`).join('');
  const notes = slip.notes.map(n => `<p class="slip-note">${escapeHtml(n)}</p>`).join('');
  const signs = slip.signatures.map(s => `<div class="slip-sign"><span>${escapeHtml(s)}</span></div>`).join('');
  return `<div class="slip">
    ${shopHeadHtml(shop)}
    <div class="slip-title">${escapeHtml(slip.title)}</div>
    <div class="slip-meta">${escapeHtml(slip.dateText)}</div>
    <div class="slip-rows">${rows}</div>
    ${notes}
    <div class="slip-signs">${signs}</div>
  </div>`;
}
