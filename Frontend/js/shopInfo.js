/**
 * Tien Mobile - Thông tin cửa hàng dùng chung cho web, hóa đơn và các phiếu.
 * Sửa ở đây thì mọi nơi cùng đổi.
 */
import { escapeHtml } from './utils.js';

export const SHOP_INFO = Object.freeze({
  name: 'TIEN MOBILE THU DUC',
  tagline: 'Điện thoại chính hãng & Sửa chữa lấy ngay',
  hotline: '0986 455 457 - 0933 266 179',
  website: 'tienappletd.com',
  hours: '7h - 21h (T2 - CN)',
  address: '54A8 Ngô Chí Quốc, Tam Bình, Thủ Đức'
});

/** Logo cửa hàng (giống thanh đầu web) vẽ bằng SVG để in luôn có hình, không phụ thuộc tải ảnh. */
export function brandMarkHtml() {
  return `<div class="brand-mark"><svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><rect x="18" y="6" width="28" height="52" rx="8" fill="none" stroke="#1D1D1F" stroke-width="5"/></svg><span class="brand-mark-t"><b>Tien Mobile</b><i>Thu Duc</i></span></div>`;
}

/** Đầu giấy tờ: logo như trên web ở bên trái, khẩu hiệu/địa chỉ/điện thoại ở bên phải. */
export function shopHeadHtml(shop = SHOP_INFO) {
  return `<div class="shop-head">
    ${brandMarkHtml()}
    <div class="shop-contact">
      <div>${escapeHtml(shop.tagline)}</div>
      ${shop.address ? `<div>${escapeHtml(shop.address)}</div>` : ''}
      <div>Hotline: ${escapeHtml(shop.hotline)}</div>
      <div>${escapeHtml(shop.website)} · ${escapeHtml(shop.hours)}</div>
    </div>
  </div>`;
}
