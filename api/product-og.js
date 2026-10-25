/**
 * Trả thẻ xem trước cho link sản phẩm khi bot của Messenger/Zalo/Facebook... mở (xem rewrite trong vercel.json).
 * Người dùng thường không đi qua hàm này. Lỗi hay không tìm thấy thì trả thẻ logo web.
 */

import { ogHtml, productMeta, SITE_NAME, LOGO_PATH } from './_og.js';

const SUPABASE_URL = 'https://kyyfafnkhbcgpedgllag.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KgFVQG_8I_w3kOwwhimO4g_R6WJ1Ssn';

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'tienappletd.com';
  const origin = `https://${host}`;
  const id = String(req.query?.id || '').slice(0, 120);
  let meta = { title: SITE_NAME, desc: 'Điện thoại chính hãng & Sửa chữa lấy ngay', image: `${origin}${LOGO_PATH}`, url: `${origin}/product.html${id ? `?id=${encodeURIComponent(id)}` : ''}` };
  try {
    if (id) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&is_visible=eq.true&select=id,name,price,image_url,default_color,condition_label`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      const rows = r.ok ? await r.json() : [];
      if (rows[0]) meta = productMeta(rows[0], origin);
    }
  } catch { /* dùng thẻ logo */ }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  res.status(200).send(ogHtml(meta));
}
