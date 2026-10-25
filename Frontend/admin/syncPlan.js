/**
 * Tien Mobile - Đồng bộ hằng ngày từ Google Sheet lên web (hàng mới, máy cũ 2ND, phụ kiện).
 * Thuần logic (không DOM) để kiểm thử trong Node.
 *
 * Quy tắc nhận diện (để cập nhật hằng ngày không tạo trùng):
 *  - Hàng mới: theo Mã SP (cột "Mã SP"); không có mã thì theo tên máy + dung lượng.
 *  - Máy cũ 2ND: mã ổn định theo mẫu + dung lượng + mô tả (bỏ "pin NN%"); máy giống hệt nhau thêm -2, -3.
 *  - Phụ kiện: theo Mã SP hoặc tên.
 * Kết quả gồm 3 loại việc:
 *  - add: sản phẩm chưa có trên web (mặc định ẩn).
 *  - update: đổi giá (giữ phần cộng thêm đã Set giá), tồn kho, hiển thị.
 *  - retire: máy cũ đã biến mất khỏi sheet (đã bán): tồn 0 và ẩn.
 */

import { BIG_CHANGE_RATIO, normalizeKey, planNewProducts, planUsedProducts, slugify } from './sheetPricing.js';
import { planAccessories } from './accessorySheet.js';

const SOURCE_LABEL = { new: 'Hàng mới', used: 'Máy cũ', acc: 'Phụ kiện' };
const money = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

/**
 * Khác biệt giữa sản phẩm đang có trên web và dòng trong sheet.
 * @returns {{ patch: object, lines: string[], big: boolean }}
 */
export function diffProduct(p, row, source) {
  const patch = {};
  const lines = [];
  const cur = p.basePrice || p.price;
  const markup = p.basePrice ? p.price - p.basePrice : 0;
  const sheetOld = source !== 'used' && row.salePercent > 0 && row.listPrice > row.finalPrice ? row.listPrice : null;
  const wantOld = sheetOld === null ? null : sheetOld + markup;
  let big = false;

  if (cur !== row.finalPrice) {
    patch.base_price = row.finalPrice;
    patch.price = row.finalPrice + markup;
    patch.old_price = wantOld;
    lines.push(`Giá ${money(cur)} → ${money(row.finalPrice)}`);
    big = cur > 0 && Math.abs(row.finalPrice - cur) / cur > BIG_CHANGE_RATIO;
  } else if ((p.oldPrice ?? null) !== wantOld) {
    patch.old_price = wantOld;
    lines.push(wantOld === null ? 'Bỏ giá gạch ngang' : `Giá gạch ngang ${money(wantOld)}`);
  }

  const stock = Number(row.stock) || 0;
  if ((Number(p.stock) || 0) !== stock) {
    patch.stock = stock;
    lines.push(stock === 0 ? 'Hết hàng' : `Tồn ${Number(p.stock) || 0} → ${stock}`);
  }

  if (source === 'used') {
    if (stock <= 0 && p.is_visible !== false) { patch.is_visible = false; lines.push('Đã bán: ẩn khỏi web'); }
  } else if (row.show === false && p.is_visible !== false) {
    patch.is_visible = false;
    lines.push('Sheet đặt "Không" hiển thị: ẩn khỏi web');
  }
  return { patch, lines, big };
}

/**
 * @param {object[]} existing sản phẩm hiện có (qua mapDbToProduct)
 * @param {{ newRows?: object[], usedRows?: object[], accRows?: object[] }} sheet các dòng đã đọc từ sheet; thiếu mục nào thì bỏ qua mục đó
 * @param {{ visible?: boolean }} [opts]
 */
export function planSync(existing, sheet = {}, { visible = false } = {}) {
  const list = Array.isArray(existing) ? existing : [];
  const byId = new Map(list.map(p => [p.id, p]));
  const byKey = new Map(list.filter(p => (p.kind || 'phone') === 'phone' && p.condition === 'new').map(p => [normalizeKey(p.name), p]));
  const items = [];
  const warnings = [];
  const stats = { same: 0 };

  const pushUpdate = (p, row, source) => {
    const { patch, lines, big } = diffProduct(p, row, source);
    if (!lines.length) { stats.same++; return; }
    items.push({ action: 'update', source, id: p.id, name: p.name, brand: SOURCE_LABEL[source], patch, lines, warn: big, checked: !big });
  };
  const pushAdd = (it, source) => items.push({ action: 'add', source, id: it.product.id, name: it.product.name, brand: SOURCE_LABEL[source], product: { ...it.product, is_visible: Boolean(visible) }, lines: [`Giá ${money(it.product.price)} · Tồn ${it.product.stock}`], warn: false, checked: true });

  // ---- Hàng mới ----
  if (Array.isArray(sheet.newRows)) {
    const rows = sheet.newRows;
    const codes = new Map();
    for (const r of rows) if (r.code) codes.set(r.code, (codes.get(r.code) || 0) + 1);
    for (const [code, n] of codes) if (n > 1) warnings.push(`Mã SP "${code}" xuất hiện ${n} lần trong sheet: chỉ dòng đầu được dùng, hãy đổi mã cho khác nhau.`);
    const noCode = rows.filter(r => !r.code).length;
    if (noCode) warnings.push(`${noCode} dòng hàng mới chưa có Mã SP: web nhận diện theo tên máy + dung lượng, nên điền mã để cập nhật ổn định.`);
    const seen = new Set();
    for (const r of rows) {
      const codeId = slugify(r.code);
      if (codeId && seen.has(codeId)) continue;
      if (codeId) seen.add(codeId);
      const target = codeId ? byId.get(codeId) : byKey.get(r.key);
      if (target) pushUpdate(target, r, 'new');
    }
    for (const it of planNewProducts(list, rows).items) pushAdd(it, 'new');
  }

  // ---- Máy cũ 2ND ----
  if (Array.isArray(sheet.usedRows)) {
    const rows = sheet.usedRows;
    const inSheet = new Set();
    for (const r of rows) {
      inSheet.add(r.id);
      const p = byId.get(r.id);
      if (p) pushUpdate(p, r, 'used');
    }
    for (const it of planUsedProducts(list, rows).items) pushAdd(it, 'used');
    // Máy 2ND đã có trên web nhưng không còn trong sheet: coi như đã bán
    for (const p of list) {
      if (!String(p.id).startsWith('2nd-') || inSheet.has(p.id)) continue;
      if ((Number(p.stock) || 0) === 0 && p.is_visible === false) continue;
      items.push({ action: 'retire', source: 'used', id: p.id, name: p.name, brand: SOURCE_LABEL.used, patch: { stock: 0, is_visible: false }, lines: ['Không còn trong sheet: coi như đã bán, ẩn khỏi web'], warn: false, checked: true });
    }
  }

  // ---- Phụ kiện ----
  if (Array.isArray(sheet.accRows)) {
    const plan = planAccessories(list, sheet.accRows);
    for (const m of plan.matches) pushUpdate(m.product, m.row, 'acc');
    for (const it of plan.items) pushAdd(it, 'acc');
  }

  const count = (action, source) => items.filter(i => i.action === action && (!source || i.source === source)).length;
  return {
    items, warnings,
    summary: {
      add: count('add'), addNew: count('add', 'new'), addUsed: count('add', 'used'), addAcc: count('add', 'acc'),
      update: count('update'), retire: count('retire'), same: stats.same
    }
  };
}
