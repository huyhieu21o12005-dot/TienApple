/**
 * Tien Mobile - Admin Pure Helpers & Business Logic
 * Fully testable in Node.js (node --test) without DOM dependencies
 */

/**
 * Định dạng số tiền sang định dạng tiền tệ Việt Nam (VNĐ)
 * Ví dụ: 28990000 -> "28.990.000đ"
 * @param {number|string} val
 * @returns {string}
 */
export function formatCurrency(val) {
  const num = typeof val === 'number' ? val : parseInt(val, 10);
  if (isNaN(num) || num < 0) return '0đ';
  return num.toLocaleString('vi-VN') + 'đ';
}

/**
 * Chuyển chuỗi tiền tệ người dùng nhập về số nguyên
 * Ví dụ: "28.990.000đ" -> 28990000
 * @param {string|number} val
 * @returns {number}
 */
export function parseCurrency(val) {
  if (typeof val === 'number') return Math.max(0, Math.round(val));
  if (!val || typeof val !== 'string') return 0;
  // Bỏ tất cả ký tự không phải số
  const cleaned = val.replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Giá trị người dùng nhập có phải số âm không (parseCurrency bỏ dấu "-" nên cần kiểm tra riêng)
 * @param {string|number} val
 * @returns {boolean}
 */
export function isNegativeInput(val) {
  if (typeof val === 'number') return val < 0;
  return typeof val === 'string' && /^\s*-/.test(val);
}

/**
 * Ép về số nguyên, trả về giá trị mặc định khi không hợp lệ (tránh NaN gửi lên database)
 * @param {*} val
 * @param {number} [fallback]
 * @returns {number}
 */
export function toInt(val, fallback = 0) {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

/**
 * Tạo slug sạch từ tên sản phẩm tiếng Việt
 * Hỗ trợ chuyển đổi có dấu thành không dấu chuẩn
 * Ví dụ: "iPhone 16 Pro Max 256GB" -> "iphone-16-pro-max-256gb"
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  let str = text.trim().toLowerCase();

  // Chuyển ký tự có dấu tiếng Việt sang không dấu
  str = str.replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a');
  str = str.replace(/[èéẹẻẽêềếệểễ]/g, 'e');
  str = str.replace(/[ìíịỉĩ]/g, 'i');
  str = str.replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o');
  str = str.replace(/[ùúụủũưừứựửữ]/g, 'u');
  str = str.replace(/[ỳýỵỷỹ]/g, 'y');
  str = str.replace(/đ/g, 'd');

  // Bỏ ký tự đặc biệt, giữ lại chữ cái, số và dấu gạch nối
  str = str.replace(/[^a-z0-9\s-]/g, '');
  // Thay khoảng trắng thành dấu gạch nối
  str = str.replace(/[\s-]+/g, '-');
  // Xóa gạch nối ở đầu và cuối chuỗi
  str = str.replace(/^-+|-+$/g, '');

  return str;
}

/**
 * Xác thực thông tin sản phẩm trước khi lưu vào database
 * @param {object} data
 * @param {boolean} isEdit
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProduct(data, isEdit = false) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Dữ liệu sản phẩm không hợp lệ'] };
  }

  // Tên sản phẩm bắt buộc
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push('Tên sản phẩm không được để trống');
  }

  // Mã ID (slug)
  if (!isEdit) {
    if (!data.id || typeof data.id !== 'string' || !/^[a-z0-9-]+$/.test(data.id)) {
      errors.push('Mã sản phẩm (ID slug) không hợp lệ (chỉ gồm chữ thường, số và dấu gạch nối)');
    }
  }

  // Phân loại (kind)
  if (!data.kind || !['phone', 'accessory'].includes(data.kind)) {
    errors.push('Phân loại phải là "phone" (Điện thoại) hoặc "accessory" (Phụ kiện)');
  }

  // Giá bán (price)
  const price = parseCurrency(data.price);
  if (isNegativeInput(data.price) || isNaN(price) || price < 0) {
    errors.push('Giá bán phải là số nguyên không âm');
  }

  // Giá cũ (old_price) nếu có
  if (data.old_price !== undefined && data.old_price !== null && data.old_price !== '') {
    const oldPrice = parseCurrency(data.old_price);
    if (isNegativeInput(data.old_price) || isNaN(oldPrice) || oldPrice < 0) {
      errors.push('Giá gốc phải là số nguyên không âm');
    } else if (oldPrice > 0 && oldPrice < price) {
      errors.push('Giá gốc (khi có giảm giá) phải lớn hơn hoặc bằng giá bán');
    }
  }

  // Tồn kho (stock)
  if (data.stock !== undefined && data.stock !== null && data.stock !== '') {
    const stock = parseInt(data.stock, 10);
    if (isNaN(stock) || stock < 0) {
      errors.push('Số lượng tồn kho phải là số nguyên không âm');
    }
  }

  // Danh sách màu (colors)
  if (data.colors && Array.isArray(data.colors)) {
    const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    for (const c of data.colors) {
      if (c && c.hex && !hexRegex.test(c.hex)) {
        errors.push(`Mã màu "${c.hex}" không đúng định dạng hex (ví dụ: #FFFFFF)`);
        break;
      }
    }
  }

  // Tình trạng (condition)
  if (data.condition && !['new', 'like_new', 'used'].includes(data.condition)) {
    errors.push('Tình trạng sản phẩm phải là "new", "like_new" hoặc "used"');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Tính toán giá sau khi giảm giá hàng loạt theo phần trăm
 * Làm tròn đến hàng nghìn đồng (1.000đ) hoặc hàng chục nghìn (10.000đ)
 * @param {number} price Giá ban đầu
 * @param {number} percent Phần trăm giảm giá (ví dụ 10 = 10%)
 * @returns {number}
 */
export function applyBulkDiscount(price, percent) {
  const currentPrice = Math.max(0, Math.round(price));
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  if (pct === 0) return currentPrice;
  if (pct === 100) return 0;

  const rawNewPrice = currentPrice * (1 - pct / 100);
  // Làm tròn đến 10.000đ cho đẹp
  const rounded = Math.round(rawNewPrice / 10000) * 10000;
  return Math.max(0, rounded);
}

/**
 * Chuyển đổi dữ liệu từ Supabase Row (snake_case) sang format của App/Client (camelCase)
 * @param {object} row
 * @returns {object}
 */
export function mapDbToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind || 'phone',
    category: row.category || null,
    brand: row.brand || '',
    brandName: row.brand_name || (row.brand === 'apple' ? 'Apple iPhone' : row.brand || ''),
    condition: row.condition === 'like_new' ? 'likenew' : (row.condition || 'new'),
    conditionLabel: row.condition_label || (row.condition === 'like_new' ? 'Like New 99%' : 'Mới 100%'),
    badge: row.badge || '',
    price: Number(row.price) || 0,
    oldPrice: row.old_price ? Number(row.old_price) : undefined,
    rating: row.rating !== null && row.rating !== undefined && isFinite(Number(row.rating)) ? Number(row.rating) : 5.0,
    reviewCount: Number(row.review_count) || 0,
    defaultColor: row.default_color || (Array.isArray(row.colors) && row.colors[0]?.name) || '',
    colors: Array.isArray(row.colors) ? row.colors : [],
    storages: Array.isArray(row.storages) ? row.storages : [],
    chip: row.chip || '',
    camera: row.camera || '',
    battery: row.battery || '',
    screen: row.screen || '',
    image: row.image_url || '',
    description: row.description || '',
    stock: Number(row.stock) || 0,
    is_visible: row.is_visible !== false,
    sort_order: Number(row.sort_order) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Chuyển đổi dữ liệu từ App/Client sang Supabase Row (snake_case)
 * @param {object} product
 * @returns {object}
 */
export function mapProductToDb(product) {
  if (!product) return null;

  // Convert condition: app uses 'likenew', db check constraint expects 'like_new'
  let condition = product.condition || 'new';
  if (condition === 'likenew') condition = 'like_new';

  return {
    id: product.id,
    name: product.name,
    kind: product.kind || (product.category ? 'accessory' : 'phone'),
    category: product.category || null,
    brand: product.brand || '',
    brand_name: product.brandName || product.brand_name || '',
    condition,
    condition_label: product.conditionLabel || product.condition_label || (condition === 'like_new' ? 'Like New 99%' : 'Mới 100%'),
    badge: product.badge || '',
    price: parseCurrency(product.price),
    old_price: product.oldPrice !== undefined && product.oldPrice !== null && product.oldPrice !== ''
      ? parseCurrency(product.oldPrice)
      : (product.old_price !== undefined && product.old_price !== null && product.old_price !== ''
        ? parseCurrency(product.old_price)
        : null),
    rating: product.rating !== undefined && isFinite(Number(product.rating)) ? Number(product.rating) : 5.0,
    review_count: toInt(product.reviewCount !== undefined ? product.reviewCount : product.review_count, 0),
    default_color: product.defaultColor || product.default_color || '',
    colors: Array.isArray(product.colors) ? product.colors : [],
    storages: Array.isArray(product.storages) ? product.storages : [],
    chip: product.chip || '',
    camera: product.camera || '',
    battery: product.battery || '',
    screen: product.screen || '',
    image_url: product.image || product.image_url || '',
    description: product.description || '',
    stock: Math.max(0, toInt(product.stock, 0)),
    is_visible: product.is_visible !== undefined ? Boolean(product.is_visible) : true,
    sort_order: toInt(product.sort_order, 0)
  };
}

/**
 * Nén và thay đổi kích thước ảnh client-side trước khi tải lên Storage
 * Giới hạn chiều rộng tối đa 1200px, nén chất lượng ~80%
 * @param {File|Blob} file
 * @param {number} maxWidth
 * @param {number} quality
 * @returns {Promise<Blob>}
 */
export async function resizeImage(file, maxWidth = 1200, quality = 0.8) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file; // Khi chạy môi trường test không có Canvas
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Nén sang JPEG hoặc WebP
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file); // Fallback về file gốc nếu toBlob lỗi
            }
          },
          mimeType,
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


/**
 * Vai trò được xóa sản phẩm. Nhân viên (staff) chỉ xem, thêm và sửa.
 * Đây chỉ để ẩn nút trên giao diện; việc chặn thật nằm ở quy tắc bảo mật của Supabase.
 * @param {string|null|undefined} role
 * @returns {boolean}
 */
export function canDeleteProducts(role) {
  return role === 'owner' || role === 'admin';
}

/**
 * Nhãn vai trò hiển thị cạnh email.
 * @param {string|null|undefined} role
 * @returns {string}
 */
export function roleLabel(role) {
  return { owner: 'Chủ shop', admin: 'Quản trị', staff: 'Nhân viên' }[role] || 'Quản trị';
}


/**
 * Supabase Auth bắt buộc dùng email, nên tên đăng nhập được ghép thêm một tên miền nội bộ.
 * Không có thư nào được gửi đến địa chỉ này; tài khoản được tạo sẵn và tự xác nhận.
 */
export const LOGIN_EMAIL_DOMAIN = 'tienmobile.vn';

/**
 * Tên đăng nhập hợp lệ: 3-30 ký tự gồm chữ thường, số, dấu chấm, gạch dưới, gạch nối.
 * @param {string} username
 * @returns {boolean}
 */
export function isValidUsername(username) {
  return typeof username === 'string' && /^[a-z0-9][a-z0-9._-]{2,29}$/.test(username);
}

/**
 * Đổi nội dung ô đăng nhập thành email gửi cho Supabase.
 * - "nhanvien1" hoặc "NhanVien1 " -> "nhanvien1@tienmobile.vn"
 * - Nếu người dùng gõ sẵn email thì giữ nguyên (tương thích tài khoản cũ).
 * @param {string} input
 * @returns {string} email, hoặc chuỗi rỗng nếu không hợp lệ
 */
export function usernameToEmail(input) {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) return '';
  if (value.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : '';
  return isValidUsername(value) ? `${value}@${LOGIN_EMAIL_DOMAIN}` : '';
}

/**
 * Hiển thị tên đăng nhập thay vì email nội bộ.
 * @param {string} email
 * @returns {string}
 */
export function emailToUsername(email) {
  if (typeof email !== 'string' || !email) return '';
  const suffix = `@${LOGIN_EMAIL_DOMAIN}`;
  const lower = email.toLowerCase();
  return lower.endsWith(suffix) ? lower.slice(0, -suffix.length) : email;
}
