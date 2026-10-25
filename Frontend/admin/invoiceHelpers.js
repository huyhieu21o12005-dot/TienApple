/**
 * Tien Mobile - Hóa đơn / phiếu in cho từng mục (đơn hàng, lịch sửa chữa, bảo hành, trả góp).
 * Thuần logic để kiểm thử trong Node: buildInvoice() tạo cấu trúc, invoiceHtml() dựng HTML đã escape.
 */

import { escapeHtml } from '../js/utils.js';
import { formatDate, addMonths } from '../js/warranty.js';
import { formatCurrency } from './adminHelpers.js';
import { formatDateTime } from './ordersHelpers.js';
import { installmentStatusLabel, nextDueDate } from '../js/installment.js';

export const SHOP = {
  name: 'TIEN MOBILE THU DUC',
  tagline: 'Điện thoại chính hãng & Sửa chữa lấy ngay',
  hotline: '0986 455 457 - 0933 266 179',
  website: 'tienappletd.com',
  hours: '7h - 21h (T2 - CN)'
};

export const INVOICE_TYPES = ['order', 'booking', 'warranty', 'installment'];

/** Bảng và tên bảng Supabase của từng loại hóa đơn. */
export const INVOICE_TABLES = {
  order: 'orders',
  booking: 'repair_bookings',
  warranty: 'warranties',
  installment: 'installments'
};

const SIGNATURES = {
  order: ['Khách hàng', 'Người bán'],
  booking: ['Khách hàng', 'Kỹ thuật viên'],
  warranty: ['Khách hàng', 'Cửa hàng'],
  installment: ['Khách hàng ký, ghi rõ họ tên', 'Cửa hàng']
};

const pct = (n) => `${String(Number(n) || 0).replace('.', ',')}%`;

function customerRows(r) {
  const rows = [['Khách hàng', r.customer_name], ['Điện thoại', r.phone]];
  if (r.address) rows.push(['Địa chỉ', r.address]);
  return rows;
}

/**
 * @param {'order'|'booking'|'warranty'|'installment'} type
 * @param {object} r bản ghi lấy từ Supabase
 * @returns {{ title: string, code: string, dateText: string, customer: string[][], items: object[], sections: Array<{ heading: string, rows: string[][] }>, totals: Array<[string, string, boolean?]>, notes: string[], signatures: string[] } | null}
 */
export function buildInvoice(type, r) {
  if (!INVOICE_TYPES.includes(type) || !r || typeof r !== 'object') return null;
  const base = {
    code: String(r.code || ''),
    dateText: formatDateTime(r.created_at),
    customer: customerRows(r),
    items: [],
    sections: [],
    totals: [],
    notes: [],
    signatures: SIGNATURES[type]
  };

  if (type === 'order') {
    const items = (Array.isArray(r.items) ? r.items : []).map(i => {
      const qty = Number(i.quantity) || 1;
      const price = Number(i.price) || 0;
      return {
        name: String(i.name || i.id || ''),
        detail: [i.color, i.storage].filter(Boolean).join(' / '),
        qty,
        price: formatCurrency(price),
        amount: formatCurrency(price * qty)
      };
    });
    const totals = [['Tạm tính', formatCurrency(r.subtotal)]];
    if (Number(r.discount) > 0) totals.push([r.voucher ? `Giảm giá (${r.voucher})` : 'Giảm giá', `-${formatCurrency(r.discount)}`]);
    if (Number(r.shipping_fee) > 0) totals.push(['Phí vận chuyển', formatCurrency(r.shipping_fee)]);
    totals.push(['TỔNG CỘNG', formatCurrency(r.total), true]);
    return { ...base, title: 'HÓA ĐƠN BÁN HÀNG', items, totals, notes: r.note ? [`Ghi chú: ${r.note}`] : [] };
  }

  if (type === 'booking') {
    return {
      ...base,
      title: 'PHIẾU TIẾP NHẬN SỬA CHỮA',
      sections: [{ heading: 'Thông tin máy', rows: [['Thiết bị', r.device], ['Dịch vụ', r.service]] }],
      totals: [['Chi phí', '.............................', true]],
      notes: [r.note ? `Khách ghi chú: ${r.note}` : '', 'Vui lòng mang phiếu này khi đến nhận máy.'].filter(Boolean)
    };
  }

  if (type === 'warranty') {
    const end = addMonths(r.start_date, r.warranty_months);
    return {
      ...base,
      title: 'PHIẾU BẢO HÀNH',
      dateText: formatDate(r.start_date) || base.dateText,
      sections: [{
        heading: 'Nội dung bảo hành',
        rows: [
          ['Thiết bị', r.device],
          ['Sửa chữa', r.service],
          ['Thời hạn', `${Number(r.warranty_months)} tháng`],
          ['Từ ngày', formatDate(r.start_date)],
          ['Đến ngày', formatDate(end)]
        ]
      }],
      notes: [r.note ? `Ghi chú: ${r.note}` : '', 'Tra cứu bảo hành bằng số điện thoại tại tienappletd.com.'].filter(Boolean)
    };
  }

  const docs = r.documents ? String(r.documents) : 'Không có';
  const due = nextDueDate(r.start_date, r.paid_months, r.term_months);
  return {
    ...base,
    title: 'HÓA ĐƠN TRẢ GÓP',
    dateText: formatDate(r.start_date) || base.dateText,
    sections: [
      { heading: 'Máy', rows: [['Sản phẩm', r.product], ['Giá gốc', formatCurrency(r.original_price)], ['Trả trước', formatCurrency(r.down_payment)]] },
      {
        heading: 'Điều khoản góp',
        rows: [
          ['Khoản vay', formatCurrency(r.loan_amount)],
          ['Lãi suất', `${pct(r.interest_rate)}/tháng`],
          ['Kỳ hạn', `${Number(r.term_months)} tháng`],
          ['Góp mỗi tháng', formatCurrency(r.monthly_payment)],
          ['Hình thức trả', r.pay_method],
          ['Đã đóng', `${Number(r.paid_months) || 0}/${Number(r.term_months)} kỳ`],
          ...(due ? [['Kỳ tới', formatDate(due)]] : []),
          ['Tình trạng', installmentStatusLabel(r.status)]
        ]
      },
      { heading: 'Giấy tờ đi kèm', rows: [['', docs]] }
    ],
    totals: [['THÀNH TIỀN', formatCurrency(r.total_amount), true]],
    notes: r.note ? [`Ghi chú: ${r.note}`] : []
  };
}

function rowsHtml(rows) {
  return rows.map(([label, value]) => `
      <div class="inv-row"><span class="inv-k">${escapeHtml(label)}</span><span class="inv-v">${escapeHtml(value)}</span></div>`).join('');
}

/**
 * HTML của hóa đơn, sẵn sàng đưa vào trang in (mọi dữ liệu đều được escape).
 */
export function invoiceHtml(inv) {
  if (!inv) return '<p class="inv-empty">Không tìm thấy dữ liệu để in.</p>';
  const items = inv.items.length === 0 ? '' : `
    <table class="inv-items">
      <thead><tr><th>Sản phẩm</th><th class="inv-r">SL</th><th class="inv-r">Thành tiền</th></tr></thead>
      <tbody>${inv.items.map(i => `
        <tr><td>${escapeHtml(i.name)}${i.detail ? `<small>${escapeHtml(i.detail)}</small>` : ''}<small>${escapeHtml(i.price)} x ${i.qty}</small></td>
        <td class="inv-r">${i.qty}</td><td class="inv-r">${escapeHtml(i.amount)}</td></tr>`).join('')}
      </tbody>
    </table>`;
  const sections = inv.sections.map(s => `
    <div class="inv-block"><div class="inv-h">${escapeHtml(s.heading)}</div>${rowsHtml(s.rows)}</div>`).join('');
  const totals = inv.totals.map(([label, value, strong]) => `
    <div class="inv-total ${strong ? 'inv-strong' : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join('');
  const notes = inv.notes.map(n => `<p class="inv-note">${escapeHtml(n)}</p>`).join('');
  const sign = inv.signatures.map(s => `<div class="inv-sign"><span>${escapeHtml(s)}</span></div>`).join('');

  return `
  <div class="inv-head">
    <div class="inv-shop">${escapeHtml(SHOP.name)}</div>
    <div class="inv-small">${escapeHtml(SHOP.tagline)}</div>
    <div class="inv-small">Hotline: ${escapeHtml(SHOP.hotline)}</div>
    <div class="inv-small">${escapeHtml(SHOP.website)} · ${escapeHtml(SHOP.hours)}</div>
  </div>
  <div class="inv-title">${escapeHtml(inv.title)}</div>
  <div class="inv-block">
    <div class="inv-row"><span class="inv-k">Mã</span><span class="inv-v inv-code">${escapeHtml(inv.code)}</span></div>
    <div class="inv-row"><span class="inv-k">Ngày</span><span class="inv-v">${escapeHtml(inv.dateText)}</span></div>
    ${rowsHtml(inv.customer)}
  </div>
  ${items}
  ${sections}
  <div class="inv-totals">${totals}</div>
  ${notes}
  <div class="inv-signs">${sign}</div>
  <p class="inv-thanks">Cảm ơn quý khách!</p>`;
}
