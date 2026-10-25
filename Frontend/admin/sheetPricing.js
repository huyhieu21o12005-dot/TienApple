/**
 * Tien Mobile - Cập nhật giá hàng MỚI từ Google Sheet bảng giá.
 * Thuần logic (không DOM, không mạng) để kiểm thử trong Node. Hàng cũ / Like New không bao giờ bị đổi giá.
 *
 *   Giá hiển thị trên web (price) = cột "Giá Sau Sale"
 *   Giá gạch ngang (old_price)    = cột "Giá Bán" khi có sale, ngược lại bỏ trống
 */

export const SHEET_ID = '1Ta3iJAafT8pnm4kuqSvPUqnJO-HLHq7s3Dk_clkIyQE';
/** Tab tổng hợp (gộp các tab dòng máy / hãng) mà web đọc. Đổi tên tab thì sửa ở đây. */
export const SHEET_TAB = 'TONG_HOP';
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
/** Đổi giá lệch quá mức này (so với giá cũ) thì không tự chọn, chờ người dùng tick. */
export const BIG_CHANGE_RATIO = 0.3;

/** Đọc CSV (có dấu ngoặc kép, dấu phẩy và xuống dòng trong ô) thành mảng các dòng. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** "40.500.000 ₫" / "40500000" -> 40500000, sai -> NaN. */
export function parseVnd(value) {
  const cleaned = String(value ?? '').replace(/[\s.,đ₫]/gi, '');
  return /^\d+$/.test(cleaned) ? Number(cleaned) : NaN;
}

/** "8%" / "7,3%" -> số, rỗng -> 0, sai -> NaN. */
export function parsePercent(value) {
  const raw = String(value ?? '').trim().replace('%', '').replace(',', '.');
  if (raw === '') return 0;
  return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}

/** Bỏ dấu, chữ thường, bỏ thương hiệu / "5G" / khoảng trắng để so tên máy trong sheet với tên sản phẩm. */
export function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\b(apple|samsung|xiaomi|oppo|vivo|realme|5g|4g)\b/g, ' ')
    .replace(/[^a-z0-9+]/g, '');
}

/** Tồn kho (số) từ cột Tồn Kho; "Hết hàng" thì 0. */
function stockOf(stockCell, statusCell) {
  if (/het\s*hang/.test(normalizeKey(statusCell).length ? String(statusCell).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '')) return 0;
  const n = parseVnd(stockCell);
  return Number.isFinite(n) ? n : 0;
}

/** Ngày cập nhật ghi trong sheet ("Cập nhật ngày 25/10/2026"), rỗng nếu không thấy. */
export function parseSheetDate(csvText) {
  const m = /Cập nhật ngày\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(String(csvText ?? '').slice(0, 2000));
  return m ? m[1] : '';
}

/**
 * Tìm dòng tiêu đề (có "Mẫu Sản Phẩm" và "Giá Sau Sale") rồi đọc các dòng giá hợp lệ bên dưới.
 * @returns {{ rows: Array<{ line: number, brand: string, model: string, storage: string, listPrice: number, salePercent: number, finalPrice: number, key: string }>, errors: string[] }}
 */
export function parseSheetRows(csvText) {
  const table = parseCsv(csvText);
  const errors = [];
  const norm = (s) => normalizeKey(s);
  let headerIndex = table.findIndex(r => r.some(c => norm(c) === norm('Mẫu Sản Phẩm')) && r.some(c => norm(c) === norm('Giá Sau Sale')));
  let idx;
  if (headerIndex >= 0) {
    const header = table[headerIndex].map(norm);
    const col = (name) => header.indexOf(norm(name));
    idx = {
      brand: col('Hãng'), model: col('Mẫu Sản Phẩm'), storage: col('Phiên Bản / Bộ Nhớ'),
      list: col('Giá Bán'), sale: col('Sale (%)'), final: col('Giá Sau Sale'),
      ram: col('RAM'), stock: col('Tồn Kho'), status: col('Trạng Thái'),
      code: col('Mã SP'), show: col('Hiển Thị Web'), warranty: col('Bảo Hành')
    };
    for (const k of ['brand', 'model', 'storage', 'list', 'sale', 'final']) if (idx[k] < 0) errors.push(`Thiếu cột: ${k}`);
    if (errors.length) return { rows: [], errors };
  } else {
    // Đường gviz (CSV qua trình duyệt) làm hỏng dòng tiêu đề ô gộp: dùng vị trí cột cố định của bảng giá.
    const labelRow = table.findIndex(r => norm(r[2]) === norm('Mẫu Sản Phẩm') && norm(r[3]) === norm('Phiên Bản / Bộ Nhớ'));
    if (labelRow < 0) return { rows: [], errors: ['Không tìm thấy dòng tiêu đề (Mẫu Sản Phẩm, Giá Sau Sale) trong sheet.'] };
    headerIndex = labelRow;
    idx = { brand: 1, model: 2, storage: 3, ram: 4, list: 6, sale: 7, final: 8, stock: 10, status: 11, code: -1, show: -1, warranty: -1 };
  }
  const rows = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const r = table[i];
    const model = String(r[idx.model] ?? '').trim();
    if (!model) continue;
    const listPrice = parseVnd(r[idx.list]);
    const finalPrice = parseVnd(r[idx.final]);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) { errors.push(`Dòng ${i + 1} (${model}): giá sau sale không hợp lệ.`); continue; }
    const storage = String(r[idx.storage] ?? '').trim();
    rows.push({
      line: i + 1,
      brand: String(r[idx.brand] ?? '').trim(),
      model,
      storage,
      listPrice: Number.isFinite(listPrice) ? listPrice : finalPrice,
      salePercent: parsePercent(r[idx.sale]) || 0,
      finalPrice,
      ram: idx.ram >= 0 ? String(r[idx.ram] ?? '').trim() : '',
      code: idx.code >= 0 ? String(r[idx.code] ?? '').trim() : '',
      show: idx.show < 0 || normalizeKey(r[idx.show]) !== 'khong',
      warranty: idx.warranty >= 0 ? String(r[idx.warranty] ?? '').trim() : '',
      stock: stockOf(idx.stock >= 0 ? r[idx.stock] : '', idx.status >= 0 ? r[idx.status] : ''),
      key: normalizeKey(`${model} ${storage}`)
    });
  }
  return { rows, errors };
}

/**
 * Ghép sản phẩm HÀNG MỚI (phone, condition new) với dòng trong sheet theo tên máy + dung lượng.
 * @param {Array<{id:string,name:string,kind?:string,condition?:string,price:number,oldPrice?:number}>} products dữ liệu qua mapDbToProduct
 * @returns {{ changes: object[], same: object[], unmatched: object[], skipped: number }}
 */
export function planPriceUpdates(products, sheetRows) {
  const byKey = new Map();
  for (const r of Array.isArray(sheetRows) ? sheetRows : []) if (!byKey.has(r.key)) byKey.set(r.key, r);
  const out = { changes: [], same: [], unmatched: [], skipped: 0 };
  for (const p of Array.isArray(products) ? products : []) {
    if (!p || (p.kind || 'phone') !== 'phone' || p.condition !== 'new') { out.skipped++; continue; }
    const row = byKey.get(normalizeKey(p.name));
    if (!row) { out.unmatched.push({ id: p.id, name: p.name }); continue; }
    const newPrice = row.finalPrice;
    const newOld = row.salePercent > 0 && row.listPrice > newPrice ? row.listPrice : null;
    const item = { id: p.id, name: p.name, line: row.line, sheetKey: row.key, oldPrice: p.price, newPrice, oldList: p.oldPrice ?? null, newList: newOld };
    if (p.price === newPrice && (p.oldPrice ?? null) === newOld) { out.same.push(item); continue; }
    item.bigChange = p.price > 0 && Math.abs(newPrice - p.price) / p.price > BIG_CHANGE_RATIO;
    out.changes.push(item);
  }
  return out;
}

/** Không phải điện thoại (đồng hồ, máy tính bảng, tai nghe...): không tự tạo vào mục điện thoại. */
const NOT_PHONE = /\b(watch|ipad|macbook|airpods|tai nghe|sac|cap)\b/i;

const BRAND_NAMES = { apple: 'Apple iPhone', samsung: 'Samsung Galaxy', xiaomi: 'Xiaomi', oppo: 'OPPO', vivo: 'Vivo', realme: 'Realme' };

/** "iPhone 16 Pro Max 256GB" -> "iphone-16-pro-max-256gb". */
export function slugify(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Tên hiển thị: "Samsung " + mẫu nếu mẫu chưa có tên hãng (iPhone, Xiaomi 14... giữ nguyên). */
export function productNameFor(row) {
  const brand = row.brand.trim();
  const model = row.model.trim();
  const hasBrand = brand.toLowerCase() === 'apple' || model.toLowerCase().startsWith(brand.toLowerCase());
  return `${hasBrand ? model : `${brand} ${model}`} ${row.storage}`.trim();
}

/** Danh sách hãng trong sheet theo thứ tự xuất hiện, kèm số dòng. */
export function brandsOf(rows) {
  const map = new Map();
  for (const r of Array.isArray(rows) ? rows : []) map.set(r.brand, (map.get(r.brand) || 0) + 1);
  return [...map.entries()].map(([brand, count]) => ({ brand, count }));
}

/**
 * Dòng sheet chưa có trên web (so theo tên máy + dung lượng, bỏ qua trùng) -> sản phẩm mới để chèn vào bảng products.
 * Ảnh, màu, chip, camera để trống; tạo ẩn (is_visible=false) mặc định cho tới khi có ảnh.
 * @returns {{ items: Array<{ key: string, brand: string, line: number, product: object }>, duplicates: number }}
 */
export function planNewProducts(existingProducts, sheetRows, { visible = false } = {}) {
  const have = new Set((Array.isArray(existingProducts) ? existingProducts : []).map(p => normalizeKey(p?.name)));
  const usedIds = new Set((Array.isArray(existingProducts) ? existingProducts : []).map(p => p?.id));
  const out = { items: [], duplicates: 0, hiddenInSheet: 0, notPhone: 0 };
  for (const r of Array.isArray(sheetRows) ? sheetRows : []) {
    if (have.has(r.key)) { out.duplicates++; continue; }
    if (!r.show) { out.hiddenInSheet++; continue; }
    if (NOT_PHONE.test(r.model)) { out.notPhone++; continue; }
    have.add(r.key);
    const name = productNameFor(r);
    const base = slugify(r.code) || slugify(name) || 'san-pham';
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    const brand = r.brand.trim().toLowerCase();
    out.items.push({
      key: r.key, brand: r.brand, line: r.line,
      product: {
        id, name, kind: 'phone', category: null, brand, brand_name: BRAND_NAMES[brand] || r.brand,
        condition: 'new', condition_label: 'Mới 100%', badge: '',
        price: r.finalPrice, old_price: r.salePercent > 0 && r.listPrice > r.finalPrice ? r.listPrice : null,
        colors: [], default_color: '', storages: r.storage ? [r.storage] : [],
        chip: '', camera: '', battery: '', screen: '',
        description: [r.ram && r.ram !== '--' && `RAM ${r.ram}`, r.storage && `Bộ nhớ ${r.storage}`, r.warranty && `Bảo hành ${r.warranty}`].filter(Boolean).join(' • '),
        rating: 5, review_count: 0, image_url: '', stock: r.stock, is_visible: Boolean(visible), sort_order: 0
      }
    });
  }
  return out;
}
