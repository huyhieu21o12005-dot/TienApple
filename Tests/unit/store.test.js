import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CartManager, ProductFilter, BookingValidator } from '../../Frontend/js/store.js';
import { matchesQuery } from '../../Frontend/js/searchMatch.js';

describe('Tien Mobile TDD Suite - Store & Cart Logic', () => {

  const sampleProducts = [
    {
      id: 'ip16-pro',
      name: 'iPhone 16 Pro 256GB',
      brand: 'apple',
      condition: 'new',
      price: 28990000,
      rating: 5.0,
      storages: ['128GB', '256GB', '512GB', '1TB'],
      defaultColor: 'Titan Tự Nhiên'
    },
    {
      id: 'ip14-likenew',
      name: 'iPhone 14 128GB Quốc Tế',
      brand: 'apple',
      condition: 'likenew',
      price: 13890000,
      rating: 4.8,
      storages: ['128GB', '256GB'],
      defaultColor: 'Đen Midnight'
    },
    {
      id: 'samsung-s24',
      name: 'Samsung Galaxy S24 Ultra 256GB',
      brand: 'samsung',
      condition: 'new',
      price: 27490000,
      rating: 4.9,
      storages: ['256GB', '512GB', '1TB'],
      defaultColor: 'Xám Titan'
    },
    {
      id: 'xiaomi-14',
      name: 'Xiaomi 14 5G 256GB',
      brand: 'xiaomi',
      condition: 'new',
      price: 18490000,
      rating: 4.9,
      storages: ['256GB'],
      defaultColor: 'Xanh Ngọc'
    }
  ];

  describe('1. CartManager - Quản lý giỏ hàng chuẩn Apple Minimal', () => {
    it('khởi tạo giỏ hàng rỗng', () => {
      const cart = new CartManager();
      assert.equal(cart.getItemCount(), 0);
      assert.equal(cart.getSubtotal(), 0);
      assert.deepEqual(cart.getItems(), []);
    });

    it('thêm sản phẩm mới vào giỏ hàng', () => {
      const cart = new CartManager();
      cart.addItem(sampleProducts[0], 1, 'Titan Tự Nhiên', '256GB');
      
      assert.equal(cart.getItemCount(), 1);
      assert.equal(cart.getSubtotal(), 28990000);
      const items = cart.getItems();
      assert.equal(items.length, 1);
      assert.equal(items[0].product.id, 'ip16-pro');
      assert.equal(items[0].color, 'Titan Tự Nhiên');
      assert.equal(items[0].storage, '256GB');
      assert.equal(items[0].quantity, 1);
    });

    it('tăng số lượng khi thêm cùng sản phẩm, cùng màu sắc và cùng dung lượng', () => {
      const cart = new CartManager();
      cart.addItem(sampleProducts[0], 1, 'Titan Tự Nhiên', '256GB');
      cart.addItem(sampleProducts[0], 2, 'Titan Tự Nhiên', '256GB');

      assert.equal(cart.getItemCount(), 3);
      assert.equal(cart.getItems().length, 1);
      assert.equal(cart.getItems()[0].quantity, 3);
      assert.equal(cart.getSubtotal(), 28990000 * 3);
    });

    it('tạo dòng mới khi thêm cùng sản phẩm nhưng khác màu hoặc dung lượng', () => {
      const cart = new CartManager();
      cart.addItem(sampleProducts[0], 1, 'Titan Tự Nhiên', '256GB');
      cart.addItem(sampleProducts[0], 1, 'Titan Đen', '512GB');

      assert.equal(cart.getItemCount(), 2);
      assert.equal(cart.getItems().length, 2);
    });

    it('cập nhật số lượng sản phẩm chính xác', () => {
      const cart = new CartManager();
      cart.addItem(sampleProducts[0], 1, 'Titan Tự Nhiên', '256GB');
      cart.updateQuantity(0, 4);

      assert.equal(cart.getItems()[0].quantity, 4);
      assert.equal(cart.getItemCount(), 4);

      // Nếu set quantity <= 0 thì tự động xóa item
      cart.updateQuantity(0, 0);
      assert.equal(cart.getItemCount(), 0);
      assert.equal(cart.getItems().length, 0);
    });

    it('xóa sản phẩm khỏi giỏ hàng', () => {
      const cart = new CartManager();
      cart.addItem(sampleProducts[0], 1, 'Titan Tự Nhiên', '256GB');
      cart.addItem(sampleProducts[1], 1, 'Đen Midnight', '128GB');
      
      cart.removeItem(0);
      assert.equal(cart.getItems().length, 1);
      assert.equal(cart.getItems()[0].product.id, 'ip14-likenew');
    });

    it('tính toán giảm giá voucher và miễn phí vận chuyển siêu tốc', () => {
      const cart = new CartManager();
      cart.addItem(sampleProducts[0], 1, 'Titan Tự Nhiên', '256GB'); // 28.990.000đ

      // Chưa nhập voucher
      assert.equal(cart.getDiscount(), 0);
      assert.equal(cart.getShippingFee(), 0); // Miễn phí vì > 500k
      assert.equal(cart.getTotal(), 28990000);

      // Áp dụng voucher MEMBER giảm 300.000đ
      const voucherResult = cart.applyVoucher('MEMBER');
      assert.equal(voucherResult.success, true);
      assert.equal(cart.getDiscount(), 300000);
      assert.equal(cart.getTotal(), 28990000 - 300000);
    });
  });

  describe('2. ProductFilter - Lọc & Tìm kiếm sản phẩm theo thiết kế', () => {
    it('lọc sản phẩm theo thương hiệu (brand)', () => {
      const appleProducts = ProductFilter.filterByBrand(sampleProducts, 'apple');
      assert.equal(appleProducts.length, 2);

      const samsungProducts = ProductFilter.filterByBrand(sampleProducts, 'samsung');
      assert.equal(samsungProducts.length, 1);
      assert.equal(samsungProducts[0].name.includes('Samsung'), true);

      const allProducts = ProductFilter.filterByBrand(sampleProducts, 'all');
      assert.equal(allProducts.length, 4);
    });

    it('lọc sản phẩm theo tình trạng (Mới 100% vs Like New 99%)', () => {
      const newProducts = ProductFilter.filterByCondition(sampleProducts, 'new');
      assert.equal(newProducts.length, 3);

      const likenewProducts = ProductFilter.filterByCondition(sampleProducts, 'likenew');
      assert.equal(likenewProducts.length, 1);
      assert.equal(likenewProducts[0].id, 'ip14-likenew');
    });

    it('lọc sản phẩm theo khoảng giá', () => {
      // Dưới 15 triệu
      const under15 = ProductFilter.filterByPriceRange(sampleProducts, 'under15');
      assert.equal(under15.length, 1);
      assert.equal(under15[0].id, 'ip14-likenew');

      // 15 - 25 triệu
      const midRange = ProductFilter.filterByPriceRange(sampleProducts, '15to25');
      assert.equal(midRange.length, 1);
      assert.equal(midRange[0].id, 'xiaomi-14');

      // Trên 25 triệu
      const flagship = ProductFilter.filterByPriceRange(sampleProducts, 'above25');
      assert.equal(flagship.length, 2);
    });

    it('sắp xếp sản phẩm theo giá tăng dần và giảm dần', () => {
      const asc = ProductFilter.sortProducts(sampleProducts, 'price-asc');
      assert.equal(asc[0].price, 13890000);
      assert.equal(asc[asc.length - 1].price, 28990000);

      const desc = ProductFilter.sortProducts(sampleProducts, 'price-desc');
      assert.equal(desc[0].price, 28990000);
      assert.equal(desc[desc.length - 1].price, 13890000);
    });

    it('tìm kiếm sản phẩm theo tên hoặc từ khóa', () => {
      const result = sampleProducts.filter(p => matchesQuery(p, 'pro'));
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'ip16-pro');

      const ultraResult = sampleProducts.filter(p => matchesQuery(p, 'ultra'));
      assert.equal(ultraResult.length, 1);
      assert.equal(ultraResult[0].id, 'samsung-s24');
    });
  });

  describe('3. BookingValidator - Xác thực form đặt lịch sửa chữa', () => {
    it('thành công khi thông tin đặt lịch hợp lệ', () => {
      const validData = {
        name: 'Nguyễn Văn A',
        phone: '0909123456',
        device: 'iPhone 14 Pro Max',
        service: 'Thay màn hình OLED Retina',
        time: 'Hôm nay - 10:00'
      };

      const result = BookingValidator.validateBookingForm(validData);
      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
    });

    it('báo lỗi khi số điện thoại không hợp lệ', () => {
      const invalidPhone = {
        name: 'Nguyễn Văn B',
        phone: '123456', // Không phải 10 số đầu 0
        device: 'iPhone 13',
        service: 'Thay pin dung lượng cao'
      };

      const result = BookingValidator.validateBookingForm(invalidPhone);
      assert.equal(result.isValid, false);
      assert.equal(result.errors.some(e => e.field === 'phone'), true);
    });

    it('báo lỗi khi thiếu tên hoặc thiết bị cần sửa', () => {
      const missingFields = {
        name: '',
        phone: '0908765432',
        device: '',
        service: ''
      };

      const result = BookingValidator.validateBookingForm(missingFields);
      assert.equal(result.isValid, false);
      assert.equal(result.errors.length >= 2, true);
    });

    it('validateOrderForm: thành công khi đầy đủ tên, sđt (hỗ trợ +84) và địa chỉ nhận hàng', () => {
      const orderPayload = {
        name: 'Trần Văn Nam',
        phone: '+84 986 455 457',
        address: '54a8 Ngô Chí Quốc, Tam Bình, Thủ Đức, HCM'
      };

      const result = BookingValidator.validateOrderForm(orderPayload);
      assert.equal(result.isValid, true);
      assert.equal(result.normalizedPhone, '0986455457');
      assert.equal(result.errors.length, 0);
    });

    it('validateOrderForm: báo lỗi khi địa chỉ trống hoặc sđt sai định dạng', () => {
      const invalidOrder = {
        name: 'Lê Thị Thu',
        phone: '012345',
        address: ''
      };

      const result = BookingValidator.validateOrderForm(invalidOrder);
      assert.equal(result.isValid, false);
      assert.equal(result.errors.some(e => e.field === 'phone'), true);
      assert.equal(result.errors.some(e => e.field === 'address'), true);
    });
  });
});
