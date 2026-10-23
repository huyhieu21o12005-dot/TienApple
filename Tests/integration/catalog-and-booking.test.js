import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CartManager, ProductFilter, BookingValidator } from '../../Frontend/js/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('Tien Mobile Integration Test Suite - Real Catalog Data & End-to-End Scenarios', () => {

  const productsRaw = fs.readFileSync(path.join(rootDir, 'Data/products.json'), 'utf-8');
  const products = JSON.parse(productsRaw);

  const servicesRaw = fs.readFileSync(path.join(rootDir, 'Data/services.json'), 'utf-8');
  const services = JSON.parse(servicesRaw);

  it('dữ liệu catalog sản phẩm đầy đủ và hợp lệ', () => {
    assert.equal(Array.isArray(products), true);
    assert.equal(products.length >= 8, true);

    products.forEach(p => {
      assert.ok(p.id, `Sản phẩm thiếu id: ${JSON.stringify(p)}`);
      assert.ok(p.name, `Sản phẩm thiếu name: ${p.id}`);
      assert.ok(p.price > 0, `Sản phẩm giá không hợp lệ: ${p.id}`);
      assert.ok(p.image, `Sản phẩm thiếu ảnh: ${p.id}`);
      assert.ok(Array.isArray(p.colors) && p.colors.length > 0, `Sản phẩm thiếu màu: ${p.id}`);
      assert.ok(Array.isArray(p.storages) && p.storages.length > 0, `Sản phẩm thiếu dung lượng: ${p.id}`);
    });
  });

  it('dữ liệu dịch vụ sửa chữa đầy đủ 4 hạng mục cốt lõi', () => {
    assert.equal(Array.isArray(services), true);
    assert.equal(services.length, 4);

    const serviceIds = services.map(s => s.id);
    assert.ok(serviceIds.includes('screen-oled'));
    assert.ok(serviceIds.includes('battery-ce'));
    assert.ok(serviceIds.includes('mainboard-ic'));
    assert.ok(serviceIds.includes('glass-gorilla'));
  });

  it('kịch bản mua hàng: thêm iPhone 16 Pro + củ sạc 30W và kiểm tra thanh toán', () => {
    const cart = new CartManager();
    const iphone = products.find(p => p.id === 'ip16-pro');
    const charger = products.find(p => p.id === 'charger-30w');

    cart.addItem(iphone, 1, 'Titan Tự Nhiên', '256GB');
    cart.addItem(charger, 1, 'Trắng', 'Chuẩn 30W');

    assert.equal(cart.getItemCount(), 2);
    const expectedSubtotal = iphone.price + charger.price; // 28.990.000 + 650.000 = 29.640.000
    assert.equal(cart.getSubtotal(), expectedSubtotal);

    // Áp dụng voucher MEMBER
    cart.applyVoucher('MEMBER');
    const expectedTotal = expectedSubtotal - 300000;
    assert.equal(cart.getTotal(), expectedTotal);
  });

  it('kịch bản đặt lịch hẹn dịch vụ sửa chữa với dữ liệu thực tế', () => {
    const chosenService = services.find(s => s.id === 'screen-oled');
    const bookingPayload = {
      name: 'Trần Thị Thu Thảo',
      phone: '0918765432',
      device: 'iPhone 15 Pro Max',
      service: chosenService.name,
      time: '14:30 - Chiều nay'
    };

    const validation = BookingValidator.validateBookingForm(bookingPayload);
    assert.equal(validation.isValid, true);
    assert.equal(validation.errors.length, 0);
  });
});
