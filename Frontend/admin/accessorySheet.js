/**
 * Tien Mobile - Phụ kiện từ Google Sheet (tab PHU_KIEN).
 * Thuần logic (không DOM) để kiểm thử trong Node.
 *
 * Cột (tiêu đề ở dòng 1, tên cột không phân biệt dấu/hoa thường):
 *   Mã SP | Nhóm | Hãng | Tên Phụ Kiện | Phân Loại / Màu | Giá Bán | Sale (%) | Giá Sau Sale |
 *   Tồn Kho | Trạng Thái | Hiển Thị Web | Bảo Hành | Link Ảnh | Ghi Chú
 * Chỉ bắt buộc: Tên Phụ Kiện và Giá (Giá Sau Sale hoặc Giá Bán).
 */

import { SHEET_ID, parseCsv, parseVnd, parsePercent, normalizeKey, slugify } from './sheetPricing.js';

export const SHEET_ACC_TAB = 'PHU_KIEN';
export const SHEET_ACC_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_ACC_TAB)}`;

/** Nhóm trong sheet -> category của web (khớp thẻ lọc phụ kiện). */
export function categoryFor(group) {
  const g = String(group ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  if (/tai nghe|airpods|loa|headphone|earbud/.test(g)) return 'audio';
  if (/\bop\b|op lung|cuong luc|bao ve|case|dan man/.test(g)) return 'case';
  if (/\bsac\b|cu sac|\bcap\b|charger|cable|pin du phong|adapter/.test(g)) return 'charger';
  return 'other';
}

const SHEET_COLUMNS = {
  code: 'Mã SP', group: 'Nhóm', brand: 'Hãng', name: 'Tên Phụ Kiện', variant: 'Phân Loại / Màu',
  list: 'Giá Bán', sale: 'Sale (%)', final: 'Giá Sau Sale', stock: 'Tồn Kho', status: 'Trạng Thái',
  show: 'Hiển Thị Web', warranty: 'Bảo Hành', image: 'Link Ảnh', note: 'Ghi Chú'
};

/** http/https hợp lệ thì giữ, ngược lại bỏ. */
function cleanUrl(value) {
  const v = String(value ?? '').trim();
  return /^https?:\/\/[^\s]+$/i.test(v) ? v : '';
}

/**
 * @returns {{ rows: object[], errors: string[] }}
 */
export function parseAccessoryRows(csvText) {
  const table = parseCsv(csvText);
  const norm = (s) => normalizeKey(s);
  const headerIndex = table.findIndex(r => r.some(c => norm(c) === norm(SHEET_COLUMNS.name)) && r.some(c => norm(c) === norm(SHEET_COLUMNS.list) || norm(c) === norm(SHEET_COLUMNS.final)));
  if (headerIndex < 0) return { rows: [], errors: ['Không tìm thấy dòng tiêu đề (Tên Phụ Kiện, Giá Bán) trong tab PHU_KIEN.'] };
  const header = table[headerIndex].map(norm);
  const idx = {};
  for (const [k, label] of Object.entries(SHEET_COLUMNS)) idx[k] = header.indexOf(norm(label));
  const get = (r, k) => (idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '');

  const rows = [];
  const errors = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const r = table[i];
    const name = get(r, 'name');
    if (!name) continue;
    const list = parseVnd(get(r, 'list'));
    const sale = parsePercent(get(r, 'sale'));
    const salePercent = Number.isFinite(sale) ? (sale > 0 && sale <= 1 && /^0[.,]/.test(get(r, 'sale')) ? sale * 100 : sale) : 0;
    let final = parseVnd(get(r, 'final'));
    if (!Number.isFinite(final) || final <= 0) final = Number.isFinite(list) && list > 0 ? Math.round(list * (1 - salePercent / 100)) : NaN;
    if (!Number.isFinite(final) || final <= 0) { errors.push(`Dòng ${i + 1} (${name}): chưa có giá hợp lệ.`); continue; }
    const status = norm(get(r, 'status'));
    const stockNum = parseVnd(get(r, 'stock'));
    rows.push({
      line: i + 1,
      code: get(r, 'code'),
      group: get(r, 'group'),
      category: categoryFor(get(r, 'group') || name),
      brand: get(r, 'brand'),
      name,
      variant: get(r, 'variant'),
      listPrice: Number.isFinite(list) && list > 0 ? list : final,
      salePercent,
      finalPrice: final,
      stock: status === 'hethang' ? 0 : (Number.isFinite(stockNum) ? stockNum : 0),
      show: norm(get(r, 'show')) !== 'khong',
      warranty: get(r, 'warranty'),
      image: cleanUrl(get(r, 'image')),
      note: get(r, 'note')
    });
  }
  return { rows, errors };
}

/** Tên hiển thị: thêm hãng nếu tên chưa có, thêm phân loại/màu cuối tên. */
export function accessoryNameFor(row) {
  const brand = row.brand.trim();
  const base = brand && !row.name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${row.name}` : row.name;
  return row.variant ? `${base} - ${row.variant}` : base;
}

/**
 * Ghép dòng sheet với sản phẩm hiện có (cùng mã/ id, hoặc cùng tên).
 * - Chưa có trên web: thêm mới (mặc định ẩn).
 * - Đã có và là phụ kiện: đổi giá nếu khác giá gốc (giữ phần cộng thêm đã Set giá).
 * @returns {{ items: object[], changes: object[], same: number, hiddenInSheet: number }}
 */
export function planAccessories(existing, sheetRows, { visible = false } = {}) {
  const list = Array.isArray(existing) ? existing : [];
  const byId = new Map(list.map(p => [p.id, p]));
  const byName = new Map(list.map(p => [normalizeKey(p.name), p]));
  const usedIds = new Set(list.map(p => p.id));
  const out = { items: [], changes: [], matches: [], same: 0, hiddenInSheet: 0 };

  for (const r of Array.isArray(sheetRows) ? sheetRows : []) {
    const name = accessoryNameFor(r);
    const wantId = slugify(r.code) || `pk-${slugify(name)}` || 'phu-kien';
    const have = byId.get(wantId) || byName.get(normalizeKey(name));
    const newList = r.salePercent > 0 && r.listPrice > r.finalPrice ? r.listPrice : null;

    if (have) {
      if ((have.kind || '') !== 'accessory') { out.same++; continue; }
      out.matches.push({ product: have, row: r });
      const cur = have.basePrice || have.price;
      const markup = have.basePrice ? have.price - have.basePrice : 0;
      if (cur === r.finalPrice && (have.oldPrice ?? null) === newList) { out.same++; continue; }
      out.changes.push({ id: have.id, name: have.name, brand: r.group || 'Phụ kiện', oldPrice: cur, newPrice: r.finalPrice, oldList: have.oldPrice ?? null, newList, markup });
      continue;
    }
    if (!r.show) { out.hiddenInSheet++; continue; }

    let id = wantId;
    for (let n = 2; usedIds.has(id); n++) id = `${wantId}-${n}`;
    usedIds.add(id);
    byName.set(normalizeKey(name), { id, name, kind: 'accessory' });
    out.items.push({
      brand: r.group || 'Phụ kiện',
      name,
      product: {
        id, name, kind: 'accessory', category: r.category, brand: r.brand.toLowerCase(), brand_name: r.brand || 'Chính hãng',
        condition: 'new', condition_label: 'Mới 100%', badge: '',
        price: r.finalPrice, base_price: r.finalPrice, old_price: newList,
        colors: [], default_color: r.variant, storages: [],
        chip: '', camera: '', battery: '', screen: '',
        description: [r.note, r.warranty && `Bảo hành ${r.warranty}`].filter(Boolean).join(' • '),
        rating: 5, review_count: 0, image_url: r.image, stock: r.stock, is_visible: Boolean(visible), sort_order: 0
      }
    });
  }
  return out;
}
