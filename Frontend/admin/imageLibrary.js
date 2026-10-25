/**
 * Tien Mobile - Kho ảnh (Supabase Storage, bucket "product-images").
 * Ảnh mẫu máy lưu thành file "model-<khóa mẫu>.png" (khóa = modelKey của tên mẫu), hoặc "model-<mẫu>-<màu>.png"
 * khi mẫu có ảnh theo màu (ví dụ model-iphone14promax-tim.png). Mọi sản phẩm cùng mẫu và màu (mọi dung lượng, tình trạng) dùng chung một ảnh và ảnh tự cập nhật theo TÊN sản phẩm.
 * Thuần logic (không DOM, không mạng) để kiểm thử trong Node.
 */

import { IMAGE_SOURCES, imageKeyFor, isKnownSource, modelKey, modelOf } from './modelImages.js';

export const LIBRARY_BUCKET = 'product-images';
export const LIBRARY_PREFIX = 'model-';

export const libraryFileName = (key, ext = 'png') => `${LIBRARY_PREFIX}${String(key).toLowerCase()}.${ext}`;

/** "model-iphone12promax.png" -> "iphone12promax", file khác -> '' */
export function libraryKeyOf(fileName) {
  const m = /^model-([a-z0-9-]+)\.(?:png|jpe?g|webp)$/i.exec(String(fileName ?? ''));
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

/** Khóa ảnh của một sản phẩm: mẫu hoặc mẫu-màu (rỗng nếu mẫu có ảnh theo màu nhưng không có đúng màu này). */
export const productKey = (name, color = '') => imageKeyFor(name, color);

/** Ảnh trong kho là ảnh mặc định của mẫu (không theo màu): có thể thay bằng ảnh đúng màu. */
const isLibraryModelDefault = (url, name) => {
  const file = String(url ?? '').split('?')[0].split('/').pop();
  return libraryKeyOf(file) === modelKey(modelOf(name));
};

/**
 * Việc cần làm để ảnh sản phẩm lấy từ kho theo tên mẫu.
 * Chỉ đụng tới sản phẩm chưa có ảnh hoặc đang dùng đúng link ngoài mặc định của bảng MODEL_IMAGES;
 * ảnh chụp riêng do bạn tải lên không bao giờ bị thay.
 * @returns {{ items: object[], uploads: Array<{ key: string, url: string }>, missing: string[], keep: number }}
 */
export function planImageLinks(products, library, { replaceExternal = true, sources = IMAGE_SOURCES } = {}) {
  const items = [];
  const uploads = new Map();
  const missing = new Set();
  let keep = 0;
  for (const p of Array.isArray(products) ? products : []) {
    if (!p) continue;
    const key = productKey(p.name, p.defaultColor);
    const current = String(p.image || '').trim();
    const external = key ? sources[key] : '';
    const canReplace = !current || (replaceExternal && (isKnownSource(current) || isLibraryModelDefault(current, p.name)));
    if (!canReplace) { keep++; continue; }
    const inLibrary = key && library.get(key);
    if (current && inLibrary && current === inLibrary) { keep++; continue; }
    if (!key && current) {
      items.push({ id: p.id, name: p.name, brand: p.brandName || p.brand || 'Khác', key: '', image: '', source: 'clear', description: p.description || '', used: false, checked: true });
      missing.add(`${modelOf(p.name)} (${p.defaultColor || 'đúng màu'})`);
      continue;
    }
    if (inLibrary) {
      items.push({ id: p.id, name: p.name, brand: p.brandName || p.brand || 'Khác', key, image: inLibrary, source: 'kho', description: p.description || '', used: p.condition === 'likenew' || p.condition === 'like_new', checked: true });
    } else if (external) {
      uploads.set(key, external);
      items.push({ id: p.id, name: p.name, brand: p.brandName || p.brand || 'Khác', key, image: external, source: 'upload', description: p.description || '', used: p.condition === 'likenew' || p.condition === 'like_new', checked: true });
    } else if (!current) {
      missing.add(`${modelOf(p.name) || p.name}${p.defaultColor ? ` (${p.defaultColor})` : ''}`);
    }
  }
  return { items, uploads: [...uploads].map(([key, url]) => ({ key, url })), missing: [...missing], keep };
}
