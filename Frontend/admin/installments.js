/**
 * Tien Mobile - Admin Installments Controller
 * Cửa hàng tự nhập hồ sơ trả góp: khách, giá gốc, lãi suất %, kỳ hạn, hình thức trả, giấy tờ đi kèm.
 * Thành tiền hiển thị ngay khi nhập; cơ sở dữ liệu tính lại khi lưu. Chỉ quản lý (manager) được xóa.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../js/config.js';
import { escapeHtml } from '../js/utils.js';
import {
  INSTALLMENT_STATUSES, installmentStatusLabel, filterInstallments, calcInstallment,
  validateInstallmentRecord, buildInstallmentRow, nextDueDate
} from '../js/installment.js';
import { formatDate } from '../js/warranty.js';
import { formatCurrency, canDeleteProducts } from './adminHelpers.js';
import { telHref, formatDateTime } from './ordersHelpers.js';

let supabase = null;
const state = { user: null, role: null, records: [], status: 'all', query: '', editingId: null };
const $ = (id) => document.getElementById(id);
const todayIso = () => new Date().toISOString().slice(0, 10);

async function init() {
  bindEvents();
  if (!isSupabaseConfigured()) return showGate('Chưa cấu hình Supabase trong js/config.js.');

  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return showGate('Vui lòng đăng nhập tài khoản quản trị.');

    const { data: isAdmin, error } = await supabase.rpc('is_admin');
    if (error || isAdmin !== true) return showGate('Tài khoản này chưa được cấp quyền quản trị.');

    const { data: role } = await supabase.rpc('current_admin_role');
    state.user = session.user;
    state.role = typeof role === 'string' ? role : 'staff';
    document.body.dataset.role = state.role;
    $('gateSection').classList.add('hidden');
    $('iApp').classList.remove('hidden');
    await load();
  } catch (err) {
    console.error('[Installments] Không thể khởi tạo:', err);
    showGate('Không thể kết nối máy chủ. Vui lòng thử lại.');
  }
}

function showGate(message) {
  $('gateMessage').textContent = message;
  $('gateSection').classList.remove('hidden');
  $('iApp').classList.add('hidden');
}

async function load() {
  $('iLoading').classList.remove('hidden');
  $('iError').classList.add('hidden');
  try {
    const { data, error } = await supabase.from('installments').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    state.records = data || [];
    render();
  } catch (err) {
    console.error('[Installments] Lỗi tải dữ liệu:', err);
    $('iError').textContent = err.message || 'Không thể tải dữ liệu. Vui lòng thử lại.';
    $('iError').classList.remove('hidden');
  } finally {
    $('iLoading').classList.add('hidden');
  }
}

function render() {
  const chips = [['all', 'Tất cả'], ...INSTALLMENT_STATUSES];
  $('iChips').innerHTML = chips.map(([value, label]) => {
    const count = value === 'all' ? state.records.length : state.records.filter(r => r.status === value).length;
    return `<button type="button" class="ord-chip ${value === state.status ? 'active' : ''}" data-status="${value}" aria-pressed="${value === state.status}">${label} (${count})</button>`;
  }).join('');

  const rows = filterInstallments(state.records, { query: state.query, status: state.status });
  $('iList').innerHTML = rows.length === 0
    ? '<div class="ord-empty">Chưa có hồ sơ trả góp. Bấm "+ Thêm hồ sơ" để nhập.</div>'
    : rows.map(card).join('');
}

function card(r) {
  const canDelete = canDeleteProducts(state.role);
  const due = nextDueDate(r.start_date, r.paid_months, r.term_months);
  const active = r.status === 'active';
  return `
    <article class="ord-card" data-id="${escapeHtml(r.id)}">
      <div class="ord-card-head">
        <span class="ord-code">${escapeHtml(r.code)}</span>
        <span class="${active ? 'ord-status-new' : 'ord-muted'}">${escapeHtml(installmentStatusLabel(r.status))}</span>
      </div>
      <p class="ord-line"><a href="${escapeHtml(telHref(r.phone))}">${escapeHtml(r.phone)}</a> · ${escapeHtml(r.customer_name)}</p>
      <p class="ord-line">${escapeHtml(r.product)}: giá gốc ${escapeHtml(formatCurrency(r.original_price))}, trả trước ${escapeHtml(formatCurrency(r.down_payment))}</p>
      <p class="ord-line">Lãi ${escapeHtml(String(Number(r.interest_rate)).replace('.', ','))}%/tháng · ${Number(r.term_months)} tháng · góp ${escapeHtml(formatCurrency(r.monthly_payment))}/tháng</p>
      <p class="ord-line ord-muted">Hình thức: ${escapeHtml(r.pay_method)} · Đã đóng ${Number(r.paid_months)}/${Number(r.term_months)} kỳ${due ? ` · kỳ tới ${escapeHtml(formatDate(due))}` : ''}</p>
      <p class="ord-line ord-muted">Giấy tờ: ${r.documents ? escapeHtml(r.documents) : 'chưa ghi'}</p>
      ${r.note ? `<p class="ord-line ord-muted">Ghi chú: ${escapeHtml(r.note)}</p>` : ''}
      <div class="ord-total-bar">Thành tiền: ${escapeHtml(formatCurrency(r.total_amount))}</div>
      <div class="ord-actions">
        ${active ? `<button type="button" class="btn btn-primary btn-sm" data-action="pay" data-id="${escapeHtml(r.id)}">+1 kỳ đã đóng</button>` : ''}
        <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(r.id)}">Sửa</button>
        <a class="btn btn-secondary btn-sm" href="./print.html?type=installment&id=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">In hóa đơn</a>
        ${active ? `<button type="button" class="btn btn-ghost btn-sm" data-action="cancel" data-id="${escapeHtml(r.id)}">Hủy hồ sơ</button>` : ''}
        ${canDelete ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(r.id)}">Xóa</button>` : ''}
        <span class="ord-time">Tạo ${escapeHtml(formatDateTime(r.created_at))}</span>
      </div>
    </article>`;
}

function formData() {
  return {
    name: $('fName').value, phone: $('fPhone').value, product: $('fProduct').value,
    price: $('fPrice').value, downPayment: $('fDown').value, rate: $('fRate').value, term: $('fTerm').value,
    payMethod: $('fMethod').value, startDate: $('fStart').value, paidMonths: $('fPaid').value,
    documents: [...document.querySelectorAll('input[name="fDoc"]:checked')].map(el => el.value),
    note: $('fNote').value
  };
}

function updateTotal() {
  const d = formData();
  const calc = calcInstallment({ price: d.price, downPayment: d.downPayment, rate: d.rate, term: d.term });
  if (!calc.valid) {
    $('iTotalValue').textContent = formatCurrency(0);
    $('iTotalDetail').textContent = 'Nhập giá gốc, trả trước, lãi suất và kỳ hạn hợp lệ để tính.';
    return;
  }
  $('iTotalValue').textContent = formatCurrency(calc.total);
  $('iTotalDetail').textContent = `Vay ${formatCurrency(calc.loan)} · lãi ${formatCurrency(calc.interest)} · góp ${formatCurrency(calc.monthly)} x ${Number(d.term)} tháng`;
}

function openDialog(record = null) {
  state.editingId = record ? record.id : null;
  $('iDialogTitle').textContent = record ? `Sửa hồ sơ ${record.code}` : 'Thêm hồ sơ trả góp';
  $('iFormError').classList.add('hidden');
  $('fName').value = record?.customer_name || '';
  $('fPhone').value = record?.phone || '';
  $('fProduct').value = record?.product || '';
  $('fPrice').value = record ? String(record.original_price) : '';
  $('fDown').value = record ? String(record.down_payment) : '';
  $('fRate').value = record ? String(Number(record.interest_rate)).replace('.', ',') : '';
  $('fTerm').value = record?.term_months || 6;
  $('fMethod').value = record?.pay_method || 'Tiền mặt';
  $('fStart').value = record?.start_date || todayIso();
  $('fPaid').value = record?.paid_months || 0;
  $('fNote').value = record?.note || '';
  const have = String(record?.documents || '').split(', ');
  document.querySelectorAll('input[name="fDoc"]').forEach(el => { el.checked = have.includes(el.value); });
  updateTotal();
  $('iDialog').showModal();
  $('fName').focus();
}

async function save(e) {
  e.preventDefault();
  const data = formData();
  const check = validateInstallmentRecord(data);
  if (!check.valid) {
    $('iFormError').textContent = check.errors[0];
    $('iFormError').classList.remove('hidden');
    return;
  }
  const row = buildInstallmentRow(data);
  if (row.start_date === undefined) delete row.start_date;

  const button = $('iSave');
  button.disabled = true;
  try {
    const query = state.editingId
      ? supabase.from('installments').update(row).eq('id', state.editingId)
      : supabase.from('installments').insert({ ...row, created_by: state.user.id });
    const { error } = await query;
    if (error) throw error;
    $('iDialog').close();
    toast(state.editingId ? 'Đã cập nhật hồ sơ' : 'Đã thêm hồ sơ trả góp');
    await load();
  } catch (err) {
    $('iFormError').textContent = err.message || 'Không lưu được, vui lòng thử lại.';
    $('iFormError').classList.remove('hidden');
  } finally {
    button.disabled = false;
  }
}

async function payOne(id) {
  const record = state.records.find(r => r.id === id);
  if (!record || record.status !== 'active') return;
  const paid = Number(record.paid_months) + 1;
  if (paid > Number(record.term_months)) return;
  if (!confirm(`Ghi nhận khách ${record.customer_name} đã đóng kỳ ${paid}/${record.term_months}?`)) return;
  const { error } = await supabase.from('installments').update({ paid_months: paid }).eq('id', id);
  if (error) return toast(error.message || 'Không cập nhật được.', 'error');
  toast(paid >= Number(record.term_months) ? 'Đã tất toán hồ sơ' : `Đã ghi nhận kỳ ${paid}`);
  await load();
}

async function cancel(id) {
  const record = state.records.find(r => r.id === id);
  if (!record || !confirm(`Hủy hồ sơ ${record.code} của ${record.customer_name}?`)) return;
  const { error } = await supabase.from('installments').update({ status: 'cancelled' }).eq('id', id);
  if (error) return toast(error.message || 'Không cập nhật được.', 'error');
  toast('Đã hủy hồ sơ');
  await load();
}

async function remove(id) {
  if (!canDeleteProducts(state.role)) return toast('Nhân viên không có quyền xóa.', 'error');
  const record = state.records.find(r => r.id === id);
  if (!record || !confirm(`Xóa hồ sơ ${record.code} của ${record.customer_name}?`)) return;
  const { error } = await supabase.from('installments').delete().eq('id', id);
  if (error) return toast(error.message || 'Không xóa được.', 'error');
  state.records = state.records.filter(r => r.id !== id);
  render();
  toast('Đã xóa hồ sơ');
}

function bindEvents() {
  $('addBtn').addEventListener('click', () => openDialog());
  $('iCancel').addEventListener('click', () => $('iDialog').close());
  $('iForm').addEventListener('submit', save);
  ['fPrice', 'fDown', 'fRate', 'fTerm'].forEach(id => $(id).addEventListener('input', updateTotal));
  $('iSearch').addEventListener('input', (e) => { state.query = e.target.value; render(); });
  $('iChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (chip) { state.status = chip.dataset.status; render(); }
  });
  $('iList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') openDialog(state.records.find(r => r.id === id));
    if (btn.dataset.action === 'pay') payOne(id);
    if (btn.dataset.action === 'cancel') cancel(id);
    if (btn.dataset.action === 'delete') remove(id);
  });
  $('logoutBtn').addEventListener('click', async () => {
    if (supabase) await supabase.auth.signOut();
    location.href = './index.html';
  });
}

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  $('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

init();
