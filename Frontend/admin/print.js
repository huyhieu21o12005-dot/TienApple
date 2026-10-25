/**
 * Tien Mobile - Trang in hóa đơn: /admin/print.html?type=order|booking|warranty|installment&id=<uuid>
 * Thêm &doc=contract (order|installment) để in hợp đồng mua bán khổ A4.
 * Cần đăng nhập quản trị (dùng phiên Supabase đã lưu). Khổ giấy 80mm cho máy in hóa đơn, hoặc A5.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../js/config.js';

import { promptDialog, alertDialog } from '../js/dialog.js';import { parseMoney } from '../js/installment.js';
import { categoryForInvoice, validateEntry } from './cashflowHelpers.js';
import { SHOP, buildInvoice, invoiceHtml, buildContract, contractHtml, CONTRACT_TYPES, INVOICE_TABLES, INVOICE_TYPES } from './invoiceHelpers.js';

const $ = (id) => document.getElementById(id);

function fail(message) {
  $('msg').textContent = message;
  $('msg').hidden = false;
}

function setPaper(a5) {
  document.body.classList.remove('a4');
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

function setContractMode() {
  document.body.classList.remove('a5');
  document.body.classList.add('a4');
  $('p80').hidden = true;
  $('pa5').hidden = true;
  $('printBtn').textContent = 'In hợp đồng';
  let style = document.getElementById('pageStyle');
  if (!style) {
    style = document.createElement('style');
    style.id = 'pageStyle';
    document.head.appendChild(style);
  }
  style.textContent = '@page { size: A4; margin: 0; }';
}

function setEditing(on) {
  document.body.classList.toggle('editing', on);
  $('sheet').contentEditable = on ? 'true' : 'false';
  $('sheet').spellcheck = false;
  $('editBtn').textContent = on ? 'Chỉnh sửa: Bật' : 'Chỉnh sửa: Tắt';
  $('editBtn').classList.toggle('active', on);
}

const SHOP_KEY = 'tm_print_shop';
let record = null;
let docType = '';
let isContractDoc = false;
const extra = {};
let sb = null;

function loadShop() {
  try {
    const saved = JSON.parse(localStorage.getItem(SHOP_KEY) || '{}');
    for (const k of ['name', 'address', 'hotline']) if (typeof saved[k] === 'string' && saved[k]) SHOP[k] = saved[k];
  } catch { /* bỏ qua */ }
}

function saveShop() {
  try { localStorage.setItem(SHOP_KEY, JSON.stringify({ name: SHOP.name, address: SHOP.address, hotline: SHOP.hotline })); } catch { /* bỏ qua */ }
}

function render() {
  $('sheet').innerHTML = isContractDoc
    ? contractHtml(buildContract(docType, record, extra))
    : invoiceHtml(buildInvoice(docType, record, extra));
}

function buildInfoForm() {
  const fields = [
    ['Tên cửa hàng', () => SHOP.name, v => { SHOP.name = v; saveShop(); }],
    ['Địa chỉ cửa hàng', () => SHOP.address, v => { SHOP.address = v; saveShop(); }],
    ['Hotline', () => SHOP.hotline, v => { SHOP.hotline = v; saveShop(); }],
    ['Tên khách hàng', () => record.customer_name || '', v => { record.customer_name = v; }],
    ['Số điện thoại khách', () => record.phone || '', v => { record.phone = v; }]
  ];
  if (docType !== 'installment' || isContractDoc) fields.push(['Địa chỉ khách', () => record.address || '', v => { record.address = v; }]);
  if (isContractDoc) {
    fields.push(
      ['Đại diện bên bán', () => extra.rep || '', v => { extra.rep = v; }],
      ['CCCD/CMND khách', () => extra.cccd || '', v => { extra.cccd = v; }],
      ['Bảo hành (tháng)', () => extra.warrantyMonths || '', v => { extra.warrantyMonths = v; }]
    );
  }
  fields.push(['Số seri / IMEI máy', () => extra.imei || '', v => { extra.imei = v; }]);
  if (!isContractDoc && docType !== 'installment' && docType !== 'warranty') {
    if (docType === 'booking') fields.push(['Chi phí dịch vụ (đ)', () => extra.price || '', v => { extra.price = v; }]);
    fields.push(
      ['Giảm giá thêm (đ)', () => extra.discount || '', v => { extra.discount = v; }],
      ['VAT (%)', () => extra.vat || '', v => { extra.vat = v; }]
    );
  }
  const box = $('infoFields');
  box.innerHTML = '';
  for (const [label, get, set] of fields) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = get();
    input.addEventListener('input', () => { set(input.value.trim()); render(); });
    wrap.appendChild(input);
    box.appendChild(wrap);
  }
  $('info').hidden = false;
}

async function recordIncome() {
  const inv = buildInvoice(docType, record, extra);
  const suggested = inv ? parseMoney(inv.totals.at(-1)?.[1]) : NaN;
  const input = await promptDialog(`Ghi vào sổ thu phiếu ${record.code}. Số tiền thu (đ):`, { title: 'Ghi vào sổ thu', defaultValue: Number.isFinite(suggested) ? String(suggested) : '', inputMode: 'numeric', okText: 'Ghi sổ' });
  if (input === null) return;
  const result = validateEntry({
    kind: 'in', amount: input, category: categoryForInvoice(docType), refCode: record.code,
    date: new Date().toISOString().slice(0, 10), note: `Hóa đơn ${record.code} - ${record.customer_name || ''}`.slice(0, 300)
  });
  if (!result.valid) return alertDialog(result.errors[0]);
  const { error } = await sb.from('cashflow_entries').insert(result.row);
  if (error) return alertDialog(error.code === '23505' ? `Phiếu ${record.code} đã được ghi vào sổ thu trước đó.` : (error.message || 'Không ghi được.'));
  $('ledgerBtn').textContent = 'Đã ghi vào sổ thu';
  $('ledgerBtn').disabled = true;
}

async function init() {
  $('ledgerBtn').addEventListener('click', recordIncome);
  $('editBtn').addEventListener('click', () => setEditing(!document.body.classList.contains('editing')));
  $('printBtn').addEventListener('click', () => window.print());
  $('p80').addEventListener('click', () => setPaper(false));
  $('pa5').addEventListener('click', () => setPaper(true));

  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const id = params.get('id');
  const isContract = params.get('doc') === 'contract';
  if (!(isContract ? CONTRACT_TYPES : INVOICE_TYPES).includes(type) || !id) return fail('Đường dẫn in không hợp lệ.');
  if (isContract) setContractMode();
  else if (params.get('paper') === 'a5') setPaper(true);
  if (!isSupabaseConfigured()) return fail('Chưa cấu hình Supabase.');

  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    sb = supabase;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return fail('Vui lòng đăng nhập trang quản trị trước khi in.');
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (isAdmin !== true) return fail('Tài khoản này chưa được cấp quyền quản trị.');

    const { data, error } = await supabase.from(INVOICE_TABLES[type]).select('*').eq('id', id).maybeSingle();
    if (error || !data) return fail('Không tìm thấy dữ liệu để in.');

    document.title = `${data.code} - ${isContract ? 'In hợp đồng' : 'In hóa đơn'}`;
    record = { ...data };
    docType = type;
    isContractDoc = isContract;
    loadShop();
    render();
    buildInfoForm();
    if (!isContract) $('ledgerBtn').hidden = false;
    $('sheet').hidden = false;
    $('msg').hidden = true;
    $('hint').hidden = false;
    setEditing(true);
    if (params.get('auto') === '1') setTimeout(() => window.print(), 400);
  } catch (err) {
    console.error('[Print] Lỗi:', err);
    fail('Không tải được dữ liệu. Vui lòng thử lại.');
  }
}

init();
