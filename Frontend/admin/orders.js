/**
 * Tien Mobile - Admin Orders Controller
 * Xem đơn hàng và lịch sửa chữa, đổi trạng thái, ghi chú nội bộ.
 * Dùng chung phiên đăng nhập Supabase với trang sản phẩm; quyền được kiểm tra bằng hàm is_admin().
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../js/config.js';

import { confirmDialog } from '../js/dialog.js';import { escapeHtml } from '../js/utils.js';
import { normalizePhone } from '../js/warranty.js';
import { formatCurrency, canDeleteProducts } from './adminHelpers.js';
import {
  statusesFor,
  statusLabel,
  countByStatus,
  filterRecords,
  summarizeItems,
  formatDateTime,
  telHref
} from './ordersHelpers.js';

const TABLES = { orders: 'orders', bookings: 'repair_bookings' };
const REFRESH_MS = 60000;

let supabase = null;
const state = {
  user: null,
  role: null,
  kind: 'orders',
  status: 'all',
  query: '',
  editingId: null,
  data: { orders: [], bookings: [] }
};

const $ = (id) => document.getElementById(id);

async function init() {
  bindEvents();

  if (!isSupabaseConfigured()) {
    showGate('Chưa cấu hình Supabase trong js/config.js.');
    return;
  }

  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showGate('Vui lòng đăng nhập tài khoản quản trị.');
      return;
    }

    const { data: isAdmin, error } = await supabase.rpc('is_admin');
    if (error || isAdmin !== true) {
      showGate('Tài khoản này chưa được cấp quyền quản trị.');
      return;
    }

    const { data: role } = await supabase.rpc('current_admin_role');
    state.role = typeof role === 'string' ? role : 'staff';
    state.user = session.user;
    $('gateSection').classList.add('hidden');
    $('ordersApp').classList.remove('hidden');
    await loadAll();
    setInterval(() => { if (!document.hidden && !state.editingId) loadAll({ silent: true }); }, REFRESH_MS);
  } catch (err) {
    console.error('[Orders] Không thể khởi tạo:', err);
    showGate('Không thể kết nối máy chủ. Vui lòng thử lại.');
  }
}

function showGate(message) {
  $('gateMessage').textContent = message;
  $('gateSection').classList.remove('hidden');
  $('ordersApp').classList.add('hidden');
}

async function loadAll({ silent = false } = {}) {
  if (!silent) $('ordLoading').classList.remove('hidden');
  $('ordError').classList.add('hidden');
  try {
    const [orders, bookings] = await Promise.all([
      supabase.from(TABLES.orders).select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from(TABLES.bookings).select('*').order('created_at', { ascending: false }).limit(500)
    ]);
    if (orders.error) throw orders.error;
    if (bookings.error) throw bookings.error;
    state.data.orders = orders.data || [];
    state.data.bookings = bookings.data || [];
    render();
  } catch (err) {
    console.error('[Orders] Lỗi tải dữ liệu:', err);
    if (!silent) showError(err.message || 'Không thể tải dữ liệu. Vui lòng thử lại.');
  } finally {
    $('ordLoading').classList.add('hidden');
  }
}

function showError(msg) {
  const box = $('ordError');
  box.textContent = msg;
  box.classList.remove('hidden');
}

function render() {
  const records = state.data[state.kind];
  const counts = countByStatus(records);

  $('badgeOrders').textContent = String(state.data.orders.filter(r => r.status === 'new').length);
  $('badgeBookings').textContent = String(state.data.bookings.filter(r => r.status === 'new').length);

  const chips = [{ value: 'all', label: 'Tất cả' }, ...statusesFor(state.kind)];
  $('ordChips').innerHTML = chips.map(c => `
    <button type="button" class="ord-chip ${c.value === state.status ? 'active' : ''}" data-status="${escapeHtml(c.value)}" aria-pressed="${c.value === state.status}">
      ${escapeHtml(c.label)} (${counts[c.value] || 0})
    </button>`).join('');

  const rows = filterRecords(records, { status: state.status, query: state.query });
  $('ordList').innerHTML = rows.length === 0
    ? '<div class="ord-empty">Chưa có dữ liệu phù hợp.</div>'
    : rows.map(r => state.kind === 'orders' ? orderCard(r) : bookingCard(r)).join('');
}

function statusSelect(record) {
  return `
    <select class="select-input" data-action="status" data-id="${escapeHtml(record.id)}" aria-label="Trạng thái ${escapeHtml(record.code)}">
      ${statusesFor(state.kind).map(s => `<option value="${escapeHtml(s.value)}" ${s.value === record.status ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
    </select>`;
}

function noteBlock(record) {
  return `
    <div class="ord-note">
      <label class="form-label" for="note-${escapeHtml(record.id)}">Ghi chú nội bộ</label>
      <textarea class="form-textarea" id="note-${escapeHtml(record.id)}" rows="2" maxlength="1000" data-note-for="${escapeHtml(record.id)}">${escapeHtml(record.admin_note || '')}</textarea>
      <button type="button" class="btn btn-secondary btn-sm" data-action="save-note" data-id="${escapeHtml(record.id)}">Lưu ghi chú</button>
    </div>`;
}

function contractLink(type, record) {
  return `<a class="btn btn-secondary btn-sm" href="./print.html?type=${type}&doc=contract&id=${encodeURIComponent(record.id)}" target="_blank" rel="noopener">In hợp đồng</a>`;
}

function pickupLink(record) {
  return `<a class="btn btn-secondary btn-sm" href="./print.html?type=pickup&id=${encodeURIComponent(record.id)}" target="_blank" rel="noopener">In phiếu lấy máy</a>`;
}

function printLink(type, record) {
  return `<a class="btn btn-secondary btn-sm" href="./print.html?type=${type}&id=${encodeURIComponent(record.id)}" target="_blank" rel="noopener">In hóa đơn</a>`;
}

function editForm(record, kind) {
  const id = escapeHtml(record.id);
  const field = (name, label, value, max, extra = '') => `
    <label class="form-label" for="ed-${name}-${id}">${label}</label>
    <input class="form-input" id="ed-${name}-${id}" data-edit="${name}" maxlength="${max}" value="${escapeHtml(value || '')}" ${extra}>`;
  const fields = kind === 'orders'
    ? field('customer_name', 'Tên khách', record.customer_name, 100) + field('phone', 'Số điện thoại', record.phone, 15, 'inputmode="tel"') + field('address', 'Địa chỉ giao hàng', record.address, 300) + field('note', 'Khách ghi chú', record.note, 500)
    : field('customer_name', 'Tên khách', record.customer_name, 100) + field('phone', 'Số điện thoại', record.phone, 15, 'inputmode="tel"') + field('device', 'Máy', record.device, 100) + field('service', 'Dịch vụ', record.service, 100) + field('note', 'Khách ghi chú', record.note, 500);
  return `
    <div class="ord-edit" data-edit-for="${id}">
      ${fields}
      <p class="ord-edit-err" data-edit-err hidden></p>
      <div class="ord-actions">
        <button type="button" class="btn btn-primary btn-sm" data-action="save-edit" data-id="${id}">Lưu thông tin</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit" data-id="${id}">Hủy</button>
      </div>
    </div>`;
}

function collectEdit(id) {
  const box = document.querySelector(`[data-edit-for="${CSS.escape(id)}"]`);
  const val = (name) => (box?.querySelector(`[data-edit="${name}"]`)?.value || '').trim();
  const patch = { customer_name: val('customer_name'), phone: normalizePhone(val('phone')) };
  const errors = [];
  if (!patch.customer_name) errors.push('Vui lòng nhập tên khách.');
  if (!patch.phone) errors.push('Số điện thoại không hợp lệ.');
  if (state.kind === 'orders') {
    patch.address = val('address');
    if (patch.address.length < 5) errors.push('Địa chỉ cần ít nhất 5 ký tự.');
  } else {
    patch.device = val('device');
    patch.service = val('service');
    if (!patch.device) errors.push('Vui lòng nhập tên máy.');
    if (!patch.service) errors.push('Vui lòng nhập dịch vụ.');
  }
  patch.note = val('note') || null;
  return { patch, errors, box };
}

function deleteButton(record) {
  return canDeleteProducts(state.role)
    ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(record.id)}">Xóa</button>`
    : '';
}

async function removeRecord(id) {
  if (!canDeleteProducts(state.role)) return showToast('Nhân viên không có quyền xóa.', 'error');
  const list = state.data[state.kind];
  const record = list.find(r => r.id === id);
  if (!record || !await confirmDialog(`Xóa vĩnh viễn ${record.code} của ${record.customer_name}? Không thể khôi phục.`, { title: 'Xóa phiếu', okText: 'Xóa', danger: true })) return;
  const { error } = await supabase.from(TABLES[state.kind]).delete().eq('id', id);
  if (error) return showToast(error.message || 'Không xóa được.', 'error');
  state.data[state.kind] = list.filter(r => r.id !== id);
  render();
  showToast(`Đã xóa ${record.code}`);
}

function editButton(record) {
  return `<button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(record.id)}">Sửa thông tin</button>`;
}

function phoneLine(record) {
  const href = telHref(record.phone);
  return `<p class="ord-line"><a href="${escapeHtml(href)}">${escapeHtml(record.phone)}</a> · ${escapeHtml(record.customer_name)}</p>`;
}

function orderCard(o) {
  return `
    <article class="ord-card" data-id="${escapeHtml(o.id)}">
      <div class="ord-card-head">
        <span class="ord-code">${escapeHtml(o.code)}</span>
        <span class="ord-time">${escapeHtml(formatDateTime(o.created_at))}</span>
      </div>
      ${state.editingId === o.id ? editForm(o, 'orders') : `${phoneLine(o)}
      <p class="ord-line ord-muted">${escapeHtml(o.address)}</p>`}
      <p class="ord-line">${escapeHtml(summarizeItems(o.items))}</p>
      ${o.note && state.editingId !== o.id ? `<p class="ord-line ord-muted">Khách ghi chú: ${escapeHtml(o.note)}</p>` : ''}
      <p class="ord-line">Tổng: <span class="ord-total">${escapeHtml(formatCurrency(o.total))}</span>
        ${o.voucher ? `<span class="ord-muted"> · mã ${escapeHtml(o.voucher)}</span>` : ''}</p>
      <div class="ord-actions">${statusSelect(o)}${editButton(o)}${printLink('order', o)}${contractLink('order', o)}${deleteButton(o)}</div>
      ${noteBlock(o)}
    </article>`;
}

function bookingCard(b) {
  return `
    <article class="ord-card" data-id="${escapeHtml(b.id)}">
      <div class="ord-card-head">
        <span class="ord-code">${escapeHtml(b.code)}</span>
        <span class="ord-time">${escapeHtml(formatDateTime(b.created_at))}</span>
      </div>
      ${state.editingId === b.id ? editForm(b, 'bookings') : `${phoneLine(b)}
      <p class="ord-line">${escapeHtml(b.device)} · ${escapeHtml(b.service)}</p>`}
      ${b.note && state.editingId !== b.id ? `<p class="ord-line ord-muted">Khách ghi chú: ${escapeHtml(b.note)}</p>` : ''}
      <div class="ord-actions">${statusSelect(b)}${editButton(b)}${printLink('booking', b)}${pickupLink(b)}${deleteButton(b)}</div>
      ${noteBlock(b)}
    </article>`;
}

async function updateRecord(id, patch, successMessage) {
  const table = TABLES[state.kind];
  const list = state.data[state.kind];
  const index = list.findIndex(r => r.id === id);
  if (index < 0) return;

  const previous = list[index];
  list[index] = { ...previous, ...patch };
  render();

  const { error } = await supabase
    .from(table)
    .update({ ...patch, handled_by: state.user.id })
    .eq('id', id);

  if (error) {
    list[index] = previous;
    render();
    showToast(error.message || 'Không lưu được, vui lòng thử lại.', 'error');
    return;
  }
  showToast(successMessage);
}

function bindEvents() {
  $('refreshBtn').addEventListener('click', () => loadAll());
  $('logoutBtn').addEventListener('click', async () => {
    if (supabase) await supabase.auth.signOut();
    location.href = './index.html';
  });

  document.querySelectorAll('.ord-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.kind = tab.dataset.kind;
      state.status = 'all';
      document.querySelectorAll('.ord-tab').forEach(t => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
      });
      render();
    });
  });

  $('ordSearch').addEventListener('input', (e) => {
    state.query = e.target.value;
    render();
  });

  $('ordChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (!chip) return;
    state.status = chip.dataset.status;
    render();
  });

  $('ordList').addEventListener('change', (e) => {
    const select = e.target.closest('select[data-action="status"]');
    if (!select) return;
    updateRecord(select.dataset.id, { status: select.value }, `Đã chuyển sang "${statusLabel(state.kind, select.value)}"`);
  });

  $('ordList').addEventListener('click', (e) => {
    const del = e.target.closest('[data-action="delete"]');
    if (del) { removeRecord(del.dataset.id); return; }
    const edit = e.target.closest('[data-action="edit"], [data-action="cancel-edit"], [data-action="save-edit"]');
    if (edit) {
      const act = edit.dataset.action;
      if (act === 'edit') { state.editingId = edit.dataset.id; render(); return; }
      if (act === 'cancel-edit') { state.editingId = null; render(); return; }
      const { patch, errors, box } = collectEdit(edit.dataset.id);
      const err = box.querySelector('[data-edit-err]');
      if (errors.length) { err.textContent = errors[0]; err.hidden = false; return; }
      state.editingId = null;
      updateRecord(edit.dataset.id, patch, 'Đã lưu thông tin');
      return;
    }
    const btn = e.target.closest('[data-action="save-note"]');
    if (!btn) return;
    const area = document.querySelector(`[data-note-for="${CSS.escape(btn.dataset.id)}"]`);
    updateRecord(btn.dataset.id, { admin_note: (area?.value || '').trim() || null }, 'Đã lưu ghi chú');
  });
}

function showToast(message, type = 'info') {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

init();
