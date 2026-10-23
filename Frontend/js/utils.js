/**
 * Tien Mobile - Shared pure helpers (no DOM, fully testable in Node)
 * Dùng để chống XSS khi dựng HTML từ dữ liệu sản phẩm do quản trị viên nhập.
 */

/**
 * Escape chuỗi để chèn an toàn vào nội dung HTML hoặc giá trị thuộc tính.
 * @param {*} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tạo đối số chuỗi an toàn cho thuộc tính onclick="fn(...)".
 * escapeHtml một mình không đủ vì trình duyệt giải mã &#39; về ' trước khi chạy JS.
 * JSON.stringify xử lý ngữ cảnh JS, escapeHtml xử lý ngữ cảnh thuộc tính HTML.
 * @param {*} value
 * @returns {string}
 */
export function jsArg(value) {
  return escapeHtml(JSON.stringify(String(value ?? '')));
}

/**
 * Chỉ cho phép URL ảnh http(s), đường dẫn tương đối hoặc data:image.
 * Chặn javascript:, vbscript:, data:text/html...
 * @param {*} url
 * @returns {string} URL hợp lệ hoặc chuỗi rỗng
 */
export function safeUrl(url) {
  if (typeof url !== 'string') return '';
  const value = url.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(value)) return value;
  // Đường dẫn tương đối: không chứa scheme (vd. "javascript:") và không bắt đầu bằng "//"
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//')) return value;
  return '';
}

/**
 * Chỉ chấp nhận mã màu hex #RGB hoặc #RRGGBB, nếu không trả về màu mặc định.
 * @param {*} hex
 * @param {string} [fallback]
 * @returns {string}
 */
export function safeColor(hex, fallback = '#FFFFFF') {
  return typeof hex === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim())
    ? hex.trim()
    : fallback;
}

/**
 * Sản phẩm là phụ kiện khi kind = 'accessory' hoặc có trường category (dữ liệu JSON cũ).
 * @param {object} product
 * @returns {boolean}
 */
export function isAccessory(product) {
  return !!product && (product.kind === 'accessory' || (!product.kind && !!product.category));
}

/**
 * Tách danh sách thành điện thoại và phụ kiện.
 * @param {Array<object>} products
 * @returns {{ phones: Array<object>, accessories: Array<object> }}
 */
export function partitionProducts(products) {
  const list = Array.isArray(products) ? products.filter(Boolean) : [];
  return {
    phones: list.filter(p => !isAccessory(p)),
    accessories: list.filter(p => isAccessory(p))
  };
}

/**
 * Phần trăm giảm giá hiển thị trên thẻ sản phẩm. Trả về 0 khi không hợp lệ.
 * @param {number} price
 * @param {number} oldPrice
 * @returns {number}
 */
export function discountPercent(price, oldPrice) {
  const p = Number(price);
  const o = Number(oldPrice);
  if (!isFinite(p) || !isFinite(o) || o <= 0 || p >= o || p < 0) return 0;
  return Math.round((1 - p / o) * 100);
}
