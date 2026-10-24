/**
 * Tien Mobile - Admin Installments Controller
 * Xem hồ sơ đăng ký trả góp, đổi trạng thái, ghi chú nội bộ. Chỉ quản lý (manager) được xóa.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../js/config.js';
import { escapeHtml } from '../js/utils.js';
import { CartManager } from '../js/store.js';
import { INSTALLMENT_STATUSES, installmentStatusLabel, filterInstallments } from '../js/installment.js';
import { telHref, formatDateTime } from './ordersHelpers.js';
import { canDeleteProducts } from './adminHelpers.js';

let supabase = null;
const state = { role: null, records: [], status: 'all', query: '' };
const $ = (id) => document.getElementById(id);
const money = (n) => CartManager.formatCurrency(Number(n) || 0);

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
    const { data, error } = await supabase.from('installment_requests').select('*').order('created_at', { ascending: false }).limit(1000);
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
    ? '<div class="ord-empty">Chưa có hồ sơ trả góp phù hợp.</div>'
    : rows.map(card).join('');
}

function card(r) {
  const canDelete = canDeleteProducts(state.role);
  const buttons = INSTALLMENT_STATUSES.filter(([value]) => value !== r.status)
    .map(([value, label]) => `<button type="button" class="btn btn-secondary btn-sm" data-action="status" data-status="${value}" data-id="${escapeHtml(r.id)}">${escapeHtml(label)}</button>`).join('');
  return `
    <article class="ord-card" data-id="${escapeHtml(r.id)}">
      <div class="ord-card-head">
        <span class="ord-code">${escapeHtml(r.code)}</span>
        <span class="${r.status === 'new' ? 'ord-status-new' : 'ord-muted'}">${escapeHtml(installmentStatusLabel(r.status))}</span>
      </div>
      <p class="ord-line"><a href="${escapeHtml(telHref(r.phone))}">${escapeHtml(r.phone)}</a> · ${escapeHtml(r.customer_name)} · ${escapeHtml(r.occupation)}</p>
      <p class="ord-line">${escapeHtml(r.product)}: ${money(r.price)}</p>
      <p class="ord-line">Trả trước ${money(r.down_payment)} · ${Number(r.term_months)} tháng · khoảng ${money(r.monthly_estimate)}/tháng</p>
      <p class="ord-line ord-muted">Hình thức: ${escapeHtml(r.method)}</p>
      ${r.documents ? `<p class="ord-line ord-muted">Hồ sơ có sẵn: ${escapeHtml(r.documents)}</p>` : '<p class="ord-line ord-muted">Chưa chọn hồ sơ nào</p>'}
      ${r.note ? `<p class="ord-line ord-muted">Khách ghi chú: ${escapeHtml(r.note)}</p>` : ''}
      ${r.staff_note ? `<p class="ord-line">Ghi chú nội bộ: ${escapeHtml(r.staff_note)}</p>` : ''}
      <div class="ord-actions">
        ${buttons}
        <button type="button" class="btn btn-ghost btn-sm" data-action="note" data-id="${escapeHtml(r.id)}">Ghi chú</button>
        ${canDelete ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(r.id)}">Xóa</button>` : ''}
        <span class="ord-time">Gửi ${escapeHtml(formatDateTime(r.created_at))}</span>
      </div>
    </article>`;
}

async function update(id, patch, message) {
  const { error } = await supabase.from('installment_requests').update(patch).eq('id', id);
  if (error) return toast(error.message || 'Không cập nhật được.', 'error');
  const record = state.records.find(r => r.id === id);
  if (record) Object.assign(record, patch);
  render();
  toast(message);
}

async function remove(id) {
  if (!canDeleteProducts(state.role)) return toast('Nhân viên không có quyền xóa.', 'error');
  const record = state.records.find(r => r.id === id);
  if (!record || !confirm(`Xóa hồ sơ ${record.code} của ${record.customer_name}?`)) return;
  const { error } = await supabase.from('installment_requests').delete().eq('id', id);
  if (error) return toast(error.message || 'Không xóa được.', 'error');
  state.records = state.records.filter(r => r.id !== id);
  render();
  toast('Đã xóa hồ sơ');
}

function bindEvents() {
  $('iSearch').addEventListener('input', (e) => { state.query = e.target.value; render(); });
  $('iChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (chip) { state.status = chip.dataset.status; render(); }
  });
  $('iList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'status') update(id, { status: btn.dataset.status }, `Đã chuyển sang: ${installmentStatusLabel(btn.dataset.status)}`);
    if (btn.dataset.action === 'note') {
      const record = state.records.find(r => r.id === id);
      const text = prompt('Ghi chú nội bộ (không hiển thị cho khách):', record?.staff_note || '');
      if (text !== null) update(id, { staff_note: text.trim().slice(0, 1000) || null }, 'Đã lưu ghi chú');
    }
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
