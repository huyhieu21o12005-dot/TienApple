/**
 * Tien Mobile - Admin Warranty Controller
 * Tạo, sửa, xóa phiếu bảo hành. Nhân viên (staff) được tạo và sửa, không được xóa.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../js/config.js';
import { escapeHtml } from '../js/utils.js';
import { warrantyInfo, formatDate, validateWarranty, filterWarranties, addMonths } from '../js/warranty.js';
import { telHref, formatDateTime } from './ordersHelpers.js';
import { canDeleteProducts } from './adminHelpers.js';

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
    $('warrantyApp').classList.remove('hidden');
    await load();
  } catch (err) {
    console.error('[Warranty] Không thể khởi tạo:', err);
    showGate('Không thể kết nối máy chủ. Vui lòng thử lại.');
  }
}

function showGate(message) {
  $('gateMessage').textContent = message;
  $('gateSection').classList.remove('hidden');
  $('warrantyApp').classList.add('hidden');
}

async function load() {
  $('wLoading').classList.remove('hidden');
  $('wError').classList.add('hidden');
  try {
    const { data, error } = await supabase.from('warranties').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    state.records = data || [];
    render();
  } catch (err) {
    console.error('[Warranty] Lỗi tải dữ liệu:', err);
    $('wError').textContent = err.message || 'Không thể tải dữ liệu. Vui lòng thử lại.';
    $('wError').classList.remove('hidden');
  } finally {
    $('wLoading').classList.add('hidden');
  }
}

function render() {
  const chips = [['all', 'Tất cả'], ['active', 'Còn bảo hành'], ['expired', 'Hết hạn']];
  $('wChips').innerHTML = chips.map(([value, label]) => `
    <button type="button" class="ord-chip ${value === state.status ? 'active' : ''}" data-status="${value}" aria-pressed="${value === state.status}">${label}</button>`).join('');

  const rows = filterWarranties(state.records, { query: state.query, status: state.status });
  $('wList').innerHTML = rows.length === 0
    ? '<div class="ord-empty">Chưa có phiếu bảo hành phù hợp.</div>'
    : rows.map(card).join('');
}

function card(r) {
  const info = warrantyInfo(r.start_date, r.warranty_months);
  const badge = info.active
    ? `<span class="ord-status-new">Còn ${info.daysLeft} ngày</span>`
    : '<span class="ord-muted">Hết hạn</span>';
  const canDelete = canDeleteProducts(state.role);
  return `
    <article class="ord-card" data-id="${escapeHtml(r.id)}">
      <div class="ord-card-head">
        <span class="ord-code">${escapeHtml(r.code)}</span>
        ${badge}
      </div>
      <p class="ord-line"><a href="${escapeHtml(telHref(r.phone))}">${escapeHtml(r.phone)}</a> · ${escapeHtml(r.customer_name)}</p>
      <p class="ord-line">${escapeHtml(r.device)}</p>
      <p class="ord-line ord-muted">${escapeHtml(r.service)}</p>
      <p class="ord-line">${escapeHtml(formatDate(r.start_date))} đến ${escapeHtml(formatDate(info.endDate))} (${Number(r.warranty_months)} tháng)</p>
      ${r.note ? `<p class="ord-line ord-muted">Ghi chú: ${escapeHtml(r.note)}</p>` : ''}
      <div class="ord-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(r.id)}">Sửa</button>
        ${canDelete ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(r.id)}">Xóa</button>` : ''}
        <span class="ord-time">Tạo ${escapeHtml(formatDateTime(r.created_at))}</span>
      </div>
    </article>`;
}

function openDialog(record = null) {
  state.editingId = record ? record.id : null;
  $('wDialogTitle').textContent = record ? `Sửa phiếu ${record.code}` : 'Thêm phiếu bảo hành';
  $('wFormError').classList.add('hidden');
  $('fName').value = record?.customer_name || '';
  $('fPhone').value = record?.phone || '';
  $('fDevice').value = record?.device || '';
  $('fService').value = record?.service || '';
  $('fMonths').value = record?.warranty_months || 3;
  $('fStart').value = record?.start_date || todayIso();
  $('fNote').value = record?.note || '';
  updateEnd();
  $('wDialog').showModal();
  $('fName').focus();
}

function updateEnd() {
  const end = addMonths($('fStart').value, $('fMonths').value);
  $('fEnd').textContent = end ? `Hết hạn bảo hành: ${formatDate(end)}` : '';
}

async function save(e) {
  e.preventDefault();
  const payload = {
    customer_name: $('fName').value.trim(),
    phone: $('fPhone').value,
    device: $('fDevice').value.trim(),
    service: $('fService').value.trim(),
    warranty_months: Number($('fMonths').value),
    start_date: $('fStart').value,
    note: $('fNote').value.trim() || null
  };
  const check = validateWarranty(payload);
  if (!check.valid) {
    $('wFormError').textContent = check.errors[0];
    $('wFormError').classList.remove('hidden');
    return;
  }
  payload.phone = check.phone;

  const button = $('wSave');
  button.disabled = true;
  try {
    const query = state.editingId
      ? supabase.from('warranties').update(payload).eq('id', state.editingId)
      : supabase.from('warranties').insert({ ...payload, created_by: state.user.id });
    const { error } = await query;
    if (error) throw error;
    $('wDialog').close();
    toast(state.editingId ? 'Đã cập nhật phiếu' : 'Đã thêm phiếu bảo hành');
    await load();
  } catch (err) {
    $('wFormError').textContent = err.message || 'Không lưu được, vui lòng thử lại.';
    $('wFormError').classList.remove('hidden');
  } finally {
    button.disabled = false;
  }
}

async function remove(id) {
  if (!canDeleteProducts(state.role)) return toast('Nhân viên không có quyền xóa.', 'error');
  const record = state.records.find(r => r.id === id);
  if (!record || !confirm(`Xóa phiếu ${record.code} của ${record.customer_name}?`)) return;
  const { error } = await supabase.from('warranties').delete().eq('id', id);
  if (error) return toast(error.message || 'Không xóa được.', 'error');
  state.records = state.records.filter(r => r.id !== id);
  render();
  toast('Đã xóa phiếu');
}

function bindEvents() {
  $('addBtn').addEventListener('click', () => openDialog());
  $('wCancel').addEventListener('click', () => $('wDialog').close());
  $('wForm').addEventListener('submit', save);
  $('fMonths').addEventListener('input', updateEnd);
  $('fStart').addEventListener('input', updateEnd);
  $('wSearch').addEventListener('input', (e) => { state.query = e.target.value; render(); });
  $('wChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (chip) { state.status = chip.dataset.status; render(); }
  });
  $('wList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit') openDialog(state.records.find(r => r.id === btn.dataset.id));
    if (btn.dataset.action === 'delete') remove(btn.dataset.id);
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
