import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { facetValues, buildFacetGroups } from '../../Frontend/admin/bulkSelect.js';

const P = [
  { id: 'a', name: 'iPhone 16', brandName: 'Apple iPhone', condition: 'new', kind: 'phone', is_visible: true, stock: 3, image: 'x.png', badge: '' },
  { id: 'b', name: 'iPhone 15 cũ', brandName: 'Apple iPhone', condition: 'likenew', kind: 'phone', is_visible: false, stock: 1, image: '', badge: 'Máy cũ' },
  { id: 'c', name: 'S24', brandName: 'Samsung Galaxy', condition: 'new', kind: 'phone', is_visible: true, stock: 0, image: 'y.png', badge: 'Hot deal' },
  { id: 'd', name: 'Củ sạc', brandName: '', brand: '', condition: 'new', kind: 'accessory', is_visible: true, stock: 5, image: '', badge: '' }
];

describe('bulkSelect', () => {
  it('facetValues mô tả đúng sản phẩm', () => {
    const v = facetValues(P[1]);
    assert.ok(v.includes('brand:apple iphone'));
    assert.ok(v.includes('cond:likenew'));
    assert.ok(v.includes('state:hidden'));
    assert.ok(v.includes('state:noimage'));
    assert.ok(v.includes('badge:máy cũ'));
    assert.ok(facetValues(P[2]).includes('state:outofstock'));
  });
  it('buildFacetGroups có số lượng và bỏ ô rỗng', () => {
    const groups = buildFacetGroups(P);
    const brand = groups.find(g => g.id === 'brand');
    assert.equal(brand.options[0].label, 'Apple iPhone');
    assert.equal(brand.options[0].count, 2);
    const state = groups.find(g => g.id === 'state');
    assert.equal(state.options.find(o => o.id === 'state:noimage').count, 2);
    assert.equal(groups.find(g => g.id === 'cond').options.some(o => o.id === 'cond:used'), false);
  });
});
