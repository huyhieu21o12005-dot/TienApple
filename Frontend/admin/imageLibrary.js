/**
 * Tien Mobile - Kho ảnh (Supabase Storage, bucket "product-images").
 * Ảnh mẫu máy lưu thành file "model-<khóa mẫu>.png" (khóa = modelKey của tên mẫu), nên mọi sản phẩm cùng mẫu
 * (mọi dung lượng, màu, tình trạng) dùng chung một ảnh và ảnh tự cập nhật theo TÊN sản phẩm.
 * Thuần logic (không DOM, không mạng) để kiểm thử trong Node.
 */

import { MODEL_IMAGES, modelKey, modelOf } from './modelImages.js';

export const LIBRARY_BUCKET = 'product-images';
export const LIBRARY_PREFIX = 'model-';

export const libraryFileName = (key, ext = 'png') => `${LIBRARY_PREFIX}${String(key).toLowerCase()}.${ext}`;

/** "model-iphone12promax.png" -> "iphone12promax", file khác -> '' */
export function libraryKeyOf(fileName) {
  const m = /^model-([a-z0-9]+)\.(?:png|jpe?g|webp)$/i.exec(String(fileName ?? ''));
  return m ? m[1].toLowerCase() : '';
}

/**
 * @param {Array<{ name: string }>} files kết quả storage.list()
 * @param {(name: string) => string} publicUrlOf
 * @returns {Map<string, string>} khóa mẫu -> URL công khai
 */
export function buildLibraryMap(files, publicUrlOf) {
  const map = new Map();
  for (const f of Array.isArray(files) ? files : []) {
    const key = libraryKeyOf(f?.name);
    if (key) map.set(key, publicUrlOf(f.name));
  }
  return map;
}

/** Khóa mẫu của một sản phẩm (từ tên). */
export const productKey = (name) => modelKey(modelOf(name));

/**
 * Việc cần làm để ảnh sản phẩm lấy từ kho theo tên mẫu.
 * Chỉ đụng tới sản phẩm chưa có ảnh hoặc đang dùng đúng link ngoài mặc định của bảng MODEL_IMAGES;
 * ảnh chụp riêng do bạn tải lên không bao giờ bị thay.
 * @returns {{ items: object[], uploads: Array<{ key: string, url: string }>, missing: string[], keep: number }}
 */
export function planImageLinks(products, library, { replaceExternal = true, sources = MODEL_IMAGES } = {}) {
  const items = [];
  const uploads = new Map();
  const missing = new Set();
  let keep = 0;
  for (const p of Array.isArray(products) ? products : []) {
    if (!p) continue;
    const key = productKey(p.name);
    const current = String(p.image || '').trim();
    const external = key ? sources[key] : '';
    const canReplace = !current || (replaceExternal && external && current === external);
    if (!canReplace) { keep++; continue; }
    const inLibrary = key && library.get(key);
    if (current && inLibrary && current === inLibrary) { keep++; continue; }
    if (inLibrary) {
      items.push({ id: p.id, name: p.name, brand: p.brandName || p.brand || 'Khác', key, image: inLibrary, source: 'kho', description: p.description || '', used: p.condition === 'likenew' || p.condition === 'like_new', checked: true });
    } else if (external) {
      uploads.set(key, external);
      items.push({ id: p.id, name: p.name, brand: p.brandName || p.brand || 'Khác', key, image: external, source: 'upload', description: p.description || '', used: p.condition === 'likenew' || p.condition === 'like_new', checked: true });
    } else if (!current) {
      missing.add(modelOf(p.name) || p.name);
    }
  }
  return { items, uploads: [...uploads].map(([key, url]) => ({ key, url })), missing: [...missing], keep };
}
