/**
 * Tien Mobile - Cập nhật giá hàng MỚI từ Google Sheet bảng giá.
 * Thuần logic (không DOM, không mạng) để kiểm thử trong Node. Hàng cũ / Like New không bao giờ bị đổi giá.
 *
 *   Giá hiển thị trên web (price) = cột "Giá Sau Sale"
 *   Giá gạch ngang (old_price)    = cột "Giá Bán" khi có sale, ngược lại bỏ trống
 */

export const SHEET_ID = '1Ta3iJAafT8pnm4kuqSvPUqnJO-HLHq7s3Dk_clkIyQE';
export const SHEET_GID = '0';
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
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
      list: col('Giá Bán'), sale: col('Sale (%)'), final: col('Giá Sau Sale')
    };
    for (const [k, v] of Object.entries(idx)) if (v < 0) errors.push(`Thiếu cột: ${k}`);
    if (errors.length) return { rows: [], errors };
  } else {
    // Đường gviz (CSV qua trình duyệt) làm hỏng dòng tiêu đề ô gộp: dùng vị trí cột cố định của bảng giá.
    const labelRow = table.findIndex(r => norm(r[2]) === norm('Mẫu Sản Phẩm') && norm(r[3]) === norm('Phiên Bản / Bộ Nhớ'));
    if (labelRow < 0) return { rows: [], errors: ['Không tìm thấy dòng tiêu đề (Mẫu Sản Phẩm, Giá Sau Sale) trong sheet.'] };
    headerIndex = labelRow;
    idx = { brand: 1, model: 2, storage: 3, list: 6, sale: 7, final: 8 };
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
    const item = { id: p.id, name: p.name, line: row.line, oldPrice: p.price, newPrice, oldList: p.oldPrice ?? null, newList: newOld };
    if (p.price === newPrice && (p.oldPrice ?? null) === newOld) { out.same.push(item); continue; }
    item.bigChange = p.price > 0 && Math.abs(newPrice - p.price) / p.price > BIG_CHANGE_RATIO;
    out.changes.push(item);
  }
  return out;
}
