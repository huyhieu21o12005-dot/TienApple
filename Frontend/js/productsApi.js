/**
 * Tien Mobile - Products API (Supabase Integration with Fallback)
 * Loads visible products from Supabase and transforms them to the shape expected by app.js
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';
import { mapDbToProduct } from '../admin/adminHelpers.js';
import { imageFor, isKnownSource } from '../admin/modelImages.js';
import { inferCategory, isAccessory } from './utils.js';

let supabaseClient = null;

/**
 * Khởi tạo hoặc lấy Supabase Client với Anon Key
 * Sử dụng official CDN pinned: @supabase/supabase-js@2.45.4
 */
export async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (!isSupabaseConfigured()) return null;

  try {
    // Dynamic import client từ jsDelivr pinned ESM
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    return supabaseClient;
  } catch (err) {
    console.warn('[productsApi] Không thể tải Supabase SDK từ CDN:', err);
    return null;
  }
}

/**
 * Client đọc dữ liệu công khai qua PostgREST bằng fetch, cùng cách dùng from().select().eq().order() như SDK.
 * Trang chủ chỉ cần đọc sản phẩm nên không phải tải SDK Supabase (8 yêu cầu nối tiếp từ CDN).
 * Ghi dữ liệu (đơn hàng, bảo hành, trả góp) vẫn dùng getSupabase().
 */
export function createRestClient({ url = SUPABASE_URL, key = SUPABASE_ANON_KEY, fetchImpl } = {}) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  return {
    from(table) {
      let columns = '*';
      const filters = [];
      const orders = [];
      const builder = {
        select(cols = '*') { columns = cols; return builder; },
        eq(column, value) { filters.push([column, `eq.${value}`]); return builder; },
        order(column, { ascending = true } = {}) { orders.push(`${column}.${ascending ? 'asc' : 'desc'}`); return builder; },
        then(resolve, reject) {
          const params = new URLSearchParams([['select', columns], ...filters]);
          if (orders.length) params.set('order', orders.join(','));
          return doFetch(`${url}/rest/v1/${table}?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
            .then(async (res) => (res.ok
              ? { data: await res.json(), error: null }
              : { data: null, error: { message: `HTTP ${res.status}` } }))
            .then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

/**
 * Tải danh sách sản phẩm hiển thị từ Supabase
 * Tự động chuyển đổi từ snake_case sang camelCase theo định dạng app.js yêu cầu.
 * Nếu Supabase chưa cấu hình hoặc gặp lỗi mạng, trả về null để app.js kích hoạt fallback.
 * 
 * @param {object} [options]
 * @param {boolean} [options.allowEmpty] true: truy vấn thành công mà không có sản phẩm thì trả [] thay vì null (web không hiện hàng mẫu)
 * @param {string} [options.kind] Lọc theo loại 'phone' hoặc 'accessory' (tùy chọn)
 * @param {object} [options.client] Supabase client truyền sẵn (dùng cho kiểm thử)
 * @param {Function} [options.fetchImpl] fetch thay thế (dùng cho kiểm thử)
 * @returns {Promise<Array<object>|null>}
 */
export async function fetchProducts(options = {}) {
  if ('client' in options ? !options.client : !isSupabaseConfigured()) {
    console.info('[productsApi] Supabase chưa được cấu hình trong js/config.js. Dùng dữ liệu fallback.');
    return null;
  }

  try {
    const supabase = options.client || createRestClient({ fetchImpl: options.fetchImpl });

    let query = supabase
      .from('products')
      .select('*')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (options.kind) {
      query = query.eq('kind', options.kind);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[productsApi] Lỗi truy vấn Supabase:', error.message);
      return null;
    }

    // Truy vấn thành công nhưng chưa có sản phẩm nào đang hiện: cửa hàng thật sự trống, không dùng hàng mẫu
    if (options.allowEmpty && Array.isArray(data) && data.length === 0) return [];

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn('[productsApi] Dữ liệu từ Supabase rỗng, sử dụng fallback.');
      return null;
    }

    // Map từng row sang cấu trúc camelCase của app.js
    const mapped = data.map(row => mapDbToProduct(row)).filter(Boolean).map(p => ({
      ...p,
      image: !p.image || isKnownSource(p.image) ? imageFor(p.name, p.defaultColor) : p.image,
      ...(isAccessory(p) ? { category: inferCategory(p) } : {})
    }));
    return mapped.length > 0 ? mapped : null;
  } catch (err) {
    console.warn('[productsApi] Ngoại lệ khi fetchProducts:', err);
    return null;
  }
}
