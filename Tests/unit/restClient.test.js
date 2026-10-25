import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRestClient, fetchProducts } from '../../Frontend/js/productsApi.js';

const URL_ = 'https://x.supabase.co';
const jsonRes = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });

describe('createRestClient: truy vấn sản phẩm không cần tải SDK Supabase', () => {
  it('dựng đúng địa chỉ PostgREST và gửi khóa công khai', async () => {
    const calls = [];
    const client = createRestClient({ url: URL_, key: 'pub', fetchImpl: async (u, init) => { calls.push([u, init]); return jsonRes([{ id: 1 }]); } });
    const { data, error } = await client.from('products').select('*').eq('is_visible', true).eq('kind', 'phone')
      .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    assert.equal(error, null);
    assert.deepEqual(data, [{ id: 1 }]);
    const [u, init] = calls[0];
    assert.equal(u, `${URL_}/rest/v1/products?select=*&is_visible=eq.true&kind=eq.phone&order=sort_order.asc%2Ccreated_at.desc`);
    assert.equal(init.headers.apikey, 'pub');
    assert.equal(init.headers.Authorization, 'Bearer pub');
  });
  it('mặc định sắp xếp tăng dần khi không nói rõ', async () => {
    const calls = [];
    const client = createRestClient({ url: URL_, key: 'k', fetchImpl: async (u) => { calls.push(u); return jsonRes([]); } });
    await client.from('products').select('id,name').order('name');
    assert.match(calls[0], /select=id%2Cname/);
    assert.match(calls[0], /order=name\.asc/);
  });
  it('lỗi HTTP trả error thay vì ném lỗi', async () => {
    const client = createRestClient({ url: URL_, key: 'k', fetchImpl: async () => jsonRes({ message: 'tệ' }, false, 401) });
    const { data, error } = await client.from('products').select('*');
    assert.equal(data, null);
    assert.match(error.message, /401/);
  });
});

describe('fetchProducts qua REST', () => {
  it('lấy sản phẩm bằng fetchImpl, map camelCase, không cần client truyền vào', async () => {
    const rows = [{ id: 'a', name: 'iPhone 15 128GB', kind: 'phone', price: 100, base_price: 100, stock: 2, is_visible: true, image_url: 'https://x/a.png', colors: [], storages: [] }];
    const list = await fetchProducts({ allowEmpty: true, fetchImpl: async () => jsonRes(rows) });
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'a');
    assert.equal(list[0].image, 'https://x/a.png');
  });
  it('lỗi mạng thì trả null để web dùng dữ liệu dự phòng', async () => {
    const quiet = console.warn; console.warn = () => {};
    try { assert.equal(await fetchProducts({ fetchImpl: async () => { throw new Error('mạng'); } }), null); } finally { console.warn = quiet; }
  });
});
