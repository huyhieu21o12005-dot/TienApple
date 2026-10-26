/**
 * Tien Mobile - Tìm sản phẩm theo cách khách hay gõ: bỏ dấu, gõ tắt ("ip 18", "ip18pm", "17 pro max").
 * Dùng chung cho ô tìm trong danh mục và ô tìm nhanh trên thanh đầu trang.
 */

/** Chữ thường, bỏ dấu tiếng Việt, đ thành d. */
export function foldText(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

// cách gọi tắt thường gặp -> từ đầy đủ
const ALIASES = { ip: ['iphone'], pm: ['pro', 'max'], pmax: ['pro', 'max'], promax: ['pro', 'max'], prm: ['pro', 'max'] };

/** Tách chữ và số dính nhau ("ip18" -> ip, 18) rồi đổi từ gõ tắt. */
export function queryTokens(query) {
  const raw = foldText(query)
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return raw.flatMap(t => ALIASES[t] || [t]);
}

/** Một sản phẩm có khớp mọi từ trong ô tìm không. Số khớp nguyên số (18 không ra 128). */
export function matchesQuery(product, query) {
  const tokens = queryTokens(query);
  if (!tokens.length) return true;
  const text = foldText([product?.name, product?.brandName, product?.chip, product?.description].filter(Boolean).join(' '));
  const words = new Set(text.replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2').split(/[^a-z0-9]+/).filter(Boolean));
  return tokens.every(t => (/^\d+$/.test(t) ? words.has(t) : text.includes(t)));
}
