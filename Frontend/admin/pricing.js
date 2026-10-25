/**
 * Tien Mobile - Set giá bán từ giá gốc (base_price) bằng các quy tắc cộng thêm.
 * Thuần logic (không DOM) để kiểm thử trong Node.
 *
 * Một sản phẩm chỉ nhận MỘT quy tắc: quy tắc "cụ thể nhất" khớp với nó.
 *   điểm cụ thể = từ khóa tên (4) + khoảng giá gốc (2) + hãng (1);  quy tắc chung (không điều kiện) = 0
 *   hòa điểm: từ khóa dài hơn thắng, vẫn hòa thì quy tắc nằm SAU thắng.
 * Giá mới = làm tròn(giá gốc + cộng thêm). Luôn tính từ giá gốc nên bấm áp dụng nhiều lần không bị cộng dồn.
 *
 * Ví dụ: chung +500.000; Apple, giá gốc từ 20.000.000: +2.000.000 -> iPhone 17 Pro Max +2tr, iPhone 8 chỉ +500k.
 */

export const ROUND_STEPS = [0, 1000, 10000, 100000, 500000, 1000000];

const text = (v) => String(v ?? '').trim();

/** Bỏ dấu, chữ thường, chỉ giữ chữ và số, để so tên máy và từ khóa. */
export function normalizeText(value) {
  return text(value)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** "2.000.000" / "2000000" -> 2000000, rỗng -> null, sai -> NaN. */
export function parseAmount(value) {
  const raw = text(value);
  if (raw === '') return null;
  const cleaned = raw.replace(/[\s.đ₫]/gi, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
}

/** "3,5" / "3.5" -> 3.5 (phần trăm, dấu chấm là thập phân). */
function parsePercent(value) {
  const raw = text(value).replace('%', '').replace(',', '.');
  if (raw === '') return null;
  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}

/** Chuẩn hóa một quy tắc từ biểu mẫu; trả về null nếu không hợp lệ (không có giá trị cộng thêm). */
export function normalizeRule(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const percent = r.mode === 'percent';
  const value = percent ? parsePercent(r.value) : parseAmount(r.value);
  if (value === null || !Number.isFinite(value)) return null;
  const from = parseAmount(r.from);
  const to = parseAmount(r.to);
  return {
    brand: text(r.brand).toLowerCase(),
    from: Number.isFinite(from) ? from : null,
    to: Number.isFinite(to) ? to : null,
    keyword: text(r.keyword),
    mode: percent ? 'percent' : 'fixed',
    value
  };
}

/** Điểm cụ thể của quy tắc (xem đầu file). */
export function ruleScore(rule) {
  return (rule.keyword ? 4 : 0) + (rule.from !== null || rule.to !== null ? 2 : 0) + (rule.brand ? 1 : 0);
}

function matches(product, base, rule) {
  if (rule.brand) {
    const brand = text(product.brandName || product.brand).toLowerCase();
    if (!brand.includes(rule.brand)) return false;
  }
  if (rule.from !== null && base < rule.from) return false;
  if (rule.to !== null && base > rule.to) return false;
  if (rule.keyword) {
    const key = normalizeText(rule.keyword);
    if (!key || !normalizeText(product.name).includes(key)) return false;
  }
  return true;
}

/** Giá gốc của sản phẩm: base_price, chưa có thì giá hiện tại. */
export function baseOf(product) {
  const b = Number(product?.basePrice);
  return Number.isFinite(b) && b > 0 ? b : Number(product?.price) || 0;
}

/** Quy tắc thắng cho sản phẩm (hoặc null). @param {Array} rules đã qua normalizeRule */
export function pickRule(product, rules) {
  const base = baseOf(product);
  let best = null;
  let bestIndex = -1;
  (Array.isArray(rules) ? rules : []).forEach((rule, index) => {
    if (!rule || !matches(product, base, rule)) return;
    const better = !best
      || ruleScore(rule) > ruleScore(best)
      || (ruleScore(rule) === ruleScore(best) && rule.keyword.length >= best.keyword.length);
    if (better) { best = rule; bestIndex = index; }
  });
  return best ? { rule: best, index: bestIndex } : null;
}

/** Làm tròn LÊN theo bước (0 = không làm tròn). */
export function roundUp(value, step) {
  const s = Number(step) || 0;
  return s > 0 ? Math.ceil(value / s) * s : Math.round(value);
}

/**
 * Tính giá mới cho từng sản phẩm.
 * @returns {Array<{ id: string, name: string, brand: string, base: number, markup: number, newPrice: number, newOldPrice: number|null, price: number, oldPrice: number|null, ruleIndex: number }>}
 */
export function planPricing(products, rawRules, { roundStep = 0, shiftOldPrice = true } = {}) {
  const rules = (Array.isArray(rawRules) ? rawRules : []).map(normalizeRule).filter(Boolean);
  return (Array.isArray(products) ? products : []).filter(Boolean).map(p => {
    const base = baseOf(p);
    const hit = pickRule(p, rules);
    const rawMarkup = hit ? (hit.rule.mode === 'percent' ? (base * hit.rule.value) / 100 : hit.rule.value) : 0;
    const newPrice = Math.max(0, roundUp(base + rawMarkup, roundStep));
    const markup = newPrice - base;
    const hasOld = p.oldPrice !== undefined && p.oldPrice !== null && Number(p.oldPrice) > 0;
    return {
      id: p.id, name: p.name, brand: text(p.brandName || p.brand),
      base, markup, newPrice,
      // giá gạch ngang dịch cùng mức thay đổi để mức giảm hiển thị không đổi
      newOldPrice: hasOld ? Math.max(0, Number(p.oldPrice) + (shiftOldPrice ? newPrice - (Number(p.price) || 0) : 0)) : null,
      price: Number(p.price) || 0,
      oldPrice: hasOld ? Number(p.oldPrice) : null,
      ruleIndex: hit ? hit.index : -1
    };
  });
}
