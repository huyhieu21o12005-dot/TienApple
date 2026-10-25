/**
 * Tien Mobile - Set giá bán: giá bán = giá gốc (base_price) + cộng thêm.
 * Thuần logic (không DOM) để kiểm thử trong Node.
 * Chọn máy bằng tích: cùng nhóm là "hoặc", khác nhóm là "và" (hãng, khoảng giá gốc, tình trạng).
 */

import { facetValues, buildFacetGroups } from './bulkSelect.js';

/** Khoảng giá gốc để tích nhanh. max là cận trên không gồm. */
export const PRICE_BANDS = [
  { id: 'price:0', label: 'Dưới 3 triệu', min: 0, max: 3e6 },
  { id: 'price:1', label: '3 - 7 triệu', min: 3e6, max: 7e6 },
  { id: 'price:2', label: '7 - 12 triệu', min: 7e6, max: 12e6 },
  { id: 'price:3', label: '12 - 20 triệu', min: 12e6, max: 20e6 },
  { id: 'price:4', label: '20 - 30 triệu', min: 20e6, max: 30e6 },
  { id: 'price:5', label: 'Từ 30 triệu', min: 30e6, max: Infinity }
];

const text = (v) => String(v ?? '').trim();

/** "2.000.000" / "2000000" -> 2000000, rỗng -> null, sai -> NaN. */
export function parseAmount(value) {
  const raw = text(value).replace(/[\s.đ₫]/gi, '').replace(',', '.');
  if (raw === '') return null;
  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}

/** "3,5" / "3.5%" -> 3.5 (dấu chấm là thập phân), rỗng -> null, sai -> NaN. */
export function parsePercent(value) {
  const raw = text(value).replace('%', '').replace(',', '.');
  if (raw === '') return null;
  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}

/** Giá gốc của sản phẩm: base_price, chưa có thì giá hiện tại. */
export function baseOf(product) {
  const b = Number(product?.basePrice);
  return Number.isFinite(b) && b > 0 ? b : Number(product?.price) || 0;
}

/** Làm tròn LÊN theo bước (0 = chỉ làm tròn đến đồng). */
export function roundUp(value, step) {
  const s = Number(step) || 0;
  return s > 0 ? Math.ceil(value / s) * s : Math.round(value);
}

/** Giá mới = làm tròn(giá gốc + cộng thêm). mode 'fixed' (đồng) hoặc 'percent'. Trả null nếu giá trị sai. */
export function markupPrice(base, mode, value, roundStep = 0) {
  const v = mode === 'percent' ? parsePercent(value) : parseAmount(value);
  if (v === null || !Number.isFinite(v)) return null;
  const add = mode === 'percent' ? (base * v) / 100 : v;
  return Math.max(0, roundUp(base + add, roundStep));
}

/** Id khoảng giá chứa giá gốc của sản phẩm. */
export function bandOf(product) {
  const base = baseOf(product);
  return (PRICE_BANDS.find(b => base >= b.min && base < b.max) || PRICE_BANDS[0]).id;
}

/** Nhóm tích cho popup: Hãng, Khoảng giá gốc, Tình trạng (chỉ ô có sản phẩm), kèm số lượng. */
export function pricingGroups(products) {
  const list = Array.isArray(products) ? products : [];
  const base = buildFacetGroups(list).filter(g => g.id === 'brand' || g.id === 'cond');
  const counts = new Map();
  for (const p of list) counts.set(bandOf(p), (counts.get(bandOf(p)) || 0) + 1);
  const price = {
    id: 'price', label: 'Giá gốc',
    options: PRICE_BANDS.filter(b => counts.has(b.id)).map(b => ({ id: b.id, label: b.label, count: counts.get(b.id) }))
  };
  const [brand, cond] = ['brand', 'cond'].map(id => base.find(g => g.id === id));
  return [brand, price, cond].filter(g => g && g.options.length > 0);
}

/** Id các sản phẩm thỏa mọi nhóm có tích; không tích ô nào thì trả về tất cả. */
export function matchPricing(products, pickedIds) {
  const picked = [...new Set(pickedIds || [])];
  const list = Array.isArray(products) ? products : [];
  if (picked.length === 0) return list.map(p => p.id);
  const byGroup = new Map();
  for (const id of picked) {
    const g = String(id).split(':')[0];
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(id);
  }
  return list.filter(p => {
    const have = new Set([...facetValues(p), bandOf(p)]);
    return [...byGroup.values()].every(opts => opts.some(o => have.has(o)));
  }).map(p => p.id);
}

// ---------------------------------------------------------------------------
// Set giá hàng loạt theo bảng quy tắc
// ---------------------------------------------------------------------------

/** Bỏ dấu, chữ thường, chỉ giữ chữ và số, để so tên máy với từ khóa. */
export function normalizeText(value) {
  return text(value)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Chuẩn hóa một dòng quy tắc từ biểu mẫu; null nếu chưa có mức cộng thêm hợp lệ. */
export function normalizeRule(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const mode = r.mode === 'percent' ? 'percent' : 'fixed';
  const value = mode === 'percent' ? parsePercent(r.value) : parseAmount(r.value);
  if (value === null || !Number.isFinite(value)) return null;
  const from = parseAmount(r.from);
  const to = parseAmount(r.to);
  return {
    brand: text(r.brand).toLowerCase(),
    from: Number.isFinite(from) ? from : null,
    to: Number.isFinite(to) ? to : null,
    keyword: normalizeText(r.keyword),
    mode, value
  };
}

/** Điểm cụ thể: tên máy 4 > khoảng giá gốc 2 > hãng 1 > chung 0. */
export function ruleScore(rule) {
  return (rule.keyword ? 4 : 0) + (rule.from !== null || rule.to !== null ? 2 : 0) + (rule.brand ? 1 : 0);
}

function ruleMatches(p, rule) {
  const base = baseOf(p);
  if (rule.brand && !text(p.brandName || p.brand).toLowerCase().includes(rule.brand)) return false;
  if (rule.from !== null && base < rule.from) return false;
  if (rule.to !== null && base > rule.to) return false;
  if (rule.keyword && !normalizeText(p.name).includes(rule.keyword)) return false;
  return true;
}

/**
 * Mỗi sản phẩm nhận MỘT quy tắc khớp, cụ thể nhất (hòa điểm: dòng nằm sau thắng). Sản phẩm không khớp thì bỏ qua.
 * @returns {Array<{ id: string, newPrice: number, ruleIndex: number }>} ruleIndex theo mảng rules gốc
 */
export function planRules(products, rawRules, roundStep = 0) {
  const rules = (Array.isArray(rawRules) ? rawRules : []).map((r, index) => ({ rule: normalizeRule(r), index })).filter(x => x.rule);
  const out = [];
  for (const p of Array.isArray(products) ? products : []) {
    let best = null;
    for (const x of rules) {
      if (ruleMatches(p, x.rule) && (!best || ruleScore(x.rule) >= ruleScore(best.rule))) best = x;
    }
    if (best) out.push({ id: p.id, newPrice: markupPrice(baseOf(p), best.rule.mode, best.rule.value, roundStep), ruleIndex: best.index });
  }
  return out;
}

/** "2000000" -> "2.000.000", giữ dấu âm; bỏ mọi ký tự khác chữ số. Rỗng -> ''. */
export function formatThousands(value) {
  const raw = String(value ?? '');
  const neg = raw.trim().startsWith('-');
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return neg ? '-' : '';
  return (neg ? '-' : '') + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Mọi nhóm lọc (hãng, giá gốc, tình trạng, loại, trạng thái, nhãn) dùng cho xóa hàng loạt; khớp bằng matchPricing. */
export function allFilterGroups(products) {
  const all = buildFacetGroups(Array.isArray(products) ? products : []);
  const price = pricingGroups(products).find(g => g.id === 'price');
  if (!price) return all;
  const at = all.findIndex(g => g.id === 'brand') + 1;
  return [...all.slice(0, at), price, ...all.slice(at)];
}
