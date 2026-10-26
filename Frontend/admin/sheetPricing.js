/**
 * Tien Mobile - Cập nhật giá hàng MỚI từ Google Sheet bảng giá.
 * Thuần logic (không DOM, không mạng) để kiểm thử trong Node. Hàng cũ / Like New không bao giờ bị đổi giá.
 *
 *   Giá hiển thị trên web (price) = cột "Giá Sau Sale"
 *   Giá gạch ngang (old_price)    = cột "Giá Bán" khi có sale, ngược lại bỏ trống
 */

import { imageFor } from './modelImages.js';

export const SHEET_ID = '1Ta3iJAafT8pnm4kuqSvPUqnJO-HLHq7s3Dk_clkIyQE';
/** Tab tổng hợp (gộp các tab dòng máy / hãng) mà web đọc. Đổi tên tab thì sửa ở đây. */
export const SHEET_TAB = 'TONG_HOP';
/** Tab máy cũ (2ND): mỗi dòng là một máy riêng, tồn kho 1. */
export const SHEET_USED_TAB = '2ND';
export const SHEET_USED_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_USED_TAB)}`;
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
      code: col('Mã SP'), show: col('Hiển Thị Web'), warranty: col('Bảo Hành'), note: col('Ghi Chú')
    };
    for (const k of ['brand', 'model', 'storage', 'list', 'sale', 'final']) if (idx[k] < 0) errors.push(`Thiếu cột: ${k}`);
    if (errors.length) return { rows: [], errors };
  } else {
    // Đường gviz (CSV qua trình duyệt) làm hỏng dòng tiêu đề ô gộp: dùng vị trí cột cố định của bảng giá.
    const labelRow = table.findIndex(r => norm(r[2]) === norm('Mẫu Sản Phẩm') && norm(r[3]) === norm('Phiên Bản / Bộ Nhớ'));
    if (labelRow < 0) return { rows: [], errors: ['Không tìm thấy dòng tiêu đề (Mẫu Sản Phẩm, Giá Sau Sale) trong sheet.'] };
    headerIndex = labelRow;
    idx = { brand: 1, model: 2, storage: 3, ram: 4, list: 6, sale: 7, final: 8, stock: 10, status: 11, code: -1, show: -1, warranty: -1, note: -1 };
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
      note: idx.note >= 0 ? String(r[idx.note] ?? '').trim() : '',
      stock: stockOf(idx.stock >= 0 ? r[idx.stock] : '', idx.status >= 0 ? r[idx.status] : ''),
      key: normalizeKey(`${model} ${storage}`)
    });
  }
  return { rows, errors };
}

/** Không phải điện thoại (đồng hồ, máy tính bảng, tai nghe...): không tự tạo vào mục điện thoại. */
const NOT_PHONE = /\b(watch|ipad|macbook|airpods|tai nghe|sac|cap)\b/i;

/** Ghi chú thêm vào mô tả máy cũ khi dùng ảnh minh họa của mẫu. */
export const USED_IMAGE_NOTE = 'Ảnh minh họa, ảnh máy thật vui lòng liên hệ cửa hàng';

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

/**
 * Dòng sheet chưa có trên web (so theo tên máy + dung lượng, bỏ qua trùng) -> sản phẩm mới để chèn vào bảng products.
 * Ảnh, màu, chip, camera để trống; tạo ẩn (is_visible=false) mặc định cho tới khi có ảnh.
 * @returns {{ items: Array<{ key: string, brand: string, line: number, product: object }>, duplicates: number }}
 */
/** Máy Apple iPhone: mô tả không ghi RAM. */
function isIphone(brand, line, name) {
  return brand === 'apple' && /iphone/i.test(`${line || ''} ${name || ''}`);
}

export function planNewProducts(existingProducts, sheetRows, { visible = false } = {}) {
  const existing = Array.isArray(existingProducts) ? existingProducts : [];
  const haveKey = new Set(existing.map(p => normalizeKey(p?.name)));
  const usedIds = new Set(existing.map(p => p?.id));
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  // Cùng mẫu + dung lượng nhưng khác màu/bản (khác Mã SP): thêm màu vào tên để phân biệt trên web
  const sameKeyCount = new Map();
  for (const r of rows) sameKeyCount.set(r.key, (sameKeyCount.get(r.key) || 0) + 1);
  const out = { items: [], duplicates: 0, hiddenInSheet: 0, notPhone: 0 };
  for (const r of rows) {
    if (NOT_PHONE.test(r.model)) { out.notPhone++; continue; }
    const codeId = slugify(r.code);
    // Có Mã SP thì nhận diện theo mã (ổn định khi đổi tên); không có mã thì theo tên máy + dung lượng
    const exists = codeId ? usedIds.has(codeId) : haveKey.has(r.key);
    if (exists) { out.duplicates++; continue; }
    if (!r.show) { out.hiddenInSheet++; continue; }
    const color = String(r.note || '').split(' - ')[0].trim();
    const baseName = productNameFor(r);
    const name = sameKeyCount.get(r.key) > 1 && color ? `${baseName} - ${color}` : baseName;
    const base = codeId || slugify(name) || 'san-pham';
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    if (!codeId) haveKey.add(r.key);
    const brand = r.brand.trim().toLowerCase();
    out.items.push({
      key: r.key, brand: r.brand, line: r.line, code: r.code,
      product: {
        id, name, kind: 'phone', category: null, brand, brand_name: BRAND_NAMES[brand] || r.brand,
        condition: 'new', condition_label: 'Mới 100%', badge: '',
        price: r.finalPrice, base_price: r.finalPrice, old_price: r.salePercent > 0 && r.listPrice > r.finalPrice ? r.listPrice : null,
        colors: [], default_color: color, storages: r.storage ? [r.storage] : [],
        chip: '', camera: '', battery: '', screen: '',
        description: [r.note, !isIphone(brand, r.line, name) && r.ram && r.ram !== '--' && `RAM ${r.ram}`, r.storage && `Bộ nhớ ${r.storage}`, r.warranty && `Bảo hành ${r.warranty}`].filter(Boolean).join(' • '),
        rating: 5, review_count: 0, image_url: imageFor(name) || imageFor(productNameFor(r)), stock: r.stock, is_visible: Boolean(visible), sort_order: 0
      }
    });
  }
  return out;
}


// ===== Máy cũ (tab 2ND): mỗi dòng một máy =====

/**
 * Đọc tab 2ND. Cột cố định: STT, Hãng, Mẫu, Bộ nhớ, RAM, Tình trạng, Mô tả, Giá gốc (KHÔNG đọc), Giá bán, Sale, Giá sau sale, Lợi nhuận, Tồn kho, Trạng thái.
 * @returns {{ rows: Array<object>, errors: string[] }}
 */
/**
 * Mã máy cũ ổn định theo mẫu + dung lượng + mô tả; bỏ phần "pin NN%" vì pin tụt dần theo ngày,
 * để cập nhật hằng ngày không biến máy cũ thành máy mới.
 */
export function usedBaseId(model, storage, description) {
  const stable = String(description ?? '').replace(/pin\s*(?:new|[\dx]+\s*%?)/gi, ' ');
  return `2nd-${slugify(`${model} ${storage} ${stable}`).slice(0, 80)}`;
}

export function parseUsedRows(csvText) {
  const table = parseCsv(csvText);
  const rows = [];
  const errors = [];
  table.forEach((r, i) => {
    if (!/^\d+$/.test(String(r[0] ?? '').trim()) || !String(r[2] ?? '').trim()) return;
    const finalPrice = parseVnd(r[10]);
    const listPrice = parseVnd(r[8]);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) { errors.push(`Dòng ${i + 1} (${r[2]}): giá không hợp lệ.`); return; }
    const model = String(r[2]).trim();
    const storage = String(r[3] ?? '').trim();
    const condition = String(r[5] ?? '').trim();
    const description = String(r[6] ?? '').trim();
    rows.push({
      line: i + 1, brand: String(r[1] ?? '').trim() || 'Apple', model, storage,
      ram: String(r[4] ?? '').trim(), condition, description,
      listPrice: Number.isFinite(listPrice) ? listPrice : finalPrice,
      salePercent: parsePercent(r[9]) || 0, finalPrice,
      stock: stockOf(r[12], r[13]),
      group: usedGroup(model),
      id: usedBaseId(model, storage, description)
    });
  });
  // Hai máy giống hệt nhau trong sheet: đuôi -2, -3... theo thứ tự xuất hiện để mỗi lần đồng bộ ra cùng một mã
  const seen = new Map();
  for (const row of rows) {
    const n = (seen.get(row.id) || 0) + 1;
    seen.set(row.id, n);
    if (n > 1) row.id = `${row.id}-${n}`;
  }
  return { rows, errors };
}

/** Nhóm hiển thị: "iPhone 17 Pro Max" -> "iPhone 17", "Apple Watch Series 9" -> "Apple Watch", "iPad Pro 9.7 inch" -> "iPad". */
export function usedGroup(model) {
  const m = String(model ?? '').trim();
  const phone = /^(iPhone\s+(?:\d+|XS|XR|X|SE)\b)/i.exec(m);
  if (phone) return phone[1].replace(/\s+/g, ' ');
  if (/^apple watch/i.test(m)) return 'Apple Watch';
  if (/^ipad/i.test(m)) return 'iPad';
  return m.split(/\s+/).slice(0, 2).join(' ');
}

/** Màu: phần trước dấu phẩy đầu tiên của mô tả, bỏ phần trong ngoặc. */
function colorOf(description) {
  return String(description ?? '').split(',')[0].replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Máy cũ trong sheet chưa có trên web (so theo mã tạo từ mẫu + dung lượng + mô tả) -> sản phẩm Like New, tồn kho theo sheet, ẩn mặc định.
 * @returns {{ items: Array<{ key: string, brand: string, line: number, product: object }>, duplicates: number, soldOut: number }}
 */
export function planUsedProducts(existingProducts, usedRows, { visible = false } = {}) {
  const existing = new Set((Array.isArray(existingProducts) ? existingProducts : []).map(p => p?.id));
  const out = { items: [], duplicates: 0, soldOut: 0 };
  for (const r0 of Array.isArray(usedRows) ? usedRows : []) {
    if (existing.has(r0.id)) { out.duplicates++; continue; }
    if (r0.stock <= 0) { out.soldOut++; continue; }
    const r = r0;
    const isPhone = /^iphone/i.test(r.model);
    const color = colorOf(r.description);
    const name = [r.model, r.storage, color && `- ${color}`, r.condition && `- ${r.condition}`].filter(Boolean).join(' ').replace(/\s+-\s+/g, ' - ');
    const image = imageFor(r.model, color);
    const battery = /pin\s*(new|\d+%|\d+x%)/i.exec(r.description);
    out.items.push({
      key: r.id, brand: r.group, line: r.line,
      product: {
        id: r.id, name, kind: isPhone ? 'phone' : 'accessory', category: isPhone ? null : /^ipad/i.test(r.model) ? 'tablet' : /watch/i.test(r.model) ? 'watch' : 'other',
        brand: 'apple', brand_name: isPhone ? 'Apple iPhone' : 'Apple',
        condition: 'like_new', condition_label: r.condition || 'Máy cũ', badge: 'Máy cũ',
        price: r.finalPrice, base_price: r.finalPrice, old_price: null,
        colors: [], default_color: color, storages: r.storage ? [r.storage] : [],
        chip: '', camera: '', screen: '', battery: battery ? `Pin ${battery[1]}` : '',
        description: [r.description, !isPhone && r.ram && r.ram !== '--' && `RAM ${r.ram}`, image && USED_IMAGE_NOTE].filter(Boolean).join(' • '),
        rating: 5, review_count: 0, image_url: image, stock: r.stock, is_visible: Boolean(visible), sort_order: 0
      }
    });
  }
  return out;
}
