/**
 * Tien Mobile - Warranty lookup API (tra cứu bảo hành theo số điện thoại)
 */

import { isSupabaseConfigured } from './config.js';
import { getSupabase } from './productsApi.js';
import { parseApiError, SHOP_HOTLINE } from './ordersApi.js';
import { normalizePhone } from './warranty.js';

/**
 * @param {string} phone số điện thoại khách nhập
 * @param {{ client?: object|null }} [options]
 * @returns {Promise<{ ok: true, phone: string, records: Array<object> } | { ok: false, reason: string, message: string }>}
 */
export async function lookupWarranty(phone, options = {}) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { ok: false, reason: 'invalid_phone', message: 'Số điện thoại không hợp lệ (cần 10 chữ số).' };
  }

  const client = 'client' in options
    ? options.client
    : (isSupabaseConfigured() ? await getSupabase() : null);
  if (!client) {
    return {
      ok: false,
      reason: 'not_configured',
      message: `Hệ thống tra cứu đang bảo trì. Vui lòng gọi hotline ${SHOP_HOTLINE} để kiểm tra bảo hành.`
    };
  }

  try {
    const { data, error } = await client.rpc('lookup_warranty', { p_phone: normalized });
    if (error) return { ok: false, reason: 'rejected', message: parseApiError(error) };
    return { ok: true, phone: normalized, records: Array.isArray(data) ? data : [] };
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: `Chưa tra cứu được. Vui lòng thử lại hoặc gọi hotline ${SHOP_HOTLINE}.`
    };
  }
}
