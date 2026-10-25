/**
 * Tien Mobile - Ảnh minh họa theo mẫu máy (ảnh sản phẩm chính thức trên CDN của hãng).
 * Chỉ ghép khi TÊN MẪU khớp chính xác; không đoán. Máy không có trong bảng này giữ ảnh tạm "Đang cập nhật ảnh".
 * Muốn thêm ảnh cho mẫu mới: thêm một dòng vào MODEL_IMAGES (khóa = tên mẫu đã bỏ dấu, khoảng trắng và tên hãng).
 */

const APPLE = 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/';
const apple = (slug) => `${APPLE}${slug}?wid=800&hei=800&fmt=png-alpha`;
const SAMSUNG = 'https://images.samsung.com/is/image/samsung/p6pim/vn/2401/gallery/';
const samsung = (file) => `${SAMSUNG}${file}?$650_519_PNG$`;
const XIAOMI = 'https://i02.appmifile.com/';
/** Ảnh sản phẩm của đại lý thegioididong.com (bên thứ ba) cho mẫu chưa có ảnh trên trang hãng. */
const TGDD = 'https://cdn.tgdd.vn/Products/Images/42/';

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
  watchseries9: apple('watch-card-40-s9-202309'),
  // Apple (ảnh bên thứ ba vì Apple chưa có ảnh cùng quy tắc)
  iphone12pro: `${TGDD}213032/iphone-12-pro-01.jpg`,
  iphone12promax: `${TGDD}213033/iphone-12-pro-max-1-org.jpg`,
  iphone18promax: `${TGDD}370982/iphone-18-pro-max-xanh-thumb.jpg`,
  // Apple Watch Series 4 (ảnh Wikimedia Commons, nền trong suốt)
  watchseries4: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Apple_Watch_Series_4_Extract.png/960px-Apple_Watch_Series_4_Extract.png',
  iphone17: `${TGDD}342667/iphone-17-tim-thumb-0.jpg`,
  iphone17air: `${TGDD}342670/iphone-air-vang-thumb.jpg`,
  iphoneair: `${TGDD}342670/iphone-air-vang-thumb.jpg`,
  // Samsung (trang hãng)
  galaxys24ultra: samsung('vn-galaxy-s24-s928-sm-s928bztqxxv-thumb-539307592'),
  galaxys24plus: samsung('vn-galaxy-s24-plus-489236-sm-s926blgbxxv-thumb-539322009'),
  galaxys24: samsung('vn-galaxy-s24-490125-sm-s921blbqxxv-thumb-539378863'),
  // Samsung A (bên thứ ba)
  galaxya55: `${TGDD}322096/samsung-galaxy-a55-5g-tim-1.jpg`,
  galaxya35: `${TGDD}321772/samsung-galaxy-a35-xanh-1.jpg`,
  galaxya15: `${TGDD}319901/samsung-galaxy-a15-xanh-den-1.jpg`,
  // Xiaomi (trang hãng). Khóa "14" là Xiaomi 14 vì tên hãng bị bỏ khi chuẩn hóa.
  14: `${XIAOMI}976_operatorx_operatorx_opx/23/02/2024/c4866f7bdd20c6ed7acf6082417dd340.png`,
  redminote13pro: `${XIAOMI}13_operatorx_operatorx_opx/11/01/2024/25da829b5997ff8aea28af388df3b8df.png`,
  redmi13c: `${XIAOMI}477_operatorx_operatorx_opx/08/11/2023/a69b2ced4a4e2403fbfd446994c26a06.png`,
  // OPPO
  a79: 'https://www.oppo.com/content/dam/oppo/common/mkt/v2-2/a79-5g-en/listpage/a79-5g-427_600-purple.png',
  findx7ultra: `${TGDD}320724/oppo-find-x7-ultra-221223-104455-600x600.jpg`,
  // Vivo (bên thứ ba)
  x100pro: `${TGDD}307003/vivo-x100-pro-600x600.jpg`,
  v30: `${TGDD}319214/vivo-v30-black-1-1.jpg`,
  y100: `${TGDD}302197/vivo-y100-den-1-1.jpg`,
  // Realme (bên thứ ba). Khóa "12" là Realme 12 5G.
  12: `${TGDD}322956/realme-12-green-1.jpg`,
  c67: `${TGDD}319658/realme-c67-xanh-1.jpg`
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
