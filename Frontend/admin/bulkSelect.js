/**
 * Tien Mobile - Chọn sản phẩm hàng loạt theo nhóm tích (hãng, tình trạng, loại, trạng thái, nhãn).
 * Thuần logic (không DOM) để kiểm thử trong Node.
 * Trong cùng một nhóm: khớp BẤT KỲ lựa chọn nào (OR). Giữa các nhóm: phải khớp TẤT CẢ nhóm có tích (AND).
 */

const GROUPS = [
  { id: 'brand', label: 'Hãng' },
  { id: 'cond', label: 'Tình trạng' },
  { id: 'kind', label: 'Loại' },
  { id: 'state', label: 'Trạng thái' },
  { id: 'badge', label: 'Nhãn' }
];

const text = (v) => String(v ?? '').trim();

/** Các giá trị tích mà một sản phẩm thỏa, dạng "nhóm:giá trị". */
export function facetValues(p) {
  const out = [];
  const brand = text(p?.brandName || p?.brand);
  if (brand) out.push(`brand:${brand.toLowerCase()}`);
  out.push(`cond:${p?.condition === 'likenew' ? 'likenew' : p?.condition === 'used' ? 'used' : 'new'}`);
  out.push(`kind:${p?.kind === 'accessory' ? 'accessory' : 'phone'}`);
  out.push(`state:${p?.is_visible === false ? 'hidden' : 'visible'}`);
  if (!(Number(p?.stock) > 0)) out.push('state:outofstock');
  if (!text(p?.image)) out.push('state:noimage');
  const badge = text(p?.badge);
  if (badge) out.push(`badge:${badge.toLowerCase()}`);
  return out;
}

const LABELS = {
  'cond:new': 'Hàng mới', 'cond:likenew': 'Like New / máy cũ', 'cond:used': 'Đã qua sử dụng',
  'kind:phone': 'Điện thoại', 'kind:accessory': 'Phụ kiện',
  'state:visible': 'Đang hiện', 'state:hidden': 'Đang ẩn', 'state:outofstock': 'Hết hàng', 'state:noimage': 'Chưa có ảnh'
};

/** Nhóm tích kèm số sản phẩm của từng ô; ô không có sản phẩm nào bị bỏ. */
export function buildFacetGroups(products) {
  const counts = new Map();
  const names = new Map();
  for (const p of Array.isArray(products) ? products : []) {
    const brand = text(p?.brandName || p?.brand);
    const badge = text(p?.badge);
    if (brand) names.set(`brand:${brand.toLowerCase()}`, brand);
    if (badge) names.set(`badge:${badge.toLowerCase()}`, badge);
    for (const v of facetValues(p)) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return GROUPS.map(g => ({
    id: g.id,
    label: g.label,
    options: [...counts.entries()]
      .filter(([v]) => v.startsWith(`${g.id}:`))
      .map(([v, count]) => ({ id: v, label: LABELS[v] || names.get(v) || v.slice(g.id.length + 1), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'))
  })).filter(g => g.options.length > 0);
}

/** Id các sản phẩm thỏa mọi nhóm có tích. Không tích ô nào thì trả về mảng rỗng. */
export function matchByFacets(products, selectedOptionIds) {
  const picked = new Set(selectedOptionIds || []);
  if (picked.size === 0) return [];
  const byGroup = new Map();
  for (const id of picked) {
    const group = String(id).split(':')[0];
    if (!byGroup.has(group)) byGroup.set(group, new Set());
    byGroup.get(group).add(id);
  }
  return (Array.isArray(products) ? products : [])
    .filter(p => {
      const have = new Set(facetValues(p));
      return [...byGroup.values()].every(options => [...options].some(o => have.has(o)));
    })
    .map(p => p.id);
}
