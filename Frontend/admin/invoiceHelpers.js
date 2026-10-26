/**
 * Tien Mobile - Hóa đơn / phiếu in cho từng mục (đơn hàng, lịch sửa chữa, bảo hành, trả góp).
 * Thuần logic để kiểm thử trong Node: buildInvoice() tạo cấu trúc, invoiceHtml() dựng HTML đã escape.
 */

import { escapeHtml } from '../js/utils.js';
import { formatDate, addMonths } from '../js/warranty.js';
import { formatCurrency } from './adminHelpers.js';
import { formatDateTime } from './ordersHelpers.js';
import { installmentStatusLabel, nextDueDate, parseMoney, parseRate } from '../js/installment.js';

/** Logo cửa hàng (giống thanh đầu web) vẽ bằng SVG để in luôn có hình, không phụ thuộc tải ảnh. */
export function brandMarkHtml() {
  return `<div class="brand-mark"><svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><rect x="18" y="6" width="28" height="52" rx="8" fill="none" stroke="#1D1D1F" stroke-width="5"/></svg><span class="brand-mark-t"><b>${escapeHtml(SHOP.name)}</b></span></div>`;
}

export const SHOP = {
  name: 'TIEN MOBILE THU DUC',
  tagline: 'Điện thoại chính hãng & Sửa chữa lấy ngay',
  hotline: '0986 455 457 - 0933 266 179',
  website: 'tienappletd.com',
  hours: '7h - 21h (T2 - CN)',
  address: ''
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

function imeiRows(extra) {
  const v = String(extra?.imei ?? '').trim();
  return v ? [['Số seri / IMEI', v]] : [];
}

function deviceSection(extra) {
  const rows = imeiRows(extra);
  return rows.length ? [{ heading: 'Thông tin máy', rows }] : [];
}

/**
 * Bảng tiền: tạm tính, giảm giá (đã có + nhập thêm), phí vận chuyển, VAT cộng thêm trên số sau giảm giá.
 * Không nhập thêm gì thì giữ nguyên tổng đã lưu của đơn.
 */
function totalsWithExtras(o, extra = {}) {
  const extraDiscount = Math.max(0, parseMoney(extra.discount) || 0);
  const vat = parseRate(extra.vat) || 0;
  const rows = [[o.subtotalLabel, formatCurrency(o.subtotal)]];
  const discount = o.discount + extraDiscount;
  if (discount > 0) rows.push([o.discountLabel, `-${formatCurrency(discount)}`]);
  const afterDiscount = Math.max(0, o.subtotal - discount);
  const vatAmount = vat > 0 ? Math.round((afterDiscount * vat) / 100) : 0;
  if (o.shipping > 0) rows.push(['Phí vận chuyển', formatCurrency(o.shipping)]);
  if (vatAmount > 0) rows.push([`Thuế VAT (${pct(vat)})`, formatCurrency(vatAmount)]);
  const touched = extraDiscount > 0 || vatAmount > 0;
  rows.push([o.totalLabel, formatCurrency(touched ? afterDiscount + vatAmount + o.shipping : o.recordTotal), true]);
  return rows;
}

function customerRows(r) {
  const rows = [['Khách hàng', r.customer_name], ['Điện thoại', r.phone]];
  if (r.address) rows.push(['Địa chỉ', r.address]);
  return rows;
}

/**
 * @param {'order'|'booking'|'warranty'|'installment'} type
 * @param {object} r bản ghi lấy từ Supabase
 * @param {{ imei?: string, discount?: string, vat?: string, price?: string }} [extra] thông tin nhập thêm lúc in (seri/IMEI, giảm giá thêm, VAT %, giá dịch vụ)
 * @returns {{ title: string, code: string, dateText: string, customer: string[][], items: object[], sections: Array<{ heading: string, rows: string[][] }>, totals: Array<[string, string, boolean?]>, notes: string[], signatures: string[] } | null}
 */
export function buildInvoice(type, r, extra = {}) {
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
    const totals = totalsWithExtras({
      subtotalLabel: 'Tạm tính', subtotal: Number(r.subtotal) || 0,
      discount: Number(r.discount) || 0, discountLabel: r.voucher ? `Giảm giá (${r.voucher})` : 'Giảm giá',
      shipping: Number(r.shipping_fee) || 0, recordTotal: Number(r.total) || 0, totalLabel: 'TỔNG CỘNG'
    }, extra);
    return { ...base, title: 'HÓA ĐƠN BÁN HÀNG', items, sections: deviceSection(extra), totals, notes: r.note ? [`Ghi chú: ${r.note}`] : [] };
  }

  if (type === 'booking') {
    return {
      ...base,
      title: 'PHIẾU TIẾP NHẬN SỬA CHỮA',
      sections: [{ heading: 'Thông tin máy', rows: [['Thiết bị', r.device], ['Dịch vụ', r.service], ...imeiRows(extra)] }],
      totals: parseMoney(extra.price) > 0
        ? totalsWithExtras({ subtotalLabel: 'Chi phí dịch vụ', subtotal: parseMoney(extra.price), discount: 0, discountLabel: 'Giảm giá', shipping: 0, recordTotal: parseMoney(extra.price), totalLabel: 'TỔNG CỘNG' }, extra)
        : [['Chi phí', '.............................', true]],
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
          ...imeiRows(extra),
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
      { heading: 'Máy', rows: [['Sản phẩm', r.product], ...imeiRows(extra), ['Giá gốc', formatCurrency(r.original_price)], ['Trả trước', formatCurrency(r.down_payment)]] },
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
    ${brandMarkHtml()}
    <div class="inv-small">${escapeHtml(SHOP.tagline)}</div>
    ${SHOP.address ? `<div class="inv-small">${escapeHtml(SHOP.address)}</div>` : ''}
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

// ===== Hợp đồng mua bán (đơn hàng và trả góp) =====

export const CONTRACT_TYPES = ['order', 'installment'];

const BLANK = '..............................';
const BLANK_SHORT = '..................';

function longDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return `ngày ${BLANK_SHORT} tháng ${BLANK_SHORT} năm ${BLANK_SHORT}`;
  return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

function sellerParty(extra) {
  return {
    heading: 'BÊN A - BÊN BÁN',
    rows: [
      ['Đơn vị', SHOP.name],
      ['Địa chỉ', SHOP.address || BLANK],
      ['Điện thoại', SHOP.hotline],
      ['Đại diện', extra.rep || `${BLANK_SHORT} Chức vụ: ${BLANK_SHORT}`]
    ]
  };
}

function buyerParty(r, extra) {
  const rows = [['Họ và tên', r.customer_name], ['Điện thoại', r.phone]];
  rows.push(['Địa chỉ', r.address || BLANK]);
  rows.push(['CCCD/CMND số', extra.cccd || `${BLANK_SHORT} cấp ngày ${BLANK_SHORT} nơi cấp ${BLANK_SHORT}`]);
  return { heading: 'BÊN B - BÊN MUA', rows };
}

const GENERAL_ARTICLE = {
  heading: 'Điều khoản chung',
  paragraphs: [
    'Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận trong hợp đồng này.',
    'Mọi tranh chấp phát sinh được hai bên thương lượng giải quyết; nếu không thương lượng được thì đưa ra Tòa án có thẩm quyền.',
    'Hợp đồng lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản, có hiệu lực kể từ ngày ký.'
  ]
};

/**
 * Hợp đồng mua bán có chừa chỗ trống để cửa hàng điền tay (địa chỉ, CCCD, bảo hành, mức xử lý chậm thanh toán...).
 * @param {'order'|'installment'} type
 * @param {object} r bản ghi lấy từ Supabase
 */
export function buildContract(type, r, extra = {}) {
  if (!CONTRACT_TYPES.includes(type) || !r || typeof r !== 'object') return null;
  const base = {
    place: 'Thủ Đức',
    signatures: ['ĐẠI DIỆN BÊN BÁN (ký, ghi rõ họ tên, đóng dấu)', 'BÊN MUA (ký, ghi rõ họ tên)'],
    parties: [sellerParty(extra), buyerParty(r, extra)]
  };

  if (type === 'order') {
    const items = (Array.isArray(r.items) ? r.items : []).map(i => {
      const qty = Number(i.quantity) || 1;
      const price = Number(i.price) || 0;
      return {
        name: [i.name || i.id, [i.color, i.storage].filter(Boolean).join(' / ')].filter(Boolean).join(' - '),
        qty,
        price: formatCurrency(price),
        amount: formatCurrency(price * qty)
      };
    });
    const pay = [['Tạm tính', formatCurrency(r.subtotal)]];
    if (Number(r.discount) > 0) pay.push(['Giảm giá', `-${formatCurrency(r.discount)}`]);
    if (Number(r.shipping_fee) > 0) pay.push(['Phí vận chuyển', formatCurrency(r.shipping_fee)]);
    pay.push(['Tổng thanh toán', formatCurrency(r.total)]);
    pay.push(['Bằng chữ', BLANK]);
    return {
      ...base,
      title: 'HỢP ĐỒNG MUA BÁN ĐIỆN THOẠI',
      number: `Số: HD-${r.code || ''}`,
      dateText: longDate(r.created_at),
      intro: 'Căn cứ Bộ luật Dân sự và nhu cầu, khả năng của hai bên, hôm nay hai bên cùng thỏa thuận ký hợp đồng mua bán với các điều khoản sau:',
      articles: [
        { heading: 'Điều 1. Hàng hóa', paragraphs: ['Bên A bán và Bên B mua các hàng hóa sau:'], items },
        { heading: 'Điều 2. Giá và thanh toán', rows: pay, paragraphs: ['Hình thức thanh toán:   ☐ Tiền mặt     ☐ Chuyển khoản     ☐ Khác: ' + BLANK_SHORT] },
        { heading: 'Điều 3. Giao nhận', paragraphs: [
          `Địa điểm giao nhận: ${r.address || BLANK}.`,
          'Bên A giao hàng đúng chủng loại, số lượng đã thỏa thuận. Bên B kiểm tra ngoại quan và tình trạng hoạt động của máy trước khi nhận.'
        ] },
        { heading: 'Điều 4. Bảo hành', paragraphs: [`Thời hạn bảo hành: ${extra.warrantyMonths || BLANK_SHORT} tháng, theo phiếu bảo hành và chính sách của Bên A. Khách tra cứu bảo hành bằng số điện thoại tại ${SHOP.website}.`] },
        GENERAL_ARTICLE
      ]
    };
  }

  const startDay = (() => { const d = new Date(r.start_date); return isNaN(d.getTime()) ? BLANK_SHORT : String(d.getUTCDate()); })();
  const rate = `${String(Number(r.interest_rate) || 0).replace('.', ',')}%/tháng`;
  return {
    ...base,
    title: 'HỢP ĐỒNG MUA BÁN TRẢ GÓP',
    number: `Số: HD-${r.code || ''}`,
    dateText: longDate(r.start_date),
    intro: 'Căn cứ Bộ luật Dân sự và nhu cầu, khả năng của hai bên, hôm nay hai bên cùng thỏa thuận ký hợp đồng mua bán trả góp với các điều khoản sau:',
    articles: [
      { heading: 'Điều 1. Hàng hóa', paragraphs: [`Bên A bán và Bên B mua: ${r.product}.`] },
      {
        heading: 'Điều 2. Giá và phương thức trả góp',
        rows: [
          ['Giá gốc', formatCurrency(r.original_price)],
          ['Trả trước', formatCurrency(r.down_payment)],
          ['Khoản vay', formatCurrency(r.loan_amount)],
          ['Lãi suất', rate],
          ['Kỳ hạn', `${Number(r.term_months)} tháng`],
          ['Góp mỗi tháng', formatCurrency(r.monthly_payment)],
          ['Tiền lãi', formatCurrency(r.interest_amount)],
          ['Thành tiền', formatCurrency(r.total_amount)],
          ['Hình thức trả', r.pay_method],
          ['Kỳ góp', `Hằng tháng, vào ngày ${startDay}, bắt đầu từ ${formatDate(addMonths(r.start_date, 1)) || BLANK_SHORT}`]
        ]
      },
      { heading: 'Điều 3. Giấy tờ và giao nhận', paragraphs: [
        `Giấy tờ Bên B đã cung cấp: ${r.documents || BLANK}.`,
        'Bên A giao máy cho Bên B sau khi Bên B thanh toán khoản trả trước và ký hợp đồng này. Bên B kiểm tra tình trạng máy trước khi nhận.'
      ] },
      { heading: 'Điều 4. Nghĩa vụ thanh toán', paragraphs: [
        'Bên B thanh toán đủ và đúng hạn các kỳ góp theo Điều 2.',
        `Trường hợp chậm thanh toán, hai bên xử lý theo thỏa thuận: ${BLANK}.`
      ] },
      { heading: 'Điều 5. Bảo hành', paragraphs: [`Thời hạn bảo hành: ${extra.warrantyMonths || BLANK_SHORT} tháng, theo phiếu bảo hành và chính sách của Bên A.`] },
      GENERAL_ARTICLE
    ]
  };
}

function ctRows(rows) {
  return rows.map(([k, v]) => `<div class="ct-row"><span class="ct-k">${escapeHtml(k)}:</span><span class="ct-v">${escapeHtml(v)}</span></div>`).join('');
}

/**
 * HTML của hợp đồng (mọi dữ liệu đều được escape).
 */
export function contractHtml(c) {
  if (!c) return '<p class="inv-empty">Không tìm thấy dữ liệu để in.</p>';
  const parties = c.parties.map(p => `<div class="ct-party"><div class="ct-h">${escapeHtml(p.heading)}</div>${ctRows(p.rows)}</div>`).join('');
  const articles = c.articles.map(a => {
    const items = a.items && a.items.length ? `
      <table class="ct-items"><thead><tr><th>Hàng hóa</th><th class="ct-r">SL</th><th class="ct-r">Đơn giá</th><th class="ct-r">Thành tiền</th></tr></thead><tbody>${a.items.map(i => `
        <tr><td>${escapeHtml(i.name)}</td><td class="ct-r">${i.qty}</td><td class="ct-r">${escapeHtml(i.price)}</td><td class="ct-r">${escapeHtml(i.amount)}</td></tr>`).join('')}</tbody></table>` : '';
    const rows = a.rows ? `<div class="ct-rows">${ctRows(a.rows)}</div>` : '';
    const paragraphs = (a.paragraphs || []).map(t => `<p>${escapeHtml(t)}</p>`).join('');
    return `<section class="ct-article"><div class="ct-h">${escapeHtml(a.heading)}</div>${paragraphs}${items}${rows}</section>`;
  }).join('');
  const sign = c.signatures.map(t => `<div class="ct-sign"><span>${escapeHtml(t)}</span></div>`).join('');
  return `
  ${brandMarkHtml()}
  <div class="ct-nation"><div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div>Độc lập - Tự do - Hạnh phúc</div></div>
  <div class="ct-title">${escapeHtml(c.title)}</div>
  <div class="ct-meta">${escapeHtml(c.number)}</div>
  <div class="ct-meta">${escapeHtml(c.place)}, ${escapeHtml(c.dateText)}</div>
  <p class="ct-intro">${escapeHtml(c.intro)}</p>
  <div class="ct-parties">${parties}</div>
  ${articles}
  <div class="ct-signs">${sign}</div>`;
}
