/**
 * Tien Mobile - Store & Cart Management Module
 * Architecture: Clean State Management & TDD Verified
 */

export class CartManager {
  constructor(initialItems = []) {
    this.items = [...initialItems];
    this.appliedVoucher = null;
    this.voucherDiscount = 0; // giảm cố định (đồng)
    this.voucherRate = 0; // giảm theo tỉ lệ, tính lại theo giỏ hàng hiện tại
  }

  getItems() {
    return this.items;
  }

  getItemCount() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
  }

  addItem(product, quantity = 1, color = '', storage = '') {
    const qty = Math.max(1, Math.floor(Number(quantity)) || 1);
    const selectedColor = color || product.defaultColor || '';
    const selectedStorage = storage || (product.storages && product.storages[0]) || '';

    // Tìm xem đã có cùng product.id, color và storage trong giỏ chưa
    const existingIndex = this.items.findIndex(
      item => item.product.id === product.id &&
              item.color === selectedColor &&
              item.storage === selectedStorage
    );

    if (existingIndex > -1) {
      this.items[existingIndex].quantity += qty;
    } else {
      this.items.push({
        product,
        quantity: qty,
        color: selectedColor,
        storage: selectedStorage
      });
    }

    this._saveToLocalStorage();
    return this.items;
  }

  updateQuantity(itemIndex, quantity) {
    if (itemIndex < 0 || itemIndex >= this.items.length) {
      return this.items;
    }

    const qty = Math.floor(Number(quantity));
    if (!isFinite(qty) || qty <= 0) {
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = qty;
    }

    this._saveToLocalStorage();
    return this.items;
  }

  removeItem(itemIndex) {
    if (itemIndex >= 0 && itemIndex < this.items.length) {
      this.items.splice(itemIndex, 1);
      this._saveToLocalStorage();
    }
    return this.items;
  }

  clearCart() {
    this.items = [];
    this.appliedVoucher = null;
    this.voucherDiscount = 0;
    this.voucherRate = 0;
    this._saveToLocalStorage();
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }

  applyVoucher(code) {
    const normalized = (code || '').trim().toUpperCase();
    if (normalized === 'MEMBER' || normalized === 'TIENMOBILE300') {
      this.appliedVoucher = normalized;
      this.voucherDiscount = 300000;
      this.voucherRate = 0;
      return { success: true, message: 'Áp dụng mã giảm giá 300.000₫ thành công!' };
    }
    if (normalized === 'VIP10') {
      this.appliedVoucher = normalized;
      this.voucherDiscount = 0;
      this.voucherRate = 0.1;
      return { success: true, message: 'Áp dụng mã giảm giá 10% thành công!' };
    }
    return { success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' };
  }

  getDiscount() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0) return 0;
    const discount = this.voucherDiscount + Math.round(subtotal * this.voucherRate);
    return Math.min(discount, subtotal);
  }

  getShippingFee() {
    // Đơn hàng > 500.000đ được miễn phí vận chuyển siêu tốc 2H
    return this.getSubtotal() >= 500000 || this.items.length === 0 ? 0 : 35000;
  }

  getTotal() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0) return 0;
    const total = subtotal - this.getDiscount() + this.getShippingFee();
    return Math.max(0, total);
  }

  static formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount).replace('₫', 'đ');
  }

  _saveToLocalStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('tien_mobile_cart', JSON.stringify(this.items));
      } catch (e) {
        // Safe fallback
      }
    }
  }

  loadFromLocalStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('tien_mobile_cart');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.items = Array.isArray(parsed) ? parsed.filter(CartManager.isValidItem) : [];
        }
      } catch (e) {
        this.items = [];
      }
    }
  }

  static isValidItem(item) {
    return !!item &&
      typeof item === 'object' &&
      !!item.product &&
      typeof item.product.id === 'string' &&
      isFinite(Number(item.product.price)) &&
      Number(item.quantity) >= 1;
  }

  /**
   * Đồng bộ giỏ hàng đã lưu với danh mục hiện tại: cập nhật giá/tên/ảnh mới nhất,
   * loại sản phẩm đã bị xóa, ẩn hoặc hết hàng. Giá thay đổi liên tục nên không được tin giá đã lưu.
   * @param {Array<object>} catalog
   * @returns {{ removed: string[], priceChanged: string[] }}
   */
  reconcile(catalog) {
    const byId = new Map((Array.isArray(catalog) ? catalog : []).filter(Boolean).map(p => [p.id, p]));
    const removed = [];
    const priceChanged = [];
    const next = [];

    for (const item of this.items) {
      const fresh = byId.get(item.product.id);
      const soldOut = fresh && fresh.stock !== undefined && fresh.stock !== null && Number(fresh.stock) <= 0;
      if (!fresh || soldOut) {
        removed.push(item.product.name || item.product.id);
        continue;
      }
      if (Number(fresh.price) !== Number(item.product.price)) {
        priceChanged.push(fresh.name || fresh.id);
      }
      next.push({ ...item, product: fresh });
    }

    this.items = next;
    this._saveToLocalStorage();
    return { removed, priceChanged };
  }
}

export class ProductFilter {
  /** Số bộ lọc đang khác mặc định (tình trạng, khoảng giá, sắp xếp, từ khóa) để hiện trên nút Lọc. */
  static activeFilterCount({ condition = 'all', price = 'all', sort = 'newest', storage = 'all', search = '' } = {}) {
    return [condition !== 'all', price !== 'all', sort !== 'newest', storage !== 'all', String(search).trim() !== ''].filter(Boolean).length;
  }

  static filterByBrand(products, brand) {
    if (!brand || brand.toLowerCase() === 'all') {
      return [...products];
    }
    return products.filter(p => (p.brand || '').toLowerCase() === brand.toLowerCase());
  }

  static filterByCondition(products, condition) {
    if (!condition || condition.toLowerCase() === 'all') {
      return [...products];
    }
    return products.filter(p => (p.condition || '').toLowerCase() === condition.toLowerCase());
  }

  static filterByPriceRange(products, rangeKey) {
    if (!rangeKey || rangeKey === 'all') {
      return [...products];
    }
    switch (rangeKey) {
      case 'under15':
        return products.filter(p => p.price < 15000000);
      case '15to25':
        return products.filter(p => p.price >= 15000000 && p.price <= 25000000);
      case 'above25':
        return products.filter(p => p.price > 25000000);
      default:
        return [...products];
    }
  }

  static sortProducts(products, sortBy) {
    const list = [...products];
    switch (sortBy) {
      case 'price-asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return list.sort((a, b) => b.price - a.price);
      case 'rating':
        return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest':
      default:
        return list;
    }
  }

  /** Dung lượng ghi trong tên máy ("256GB", "1 TB") về dạng "256GB"; không ghi thì rỗng. */
  static storageOf(product) {
    const m = /(\d+)\s*(gb|tb)/i.exec(product?.name || '');
    return m ? `${Number(m[1])}${m[2].toUpperCase()}` : '';
  }

  /** Các dung lượng có thật trong danh sách, xếp từ nhỏ đến lớn. */
  static storageOptions(products) {
    const size = (v) => parseInt(v, 10) * (v.endsWith('TB') ? 1024 : 1);
    return [...new Set(products.map(p => ProductFilter.storageOf(p)).filter(Boolean))].sort((a, b) => size(a) - size(b));
  }

  static filterByStorage(products, storage) {
    if (!storage || storage === 'all') return [...products];
    return products.filter(p => ProductFilter.storageOf(p) === storage);
  }
}

export class BookingValidator {
  static validateBookingForm({ name, phone, device, service }) {
    const errors = [];

    if (!name || !name.trim()) {
      errors.push({ field: 'name', message: 'Vui lòng nhập họ và tên của bạn.' });
    }

    // Số điện thoại Việt Nam: 10 chữ số, bắt đầu bằng 0 (03, 05, 07, 08, 09), hỗ trợ định dạng +84
    let cleanPhone = (phone || '').replace(/[\s.-]/g, '');
    cleanPhone = cleanPhone.replace(/^\+?84/, '0');
    const phoneRegex = /^(0)(3|5|7|8|9)[0-9]{8}$/;
    if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
      errors.push({ field: 'phone', message: 'Số điện thoại không hợp lệ (cần 10 chữ số).' });
    }

    if (!device || !device.trim()) {
      errors.push({ field: 'device', message: 'Vui lòng nhập dòng điện thoại cần sửa.' });
    }

    if (!service || !service.trim()) {
      errors.push({ field: 'service', message: 'Vui lòng chọn dịch vụ sửa chữa.' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalizedPhone: cleanPhone
    };
  }

  static validateOrderForm({ name, phone, address }) {
    const errors = [];

    if (!name || !name.trim()) {
      errors.push({ field: 'name', message: 'Vui lòng nhập họ và tên nhận hàng.' });
    }

    let cleanPhone = (phone || '').replace(/[\s.-]/g, '');
    cleanPhone = cleanPhone.replace(/^\+?84/, '0');
    const phoneRegex = /^(0)(3|5|7|8|9)[0-9]{8}$/;
    if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
      errors.push({ field: 'phone', message: 'Số điện thoại nhận hàng không hợp lệ (cần 10 chữ số).' });
    }

    if (!address || !address.trim() || address.trim().length < 5) {
      errors.push({ field: 'address', message: 'Vui lòng nhập địa chỉ cụ thể để giao hàng hỏa tốc 2H.' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalizedPhone: cleanPhone
    };
  }
}
