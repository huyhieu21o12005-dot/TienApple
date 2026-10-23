/**
 * Tien Mobile - Products API (Supabase Integration with Fallback)
 * Loads visible products from Supabase and transforms them to the shape expected by app.js
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';
import { mapDbToProduct } from '../admin/adminHelpers.js';

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
 * Tải danh sách sản phẩm hiển thị từ Supabase
 * Tự động chuyển đổi từ snake_case sang camelCase theo định dạng app.js yêu cầu.
 * Nếu Supabase chưa cấu hình hoặc gặp lỗi mạng, trả về null để app.js kích hoạt fallback.
 * 
 * @param {object} [options]
 * @param {string} [options.kind] Lọc theo loại 'phone' hoặc 'accessory' (tùy chọn)
 * @param {object} [options.client] Supabase client truyền sẵn (dùng cho kiểm thử)
 * @returns {Promise<Array<object>|null>}
 */
export async function fetchProducts(options = {}) {
  if (!options.client && !isSupabaseConfigured()) {
    console.info('[productsApi] Supabase chưa được cấu hình trong js/config.js. Dùng dữ liệu fallback.');
    return null;
  }

  try {
    const supabase = options.client || await getSupabase();
    if (!supabase) return null;

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

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn('[productsApi] Dữ liệu từ Supabase rỗng, sử dụng fallback.');
      return null;
    }

    // Map từng row sang cấu trúc camelCase của app.js
    const mapped = data.map(row => mapDbToProduct(row)).filter(Boolean);
    return mapped.length > 0 ? mapped : null;
  } catch (err) {
    console.warn('[productsApi] Ngoại lệ khi fetchProducts:', err);
    return null;
  }
}
