/**
 * Tien Mobile - Store & Cart Management Module
 * Architecture: Clean State Management & TDD Verified
 */

export class CartManager {
  constructor(initialItems = []) {
    this.items = [...initialItems];
    this.appliedVoucher = null;
    this.voucherDiscount = 0;
  }

  getItems() {
    return this.items;
  }

  getItemCount() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
  }

  addItem(product, quantity = 1, color = '', storage = '') {
    const selectedColor = color || product.defaultColor || '';
    const selectedStorage = storage || (product.storages && product.storages[0]) || '';

    // Tìm xem đã có cùng product.id, color và storage trong giỏ chưa
    const existingIndex = this.items.findIndex(
      item => item.product.id === product.id &&
              item.color === selectedColor &&
              item.storage === selectedStorage
    );

    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        product,
        quantity,
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

    if (quantity <= 0) {
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = quantity;
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
      return { success: true, message: 'Áp dụng mã giảm giá 300.000₫ thành công!' };
    }
    if (normalized === 'VIP10') {
      this.appliedVoucher = normalized;
      this.voucherDiscount = Math.round(this.getSubtotal() * 0.1);
      return { success: true, message: 'Áp dụng mã giảm giá 10% thành công!' };
    }
    return { success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' };
  }

  getDiscount() {
    return this.voucherDiscount;
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
          this.items = JSON.parse(saved);
        }
      } catch (e) {
        this.items = [];
      }
    }
  }
}

export class ProductFilter {
  static filterByBrand(products, brand) {
    if (!brand || brand.toLowerCase() === 'all') {
      return [...products];
    }
    return products.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
  }

  static filterByCondition(products, condition) {
    if (!condition || condition.toLowerCase() === 'all') {
      return [...products];
    }
    return products.filter(p => p.condition.toLowerCase() === condition.toLowerCase());
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

  static searchProducts(products, query) {
    if (!query || !query.trim()) {
      return [...products];
    }
    const q = query.trim().toLowerCase();
    return products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.chip && p.chip.toLowerCase().includes(q)) ||
      (p.brandName && p.brandName.toLowerCase().includes(q))
    );
  }
}

export class BookingValidator {
  static validateBookingForm({ name, phone, device, service }) {
    const errors = [];

    if (!name || !name.trim()) {
      errors.push({ field: 'name', message: 'Vui lòng nhập họ và tên của bạn.' });
    }

    // Số điện thoại Việt Nam: 10 chữ số, bắt đầu bằng 0 (03, 05, 07, 08, 09)
    const phoneRegex = /^(0)(3|5|7|8|9)[0-9]{8}$/;
    const cleanPhone = (phone || '').replace(/[\s.-]/g, '');
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
      errors
    };
  }
}
