/**
 * Tien Mobile - Thẻ xem trước khi chia sẻ link (Messenger, Zalo, Facebook...).
 * Các ứng dụng này không chạy JavaScript nên trang sản phẩm cần thẻ og: dựng sẵn từ server.
 * Thuần logic (không mạng) để kiểm thử trong Node.
 */

import { imageFor, isKnownSource } from '../Frontend/admin/modelImages.js';

export const SITE_NAME = 'Tien Mobile Thu Duc';
export const LOGO_PATH = '/assets/og-logo.png';
const DEFAULT_DESC = 'Phân phối iPhone, Samsung chính hãng và sửa chữa lấy liền minh bạch tại Thủ Đức.';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

/** Chuyển đường dẫn của web thành https tuyệt đối; từ chối địa chỉ không phải http(s). */
export function absoluteUrl(url, origin) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return `${origin}${u}`;
  return /^https?:\/\//i.test(u) ? u : '';
}

/** Ảnh dùng khi chia sẻ: ảnh sản phẩm (hoặc ảnh theo mẫu-màu), không có thì logo web. */
export function productImage(row, origin) {
  const raw = !row.image_url || isKnownSource(row.image_url) ? imageFor(row.name, row.default_color) : row.image_url;
  return absoluteUrl(raw, origin) || `${origin}${LOGO_PATH}`;
}

export function productMeta(row, origin) {
  const price = Number(row.price) || 0;
  const title = `${row.name} — ${SITE_NAME}`;
  const desc = [price > 0 ? `Giá ${money(price)}` : '', row.condition_label || '', 'Bảo hành rõ ràng, nhận máy tại cửa hàng'].filter(Boolean).join(' · ');
  return { title, desc: desc || DEFAULT_DESC, image: productImage(row, origin), url: `${origin}/product.html?id=${encodeURIComponent(row.id)}` };
}

/** Trang HTML tối giản chỉ để các bot đọc thẻ og:, người dùng thật được chuyển ngay sang trang đầy đủ. */
export function ogHtml({ title, desc, image, url }) {
  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:url" content="${esc(url)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0;url=${esc(url)}" />
</head><body><a href="${esc(url)}">${esc(title)}</a></body></html>`;
}
