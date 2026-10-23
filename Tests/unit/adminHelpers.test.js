import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrency,
  parseCurrency,
  slugify,
  validateProduct,
  applyBulkDiscount,
  mapDbToProduct,
  mapProductToDb
} from '../../Frontend/admin/adminHelpers.js';

describe('Tien Mobile Admin Suite - Pure Helpers & Validation', () => {

  describe('1. formatCurrency & parseCurrency', () => {
    it('định dạng số tiền sang chuẩn VNĐ có dấu phân cách chấm và ký hiệu đ', () => {
      assert.strictEqual(formatCurrency(28990000), '28.990.000đ');
      assert.strictEqual(formatCurrency(650000), '650.000đ');
      assert.strictEqual(formatCurrency(0), '0đ');
    });

    it('xử lý giá trị không hợp lệ hoặc âm thành 0đ', () => {
      assert.strictEqual(formatCurrency(-1000), '0đ');
      assert.strictEqual(formatCurrency(null), '0đ');
      assert.strictEqual(formatCurrency(undefined), '0đ');
      assert.strictEqual(formatCurrency('abc'), '0đ');
    });

    it('parseCurrency chuyển chuỗi tiền tệ về số nguyên chính xác', () => {
      assert.strictEqual(parseCurrency('28.990.000đ'), 28990000);
      assert.strictEqual(parseCurrency(' 31,990,000 đ '), 31990000);
      assert.strictEqual(parseCurrency(15000000), 15000000);
      assert.strictEqual(parseCurrency(''), 0);
      assert.strictEqual(parseCurrency(null), 0);
    });
  });

  describe('2. slugify - Tạo mã ID chuẩn URL từ tên sản phẩm', () => {
    it('chuyển tên iPhone chuẩn thành slug chữ thường không dấu nối gạch ngang', () => {
      assert.strictEqual(slugify('iPhone 16 Pro 256GB'), 'iphone-16-pro-256gb');
      assert.strictEqual(slugify('Samsung Galaxy S24 Ultra'), 'samsung-galaxy-s24-ultra');
    });

    it('xử lý tiếng Việt có dấu phức tạp và chữ Đ/đ chính xác', () => {
      const input = 'Củ sạc nhanh Apple 30W USB-C chính hãng';
      assert.strictEqual(slugify(input), 'cu-sac-nhanh-apple-30w-usb-c-chinh-hang');

      const phone = 'Điện thoại Đỏ Đậm Đẹp Độc Đáo';
      assert.strictEqual(slugify(phone), 'dien-thoai-do-dam-dep-doc-dao');
    });

    it('loại bỏ ký tự đặc biệt và gạch ngang thừa', () => {
      assert.strictEqual(slugify('Tai nghe AirPods Pro 2 -- Like New 99%!'), 'tai-nghe-airpods-pro-2-like-new-99');
      assert.strictEqual(slugify('  ---Ốp Lưng MagSafe---  '), 'op-lung-magsafe');
    });
  });

  describe('3. validateProduct - Kiểm tra dữ liệu thêm / sửa sản phẩm', () => {
    it('hợp lệ với sản phẩm điện thoại đầy đủ thông tin', () => {
      const product = {
        id: 'ip16-pro',
        name: 'iPhone 16 Pro 256GB',
        kind: 'phone',
        price: 28990000,
        old_price: 31990000,
        stock: 15,
        condition: 'new',
        colors: [{ name: 'Titan Tự Nhiên', hex: '#8E8D8A' }]
      };
      const result = validateProduct(product, false);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('báo lỗi khi thiếu tên sản phẩm hoặc tên rỗng', () => {
      const product = {
        id: 'test-phone',
        name: '   ',
        kind: 'phone',
        price: 10000000
      };
      const result = validateProduct(product, false);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Tên sản phẩm')));
    });

    it('báo lỗi khi mã slug id chứa ký tự không hợp lệ khi tạo mới', () => {
      const product = {
        id: 'invalid slug@123!',
        name: 'Test Phone',
        kind: 'phone',
        price: 10000000
      };
      const result = validateProduct(product, false);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Mã sản phẩm (ID slug)')));
    });

    it('không kiểm tra mã slug id khi đang ở chế độ chỉnh sửa (isEdit = true)', () => {
      const product = {
        id: 'ip16-pro',
        name: 'iPhone 16 Pro Cập Nhật',
        kind: 'phone',
        price: 27990000
      };
      const result = validateProduct(product, true);
      assert.strictEqual(result.valid, true);
    });

    it('báo lỗi khi giá gốc nhỏ hơn giá bán', () => {
      const product = {
        id: 'test-phone',
        name: 'Test Phone',
        kind: 'phone',
        price: 20000000,
        old_price: 15000000 // Sai logic: giá gốc lại rẻ hơn giá khuyến mãi
      };
      const result = validateProduct(product, false);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Giá gốc')));
    });

    it('báo lỗi khi mã màu hex sai quy chuẩn', () => {
      const product = {
        id: 'test-phone',
        name: 'Test Phone',
        kind: 'phone',
        price: 10000000,
        colors: [{ name: 'Màu lỗi', hex: 'not-a-hex' }]
      };
      const result = validateProduct(product, false);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Mã màu')));
    });
  });

  describe('4. applyBulkDiscount - Tính toán giảm giá hàng loạt', () => {
    it('giảm 10% và làm tròn đến hàng chục nghìn', () => {
      // 28.990.000 * 0.9 = 26.091.000 -> làm tròn 10.000 thành 26.090.000
      const discounted = applyBulkDiscount(28990000, 10);
      assert.strictEqual(discounted, 26090000);
    });

    it('giảm 0% giữ nguyên giá', () => {
      assert.strictEqual(applyBulkDiscount(15000000, 0), 15000000);
    });

    it('giảm 100% về 0đ', () => {
      assert.strictEqual(applyBulkDiscount(15000000, 100), 0);
    });
  });

  describe('5. mapDbToProduct & mapProductToDb - Chuyển đổi hai chiều', () => {
    it('chuyển đổi Supabase row sang App product với camelCase chính xác', () => {
      const dbRow = {
        id: 'ip14-likenew',
        name: 'iPhone 14 128GB',
        kind: 'phone',
        brand: 'apple',
        brand_name: 'Apple iPhone',
        condition: 'like_new',
        condition_label: 'Like New 99%',
        badge: 'Bảo hành 12T',
        price: 13890000,
        old_price: 16500000,
        review_count: 210,
        default_color: 'Đen Midnight',
        image_url: 'https://example.com/img.jpg',
        stock: 8,
        is_visible: true
      };

      const appProduct = mapDbToProduct(dbRow);
      assert.strictEqual(appProduct.id, 'ip14-likenew');
      assert.strictEqual(appProduct.brandName, 'Apple iPhone');
      assert.strictEqual(appProduct.condition, 'likenew'); // Mapped to likenew for app compatibility
      assert.strictEqual(appProduct.conditionLabel, 'Like New 99%');
      assert.strictEqual(appProduct.oldPrice, 16500000);
      assert.strictEqual(appProduct.reviewCount, 210);
      assert.strictEqual(appProduct.defaultColor, 'Đen Midnight');
      assert.strictEqual(appProduct.image, 'https://example.com/img.jpg');
    });

    it('chuyển đổi App product sang Supabase row với snake_case và check constraint hợp lệ', () => {
      const appProduct = {
        id: 'ip14-likenew',
        name: 'iPhone 14 128GB',
        brand: 'apple',
        brandName: 'Apple iPhone',
        condition: 'likenew', // Will map to 'like_new'
        conditionLabel: 'Like New 99%',
        badge: 'Bảo hành 12T',
        price: '13.890.000đ',
        oldPrice: '16.500.000đ',
        reviewCount: 210,
        defaultColor: 'Đen Midnight',
        image: 'https://example.com/img.jpg',
        stock: '8'
      };

      const dbRow = mapProductToDb(appProduct);
      assert.strictEqual(dbRow.brand_name, 'Apple iPhone');
      assert.strictEqual(dbRow.condition, 'like_new');
      assert.strictEqual(dbRow.condition_label, 'Like New 99%');
      assert.strictEqual(dbRow.price, 13890000);
      assert.strictEqual(dbRow.old_price, 16500000);
      assert.strictEqual(dbRow.review_count, 210);
      assert.strictEqual(dbRow.default_color, 'Đen Midnight');
      assert.strictEqual(dbRow.image_url, 'https://example.com/img.jpg');
      assert.strictEqual(dbRow.stock, 8);
    });
  });

});
