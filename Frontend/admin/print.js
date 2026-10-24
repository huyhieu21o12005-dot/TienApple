/**
 * Tien Mobile - Trang in hóa đơn: /admin/print.html?type=order|booking|warranty|installment&id=<uuid>
 * Cần đăng nhập quản trị (dùng phiên Supabase đã lưu). Khổ giấy 80mm cho máy in hóa đơn, hoặc A5.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../js/config.js';
import { buildInvoice, invoiceHtml, INVOICE_TABLES, INVOICE_TYPES } from './invoiceHelpers.js';

const $ = (id) => document.getElementById(id);

function fail(message) {
  $('msg').textContent = message;
  $('msg').hidden = false;
}

function setPaper(a5) {
  document.body.classList.toggle('a5', a5);
  $('p80').classList.toggle('active', !a5);
  $('pa5').classList.toggle('active', a5);
  let style = document.getElementById('pageStyle');
  if (!style) {
    style = document.createElement('style');
    style.id = 'pageStyle';
    document.head.appendChild(style);
  }
  style.textContent = a5 ? '@page { size: A5; margin: 0; }' : '@page { size: 80mm auto; margin: 0; }';
}

async function init() {
  $('printBtn').addEventListener('click', () => window.print());
  $('p80').addEventListener('click', () => setPaper(false));
  $('pa5').addEventListener('click', () => setPaper(true));

  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const id = params.get('id');
  if (!INVOICE_TYPES.includes(type) || !id) return fail('Đường dẫn in không hợp lệ.');
  if (params.get('paper') === 'a5') setPaper(true);
  if (!isSupabaseConfigured()) return fail('Chưa cấu hình Supabase.');

  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return fail('Vui lòng đăng nhập trang quản trị trước khi in.');
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (isAdmin !== true) return fail('Tài khoản này chưa được cấp quyền quản trị.');

    const { data, error } = await supabase.from(INVOICE_TABLES[type]).select('*').eq('id', id).maybeSingle();
    if (error || !data) return fail('Không tìm thấy dữ liệu để in.');

    document.title = `${data.code} - In hóa đơn`;
    $('sheet').innerHTML = invoiceHtml(buildInvoice(type, data));
    $('sheet').hidden = false;
    $('msg').hidden = true;
    if (params.get('auto') !== '0') setTimeout(() => window.print(), 400);
  } catch (err) {
    console.error('[Print] Lỗi:', err);
    fail('Không tải được dữ liệu. Vui lòng thử lại.');
  }
}

init();
