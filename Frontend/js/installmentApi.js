/**
 * Tien Mobile - Tra cứu hồ sơ trả góp (SĐT + mã hóa đơn)
 */

import { isSupabaseConfigured } from './config.js';
import { getSupabase } from './productsApi.js';
import { parseApiError, SHOP_HOTLINE } from './ordersApi.js';
import { normalizePhone } from './warranty.js';

const CODE_RE = /^TG[0-9]{3,10}$/;

/**
 * @param {string} phone số điện thoại khách nhập
 * @param {string} code mã hóa đơn (TG1001)
 * @param {{ client?: object|null }} [options]
 * @returns {Promise<{ ok: true, record: object|null } | { ok: false, reason: string, message: string }>}
 */
export async function lookupInstallment(phone, code, options = {}) {
  const normalized = normalizePhone(phone);
  const cleanCode = String(code ?? '').trim().toUpperCase();
  if (!normalized) return { ok: false, reason: 'invalid_phone', message: 'Số điện thoại không hợp lệ (cần 10 chữ số).' };
  if (!CODE_RE.test(cleanCode)) return { ok: false, reason: 'invalid_code', message: 'Mã hóa đơn không đúng. Mã có dạng TG1001, ghi trên hóa đơn.' };

  const client = 'client' in options
    ? options.client
    : (isSupabaseConfigured() ? await getSupabase() : null);
  if (!client) {
    return { ok: false, reason: 'not_configured', message: `Hệ thống tra cứu đang bảo trì. Vui lòng gọi hotline ${SHOP_HOTLINE}.` };
  }

  try {
    const { data, error } = await client.rpc('lookup_installment', { p_phone: normalized, p_code: cleanCode });
    if (error) return { ok: false, reason: 'rejected', message: parseApiError(error) };
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true, record: row || null };
  } catch (err) {
    return { ok: false, reason: 'network', message: `Chưa tra cứu được. Vui lòng thử lại hoặc gọi hotline ${SHOP_HOTLINE}.` };
  }
}
