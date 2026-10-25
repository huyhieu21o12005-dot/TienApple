import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, normalizeRule, planPricing, pickRule, roundUp, baseOf } from '../../Frontend/admin/pricing.js';

const P = (id, name, brandName, base, extra = {}) => ({ id, name, brandName, basePrice: base, price: base, ...extra });
const products = [
  P('a', 'iPhone 17 Pro Max 256GB', 'Apple iPhone', 35000000),
  P('b', 'iPhone 8 64GB', 'Apple iPhone', 2000000),
  P('c', 'Galaxy S24 Ultra 256GB', 'Samsung', 22000000)
];

test('parseAmount', () => {
  assert.equal(parseAmount('2.000.000'), 2000000);
  assert.equal(parseAmount(''), null);
  assert.ok(Number.isNaN(parseAmount('abc')));
  assert.equal(parseAmount('-500000'), -500000);
});

test('normalizeRule bỏ quy tắc không có giá trị', () => {
  assert.equal(normalizeRule({ value: '' }), null);
  assert.equal(normalizeRule({ value: 'x' }), null);
  assert.deepEqual(normalizeRule({ brand: 'Apple', value: '500.000' }), { brand: 'apple', from: null, to: null, keyword: '', mode: 'fixed', value: 500000 });
});

test('ví dụ của cửa hàng: iPhone 17 Pro Max +2tr, iPhone 8 chỉ +500k', () => {
  const rules = [
    { value: '500000' },
    { brand: 'apple', from: '20000000', value: '2000000' }
  ];
  const out = Object.fromEntries(planPricing(products, rules).map(r => [r.id, r]));
  assert.equal(out.a.newPrice, 37000000);
  assert.equal(out.b.newPrice, 2500000);
  assert.equal(out.c.newPrice, 22500000);
});

test('quy tắc cụ thể hơn thắng: từ khóa > khoảng giá > hãng > chung', () => {
  const rules = [
    { value: '100000' },
    { brand: 'apple', value: '200000' },
    { from: '1', to: '5000000', value: '300000' },
    { keyword: 'iphone 8', value: '400000' }
  ];
  assert.equal(pickRule(products[1], rules.map(normalizeRule)).rule.value, 400000);
  assert.equal(pickRule(products[0], rules.map(normalizeRule)).rule.value, 200000);
  assert.equal(pickRule(products[2], rules.map(normalizeRule)).rule.value, 100000);
});

test('từ khóa không phân biệt dấu cách và hoa thường', () => {
  const r = planPricing(products, [{ keyword: 'IPHONE17PROMAX', value: '1000000' }]);
  assert.equal(r[0].markup, 1000000);
  assert.equal(r[1].markup, 0);
});

test('tính từ giá gốc nên áp dụng lại không cộng dồn', () => {
  const rules = [{ value: '500000' }];
  const once = planPricing(products, rules);
  const applied = products.map((p, i) => ({ ...p, price: once[i].newPrice }));
  const twice = planPricing(applied, rules);
  assert.deepEqual(twice.map(r => r.newPrice), once.map(r => r.newPrice));
});

test('phần trăm, làm tròn lên và số âm (giảm)', () => {
  const r = planPricing([P('x', 'A', 'b', 10000000)], [{ mode: 'percent', value: '3.3' }], { roundStep: 100000 });
  assert.equal(r[0].newPrice, 10400000);
  const d = planPricing([P('x', 'A', 'b', 10000000)], [{ value: '-500000' }]);
  assert.equal(d[0].newPrice, 9500000);
});

test('không có quy tắc: hoàn về giá gốc, giá gạch ngang dịch theo', () => {
  const p = P('x', 'A', 'b', 10000000, { price: 10500000, oldPrice: 11500000 });
  const [r] = planPricing([p], []);
  assert.equal(r.newPrice, 10000000);
  assert.equal(r.newOldPrice, 11000000);
  const [k] = planPricing([p], [{ value: '500000' }], { shiftOldPrice: false });
  assert.equal(k.newOldPrice, 11500000);
});

test('baseOf và roundUp', () => {
  assert.equal(baseOf({ price: 5 }), 5);
  assert.equal(baseOf({ price: 5, basePrice: 3 }), 3);
  assert.equal(roundUp(1234, 1000), 2000);
  assert.equal(roundUp(1234.4, 0), 1234);
});
