/**
 * Tien Mobile - Ảnh minh họa theo mẫu máy (ảnh sản phẩm chính thức trên CDN của hãng).
 * Chỉ ghép khi TÊN MẪU khớp chính xác; không đoán. Máy không có trong bảng này giữ ảnh tạm "Đang cập nhật ảnh".
 * Muốn thêm ảnh cho mẫu mới: thêm một dòng vào MODEL_IMAGES (khóa = tên mẫu đã bỏ dấu, khoảng trắng và tên hãng).
 */

const APPLE = 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/';
const apple = (slug) => `${APPLE}${slug}?wid=800&hei=800&fmt=png-alpha`;

/** Khóa chuẩn: bỏ dấu, chữ thường, bỏ tên hãng và 5G/4G, chỉ giữ chữ số và chữ cái. */
export function modelKey(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\b(apple|samsung|xiaomi|oppo|vivo|realme|5g|4g)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

export const MODEL_IMAGES = {
  iphone17promax: apple('iphone-17-pro-finish-select-202509-6-9inch-cosmicorange'),
  iphone17pro: apple('iphone-17-pro-finish-select-202509-6-3inch-cosmicorange'),
  iphone16promax: apple('iphone-16-pro-finish-select-202409-6-9inch-naturaltitanium'),
  iphone16pro: apple('iphone-16-pro-finish-select-202409-6-3inch-naturaltitanium'),
  iphone16plus: apple('iphone-16-finish-select-202409-6-7inch-pink'),
  iphone16: apple('iphone-16-finish-select-202409-6-1inch-pink'),
  iphone15promax: apple('iphone-15-pro-finish-select-202309-6-7inch-naturaltitanium'),
  iphone15pro: apple('iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium'),
  iphone15plus: apple('iphone-15-finish-select-202309-6-7inch-pink'),
  iphone15: apple('iphone-15-finish-select-202309-6-1inch-pink'),
  iphone14promax: apple('iphone-14-pro-finish-select-202209-6-7inch-deeppurple'),
  iphone14pro: apple('iphone-14-pro-finish-select-202209-6-1inch-deeppurple'),
  iphone14plus: apple('iphone-14-finish-select-202209-6-7inch-blue'),
  iphone14: apple('iphone-14-finish-select-202209-6-1inch-blue'),
  iphone13: apple('iphone-13-finish-select-202207-6-1inch-pink'),
  iphone12: apple('iphone-12-purple-select-2021'),
  iphonexsmax: apple('iphone-xs-max-gold-select-2018'),
  ipadair11m2air7: apple('ipad-air-finish-select-gallery-202405-11inch-blue-wifi'),
  watchseries9: apple('watch-card-40-s9-202309')
};

/** Tên mẫu = phần tên trước dung lượng đầu tiên ("iPhone 16 Pro Max 256GB - Cam" -> "iPhone 16 Pro Max"). */
export function modelOf(name) {
  const text = String(name ?? '').replace(/\(([^)]*)\)/g, (m, inner) => (/\bair\s*7\b/i.test(inner) ? ` ${inner}` : ' '));
  return text.split(/\s\d{2,4}\s?(?:GB|TB)\b/i)[0].split(' - ')[0].replace(/\s+/g, ' ').trim();
}

/** URL ảnh minh họa cho một tên sản phẩm hoặc tên mẫu, rỗng nếu không có trong bảng. */
export function imageFor(nameOrModel) {
  return MODEL_IMAGES[modelKey(modelOf(nameOrModel))] || '';
}
