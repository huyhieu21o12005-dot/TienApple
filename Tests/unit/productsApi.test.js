import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProducts, getSupabase } from '../../Frontend/js/productsApi.js';
import { isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../Frontend/js/config.js';

/** Supabase client giả: mọi hàm trả lại chính nó, await sẽ trả kết quả đã cấu hình */
function fakeClient(result, calls = []) {
  const builder = {
    select(...a) { calls.push(['select', ...a]); return builder; },
    eq(...a) { calls.push(['eq', ...a]); return builder; },
    order(...a) { calls.push(['order', ...a]); return builder; },
    then(resolve, reject) {
      if (result instanceof Error) return Promise.reject(result).then(resolve, reject);
      return Promise.resolve(result).then(resolve, reject);
    }
  };
  return { from(table) { calls.push(['from', table]); return builder; } };
}

const quiet = async (fn) => {
  const { warn, info } = console;
  console.warn = () => {};
  console.info = () => {};
  try { return await fn(); } finally { console.warn = warn; console.info = info; }
};

describe('config - isSupabaseConfigured', () => {
  it('mặc định chưa cấu hình (giá trị placeholder)', () => {
    assert.equal(SUPABASE_URL, 'YOUR_SUPABASE_URL');
    assert.equal(SUPABASE_ANON_KEY, 'YOUR_SUPABASE_ANON_KEY');
    assert.equal(isSupabaseConfigured(), false);
  });

  it('không có service_role key trong cấu hình', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../Frontend/js/config.js', import.meta.url), 'utf-8');
    assert.ok(!/service_role\s*[:=]/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
  });
});

describe('productsApi - fetchProducts', () => {
  it('trả null khi chưa cấu hình và không có client', async () => {
    assert.equal(await quiet(() => fetchProducts()), null);
    assert.equal(await quiet(() => getSupabase()), null);
  });

  it('chỉ lấy sản phẩm đang hiện, sắp xếp đúng và map sang camelCase', async () => {
    const calls = [];
    const client = fakeClient({
      data: [{ id: 'a', name: 'A', price: 100, old_price: 150, brand_name: 'Apple', image_url: 'img', condition: 'like_new' }],
      error: null
    }, calls);
    const result = await fetchProducts({ client });
    assert.equal(result.length, 1);
    assert.equal(result[0].oldPrice, 150);
    assert.equal(result[0].brandName, 'Apple');
    assert.equal(result[0].image, 'img');
    assert.equal(result[0].condition, 'likenew');
    assert.deepEqual(calls.find(c => c[0] === 'eq'), ['eq', 'is_visible', true]);
    assert.deepEqual(calls.filter(c => c[0] === 'order').map(c => c[1]), ['sort_order', 'created_at']);
  });

  it('lọc theo kind khi được yêu cầu', async () => {
    const calls = [];
    await fetchProducts({ client: fakeClient({ data: [{ id: 'a', name: 'A', price: 1 }], error: null }, calls), kind: 'accessory' });
    assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'kind' && c[2] === 'accessory'));
  });

  it('trả null khi lỗi truy vấn, dữ liệu rỗng hoặc ngoại lệ để app dùng fallback', async () => {
    assert.equal(await quiet(() => fetchProducts({ client: fakeClient({ data: null, error: { message: 'rls' } }) })), null);
    assert.equal(await quiet(() => fetchProducts({ client: fakeClient({ data: [], error: null }) })), null);
    assert.equal(await quiet(() => fetchProducts({ client: fakeClient({ data: 'x', error: null }) })), null);
    assert.equal(await quiet(() => fetchProducts({ client: fakeClient(new Error('network')) })), null);
  });
});
