import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOutOfStock,
  productCardHtml,
  emptyCatalogHtml,
  swatchesHtml,
  storageChipsHtml,
  cartItemHtml,
  emptyCartHtml
} from '../../Frontend/js/templates.js';

const evil = `"><img src=x onerror=alert(1)>`;
const phone = {
  id: 'ip16-pro',
  name: 'iPhone 16 Pro',
  conditionLabel: 'Mới 100%',
  badge: '0% LS',
  price: 28990000,
  oldPrice: 31990000,
  rating: 4.8,
  reviewCount: 64,
  image: 'https://cdn.example.com/ip16.png',
  description: 'Chip A18 Pro'
};

describe('templates - dựng HTML an toàn', () => {
  it('isOutOfStock chỉ true khi có trường stock và stock <= 0', () => {
    assert.equal(isOutOfStock({ stock: 0 }), true);
    assert.equal(isOutOfStock({ stock: -1 }), true);
    assert.equal(isOutOfStock({ stock: 3 }), false);
    assert.equal(isOutOfStock({}), false);
    assert.equal(isOutOfStock({ stock: null }), false);
    assert.equal(isOutOfStock(null), false);
  });

  it('productCardHtml hiển thị giá, giảm giá, nút thêm giỏ', () => {
    const html = productCardHtml(phone);
    assert.ok(html.includes('iPhone 16 Pro'));
    assert.ok(html.includes('28.990.000'));
    assert.ok(html.includes('-9%'));
    assert.ok(html.includes('★ 4.8'));
    assert.ok(html.includes('+ Giỏ hàng'));
    assert.ok(html.includes('0% LS'));
  });

  it('productCardHtml cho phụ kiện dùng nhãn Chính hãng và bỏ badge/giá cũ khi thiếu', () => {
    const html = productCardHtml({ id: 'c1', name: 'Sạc', price: 500000 }, { accessory: true });
    assert.ok(html.includes('Chính hãng'));
    assert.ok(!html.includes('line-through'));
    assert.ok(!html.includes('text-[#0071E3] bg-[#0071E3]/5'));
    assert.ok(html.includes('★ 5.0'));
  });

  it('productCardHtml hiện Hết hàng và khóa nút khi stock = 0', () => {
    const html = productCardHtml({ ...phone, stock: 0 });
    assert.ok(html.includes('Hết hàng'));
    assert.ok(html.includes('disabled'));
    assert.ok(!html.includes('quickAddToCart'));
  });

  it('productCardHtml escape mọi trường người dùng nhập, không cho chèn thẻ hay thoát onclick', () => {
    const html = productCardHtml({
      ...phone,
      id: `a');alert(1);('`,
      name: evil,
      badge: evil,
      description: evil,
      conditionLabel: evil,
      image: 'javascript:alert(1)'
    });
    assert.ok(!html.includes('<img src=x'), 'không được có thẻ img chèn thêm');
    assert.ok(!html.includes('javascript:'));
    assert.ok(!html.includes(`'a');alert`));
    assert.ok(html.includes('&lt;img src=x'));
  });

  it('productCardHtml chịu được rating/giá không hợp lệ', () => {
    const html = productCardHtml({ id: 'x', name: 'X', price: 'abc', rating: 'n/a', reviewCount: 'zz' });
    assert.ok(html.includes('★ 5.0'));
    assert.ok(html.includes('(0 đánh giá)'));
    assert.match(html, /0\s*đ/);
  });

  it('emptyCatalogHtml và emptyCartHtml có thông báo rỗng', () => {
    assert.ok(emptyCatalogHtml().includes('Không tìm thấy thiết bị phù hợp'));
    assert.ok(emptyCartHtml().includes('Giỏ hàng của bạn đang trống'));
  });

  it('swatchesHtml đánh dấu màu đang chọn, chặn màu độc hại, có mặc định khi rỗng', () => {
    const html = swatchesHtml([
      { name: 'Đen', hex: '#000000' },
      { name: evil, hex: 'red;background:url(//evil)' }
    ], 'Đen');
    assert.ok(html.includes('swatch-btn active'));
    assert.ok(html.includes('background-color: #000000'));
    assert.ok(html.includes('background-color: #FFFFFF'));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(swatchesHtml([], '').includes('Tiêu chuẩn'));
    assert.ok(swatchesHtml(undefined, '').includes('Tiêu chuẩn'));
  });

  it('storageChipsHtml đánh dấu dung lượng đang chọn và escape', () => {
    const html = storageChipsHtml(['128GB', evil], '128GB');
    assert.ok(html.includes('storage-chip active'));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(storageChipsHtml(null, '').includes('Chuẩn Zin'));
  });

  it('cartItemHtml tính thành tiền theo số lượng và escape dữ liệu', () => {
    const html = cartItemHtml({ product: { ...phone, name: evil }, quantity: 2, color: evil, storage: '256GB' }, 3);
    assert.ok(html.includes('57.980.000'));
    assert.ok(html.includes('removeCartItem(3)'));
    assert.ok(html.includes('updateCartQty(3, 1)'));
    assert.ok(html.includes('updateCartQty(3, 3)'));
    assert.ok(!html.includes('<img src=x'));
  });

  it('cartItemHtml chịu được item thiếu dữ liệu', () => {
    const html = cartItemHtml({ product: undefined, quantity: 'x' }, 0);
    assert.ok(html.includes('updateCartQty(0, 0)'));
    assert.match(html, /0\s*đ/);
  });
});
