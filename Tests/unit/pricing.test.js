import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parsePercent, baseOf, roundUp, markupPrice, bandOf, pricingGroups, matchPricing } from '../../Frontend/admin/pricing.js';

const P = (id, name, brandName, base, extra = {}) => ({ id, name, brandName, brand: brandName.toLowerCase(), condition: 'new', basePrice: base, price: base, ...extra });
const list = [
  P('a', 'iPhone 17 Pro Max 256GB', 'Apple', 35000000),
  P('b', 'iPhone 8 64GB', 'Apple', 2000000),
  P('c', 'Galaxy S24 Ultra', 'Samsung', 22000000),
  P('d', 'iPhone 11', 'Apple', 6000000, { condition: 'likenew' })
];

test('parseAmount / parsePercent', () => {
  assert.equal(parseAmount('2.000.000'), 2000000);
  assert.equal(parseAmount(''), null);
  assert.ok(Number.isNaN(parseAmount('abc')));
  assert.equal(parseAmount('-500000'), -500000);
  assert.equal(parsePercent('3.3'), 3.3);
  assert.equal(parsePercent('3,5%'), 3.5);
});

test('markupPrice: đồng, phần trăm, làm tròn lên, giảm giá', () => {
  assert.equal(markupPrice(2000000, 'fixed', '500000'), 2500000);
  assert.equal(markupPrice(10000000, 'percent', '3.3', 100000), 10400000);
  assert.equal(markupPrice(10000000, 'fixed', '-500.000'), 9500000);
  assert.equal(markupPrice(1000, 'fixed', '-5000'), 0);
  assert.equal(markupPrice(1000, 'fixed', ''), null);
  assert.equal(markupPrice(1000, 'fixed', 'x'), null);
});

test('baseOf và roundUp', () => {
  assert.equal(baseOf({ price: 5 }), 5);
  assert.equal(baseOf({ price: 5, basePrice: 3 }), 3);
  assert.equal(roundUp(1234, 1000), 2000);
  assert.equal(roundUp(1234.4, 0), 1234);
});

test('bandOf theo giá gốc', () => {
  assert.equal(bandOf(list[0]), 'price:5');
  assert.equal(bandOf(list[1]), 'price:0');
  assert.equal(bandOf({ price: 7000000 }), 'price:2');
});

test('pricingGroups: hãng, giá gốc, tình trạng; bỏ ô rỗng', () => {
  const groups = pricingGroups(list);
  assert.deepEqual(groups.map(g => g.id), ['brand', 'price', 'cond']);
  assert.equal(groups[0].options.find(o => o.id === 'brand:apple').count, 3);
  assert.ok(!groups[1].options.some(o => o.id === 'price:3'));
});

test('matchPricing: cùng nhóm hoặc, khác nhóm và, không tích là tất cả', () => {
  assert.deepEqual(matchPricing(list, []), ['a', 'b', 'c', 'd']);
  assert.deepEqual(matchPricing(list, ['brand:apple']), ['a', 'b', 'd']);
  assert.deepEqual(matchPricing(list, ['brand:apple', 'price:5']), ['a']);
  assert.deepEqual(matchPricing(list, ['brand:apple', 'brand:samsung', 'price:5', 'price:4']), ['a', 'c']);
  assert.deepEqual(matchPricing(list, ['cond:likenew']), ['d']);
});
