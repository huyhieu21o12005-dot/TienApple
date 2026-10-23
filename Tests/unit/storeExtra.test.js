import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CartManager, ProductFilter, BookingValidator } from '../../Frontend/js/store.js';

const phone = { id: 'p1', name: 'Phone 1', price: 20000000, defaultColor: 'Đen', storages: ['128GB'] };
const acc = { id: 'a1', name: 'Ốp', price: 200000 };

function installFakeStorage(initial = {}) {
  const data = { ...initial };
  globalThis.window = {
    localStorage: {
      getItem: k => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = v; },
      throwOnSet: false
    }
  };
  return data;
}

describe('CartManager - lỗi biên và đồng bộ giá', () => {
  afterEach(() => { delete globalThis.window; });

  it('addItem ép số lượng về số nguyên >= 1', () => {
    const cart = new CartManager();
    cart.addItem(phone, 0);
    cart.addItem(acc, -3);
    cart.addItem(acc, 'abc');
    assert.equal(cart.getItems()[0].quantity, 1);
    assert.equal(cart.getItems()[1].quantity, 2); // hai lần thêm cùng phụ kiện, mỗi lần 1
    assert.equal(cart.getItemCount(), 3);
  });

  it('updateQuantity xử lý số lượng không hợp lệ và chỉ số ngoài phạm vi', () => {
    const cart = new CartManager();
    cart.addItem(phone, 2);
    cart.updateQuantity(5, 3);
    cart.updateQuantity(-1, 3);
    assert.equal(cart.getItems()[0].quantity, 2);
    cart.updateQuantity(0, 3.9);
    assert.equal(cart.getItems()[0].quantity, 3);
    cart.updateQuantity(0, NaN);
    assert.equal(cart.getItems().length, 0);
  });

  it('removeItem bỏ qua chỉ số sai và xóa đúng dòng', () => {
    const cart = new CartManager([{ product: phone, quantity: 1, color: '', storage: '' }]);
    cart.removeItem(9);
    assert.equal(cart.getItems().length, 1);
    cart.removeItem(0);
    assert.equal(cart.getItems().length, 0);
  });

  it('voucher VIP10 luôn tính theo giỏ hàng hiện tại (không bị lệch khi thêm hàng)', () => {
    const cart = new CartManager();
    cart.addItem(acc, 1); // 200.000
    assert.equal(cart.applyVoucher('vip10').success, true);
    assert.equal(cart.getDiscount(), 20000);
    cart.addItem(phone, 1); // 20.200.000
    assert.equal(cart.getDiscount(), 2020000);
    assert.equal(cart.getTotal(), 20200000 - 2020000);
  });

  it('giảm giá không vượt quá tạm tính và bằng 0 khi giỏ rỗng', () => {
    const cart = new CartManager();
    assert.equal(cart.getDiscount(), 0);
    cart.addItem(acc, 1);
    cart.applyVoucher('TIENMOBILE300');
    assert.equal(cart.getDiscount(), 200000);
    assert.equal(cart.getTotal(), 35000); // giảm tối đa bằng tạm tính, còn phí vận chuyển
    cart.clearCart();
    assert.equal(cart.getDiscount(), 0);
    assert.equal(cart.voucherRate, 0);
  });

  it('voucher sai hoặc rỗng bị từ chối', () => {
    const cart = new CartManager();
    assert.equal(cart.applyVoucher('SAI').success, false);
    assert.equal(cart.applyVoucher('').success, false);
    assert.equal(cart.applyVoucher(undefined).success, false);
  });

  it('phí vận chuyển 35.000đ khi đơn dưới 500.000đ', () => {
    const cart = new CartManager();
    cart.addItem(acc, 1);
    assert.equal(cart.getShippingFee(), 35000);
    assert.equal(cart.getTotal(), 235000);
  });

  it('lưu và đọc giỏ hàng từ localStorage, bỏ dữ liệu hỏng', () => {
    const data = installFakeStorage();
    const cart = new CartManager();
    cart.addItem(phone, 2);
    assert.ok(data.tien_mobile_cart);

    const restored = new CartManager();
    restored.loadFromLocalStorage();
    assert.equal(restored.getItemCount(), 2);

    const broken = new CartManager();
    broken.addItem(acc, 1);
    data.tien_mobile_cart = '{not json';
    broken.loadFromLocalStorage();
    assert.deepEqual(broken.getItems(), []);

    data.tien_mobile_cart = JSON.stringify({ not: 'array' });
    const wrongShape = new CartManager();
    wrongShape.loadFromLocalStorage();
    assert.deepEqual(wrongShape.getItems(), []);

    data.tien_mobile_cart = JSON.stringify([
      { product: phone, quantity: 1, color: '', storage: '' },
      { product: { id: 5, price: 1 }, quantity: 1 },
      { product: phone, quantity: 0 },
      null
    ]);
    const filtered = new CartManager();
    filtered.loadFromLocalStorage();
    assert.equal(filtered.getItems().length, 1);
  });

  it('lưu giỏ hàng không văng lỗi khi localStorage bị chặn', () => {
    globalThis.window = {
      localStorage: { setItem() { throw new Error('quota'); }, getItem() { return null; } }
    };
    const cart = new CartManager();
    assert.doesNotThrow(() => cart.addItem(phone, 1));
    assert.equal(cart.getItemCount(), 1);
  });

  it('reconcile cập nhật giá mới, loại sản phẩm bị xóa hoặc hết hàng', () => {
    installFakeStorage();
    const cart = new CartManager();
    cart.addItem(phone, 1);
    cart.addItem(acc, 1);
    cart.addItem({ id: 'gone', name: 'Đã xóa', price: 1 }, 1);
    cart.addItem({ id: 'soldout', name: 'Hết', price: 1 }, 1);

    const result = cart.reconcile([
      { ...phone, price: 18000000 },
      { ...acc },
      { id: 'soldout', name: 'Hết', price: 1, stock: 0 }
    ]);

    assert.deepEqual(result.removed.sort(), ['Hết', 'Đã xóa'].sort());
    assert.deepEqual(result.priceChanged, ['Phone 1']);
    assert.equal(cart.getItems().length, 2);
    assert.equal(cart.getItems()[0].product.price, 18000000);
    assert.equal(cart.getSubtotal(), 18200000);
  });

  it('reconcile với danh mục không hợp lệ xóa hết các dòng', () => {
    const cart = new CartManager();
    cart.addItem(phone, 1);
    const result = cart.reconcile(null);
    assert.equal(result.removed.length, 1);
    assert.equal(cart.getItems().length, 0);
  });

  it('formatCurrency định dạng đ', () => {
    assert.ok(CartManager.formatCurrency(1500000).endsWith('đ'));
    assert.ok(CartManager.formatCurrency(1500000).includes('1.500.000'));
  });
});

describe('ProductFilter - dữ liệu thiếu trường', () => {
  const list = [
    { id: '1', name: 'A', brand: 'apple', condition: 'new', price: 10000000, rating: 4, description: 'Màn đẹp', chip: 'A18', brandName: 'Apple' },
    { id: '2', name: 'B', price: 20000000 }, // phụ kiện không có brand/condition
    { id: '3', name: 'C', brand: 'samsung', condition: 'likenew', price: 30000000, rating: 5 }
  ];

  it('lọc theo hãng và tình trạng không văng lỗi khi thiếu trường', () => {
    assert.deepEqual(ProductFilter.filterByBrand(list, 'apple').map(p => p.id), ['1']);
    assert.deepEqual(ProductFilter.filterByCondition(list, 'new').map(p => p.id), ['1']);
    assert.equal(ProductFilter.filterByBrand(list, 'ALL').length, 3);
    assert.equal(ProductFilter.filterByCondition(list, '').length, 3);
  });

  it('lọc theo khoảng giá', () => {
    assert.deepEqual(ProductFilter.filterByPriceRange(list, 'under15').map(p => p.id), ['1']);
    assert.deepEqual(ProductFilter.filterByPriceRange(list, '15to25').map(p => p.id), ['2']);
    assert.deepEqual(ProductFilter.filterByPriceRange(list, 'above25').map(p => p.id), ['3']);
    assert.equal(ProductFilter.filterByPriceRange(list, 'all').length, 3);
    assert.equal(ProductFilter.filterByPriceRange(list, 'khac').length, 3);
    assert.equal(ProductFilter.filterByPriceRange(list).length, 3);
  });

  it('sắp xếp theo đánh giá, giá và mặc định giữ thứ tự', () => {
    assert.deepEqual(ProductFilter.sortProducts(list, 'rating').map(p => p.id), ['3', '1', '2']);
    assert.deepEqual(ProductFilter.sortProducts(list, 'price-desc').map(p => p.id), ['3', '2', '1']);
    assert.deepEqual(ProductFilter.sortProducts(list, 'newest').map(p => p.id), ['1', '2', '3']);
    assert.deepEqual(ProductFilter.sortProducts(list, undefined).map(p => p.id), ['1', '2', '3']);
  });

  it('tìm kiếm theo mô tả, chip, tên hãng và bỏ qua khoảng trắng', () => {
    assert.deepEqual(ProductFilter.searchProducts(list, 'màn đẹp').map(p => p.id), ['1']);
    assert.deepEqual(ProductFilter.searchProducts(list, ' a18 ').map(p => p.id), ['1']);
    assert.deepEqual(ProductFilter.searchProducts(list, 'APPLE').map(p => p.id), ['1']);
    assert.equal(ProductFilter.searchProducts(list, '   ').length, 3);
    assert.equal(ProductFilter.searchProducts(list, null).length, 3);
    assert.equal(ProductFilter.searchProducts(list, 'không có').length, 0);
  });
});

describe('BookingValidator - số điện thoại và trường trống', () => {
  it('chấp nhận số +84 và có dấu cách', () => {
    const r = BookingValidator.validateBookingForm({ name: 'An', phone: '+84 912 345 678', device: 'iPhone', service: 'Thay pin' });
    assert.equal(r.isValid, true);
    assert.equal(r.normalizedPhone, '0912345678');
  });

  it('báo đủ lỗi khi tất cả trường trống', () => {
    const r = BookingValidator.validateBookingForm({});
    assert.deepEqual(r.errors.map(e => e.field), ['name', 'phone', 'device', 'service']);
  });

  it('đơn hàng: địa chỉ quá ngắn và thiếu tên đều bị từ chối', () => {
    const r = BookingValidator.validateOrderForm({ name: '', phone: '0912345678', address: 'abc' });
    assert.deepEqual(r.errors.map(e => e.field), ['name', 'address']);
    assert.equal(BookingValidator.validateOrderForm({}).errors.length, 3);
  });
});
