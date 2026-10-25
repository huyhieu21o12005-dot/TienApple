import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProducts } from '../../Frontend/js/productsApi.js';
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
  it('đã cấu hình project và chỉ dùng khóa công khai (publishable/anon)', () => {
    assert.equal(isSupabaseConfigured(), true);
    assert.match(SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
    assert.ok(/^sb_publishable_/.test(SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY.split('.').length === 3);
    assert.ok(!/^sb_secret_/.test(SUPABASE_ANON_KEY), 'không được dùng secret key trong trình duyệt');
  });

  it('không có service_role key trong cấu hình', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../Frontend/js/config.js', import.meta.url), 'utf-8');
    assert.ok(!/service_role\s*[:=]/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
  });
});

describe('productsApi - fetchProducts', () => {
  it('trả null khi không có client (coi như chưa cấu hình)', async () => {
    assert.equal(await quiet(() => fetchProducts({ client: null })), null);
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

describe('fetchProducts allowEmpty', () => {
  it('trả [] khi truy vấn thành công nhưng chưa có sản phẩm, vẫn null khi lỗi', async () => {
    assert.deepEqual(await quiet(() => fetchProducts({ allowEmpty: true, client: fakeClient({ data: [], error: null }) })), []);
    assert.equal(await quiet(() => fetchProducts({ allowEmpty: true, client: fakeClient({ data: null, error: { message: 'rls' } }) })), null);
    assert.equal(await quiet(() => fetchProducts({ allowEmpty: true, client: fakeClient(new Error('network')) })), null);
  });
});
