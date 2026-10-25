/**
 * Tien Mobile - Admin Thu chi
 * Sổ thu / chi theo tháng, thống kê tổng thu, tổng chi, lợi nhuận và theo nhóm. Chỉ chủ shop (owner) được xóa.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../js/config.js';

import { confirmDialog } from '../js/dialog.js';import { escapeHtml } from '../js/utils.js';
import { formatCurrency } from './adminHelpers.js';
import { formatDate } from '../js/warranty.js';
import {
  CASHFLOW_KINDS, categoriesFor, validateEntry, monthKey, monthOptions, filterEntries, summarize
} from './cashflowHelpers.js';

let supabase = null;
const state = { role: null, entries: [], month: '', kind: 'all', formKind: 'in' };
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
    state.role = typeof role === 'string' ? role : 'staff';
    state.month = todayIso().slice(0, 7);
    $('gateSection').classList.add('hidden');
    $('cApp').classList.remove('hidden');
    await load();
  } catch (err) {
    console.error('[Cashflow] Không thể khởi tạo:', err);
    showGate('Không thể kết nối máy chủ. Vui lòng thử lại.');
  }
}

function showGate(message) {
  $('gateMessage').textContent = message;
  $('gateSection').classList.remove('hidden');
  $('cApp').classList.add('hidden');
}

async function load() {
  $('cLoading').classList.remove('hidden');
  $('cError').classList.add('hidden');
  try {
    const { data, error } = await supabase.from('cashflow_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(2000);
    if (error) throw error;
    state.entries = data || [];
  } catch (err) {
    console.error('[Cashflow] Lỗi tải:', err);
    $('cError').textContent = 'Không tải được sổ thu chi. Hãy chạy supabase/cashflow.sql rồi thử lại.';
    $('cError').classList.remove('hidden');
  }
  $('cLoading').classList.add('hidden');
  render();
}

function render() {
  const months = monthOptions(state.entries, todayIso().slice(0, 7));
  $('cMonth').innerHTML = `<option value="all">Tất cả các tháng</option>` + months.map(m => `<option value="${m}">Tháng ${m.slice(5)}/${m.slice(0, 4)}</option>`).join('');
  $('cMonth').value = state.month === 'all' || months.includes(state.month) ? state.month : months[0];

  const inMonth = filterEntries(state.entries, { month: $('cMonth').value });
  const s = summarize(inMonth);
  const cat = (rows) => rows.length
    ? `<table class="cf-table"><tbody>${rows.map(([name, amount]) => `<tr><td>${escapeHtml(name)}</td><td class="cf-r">${escapeHtml(formatCurrency(amount))}</td></tr>`).join('')}</tbody></table>`
    : '<p class="ord-muted">Chưa có.</p>';
  $('cStats').innerHTML = `
    <div class="cf-cards">
      <div class="cf-card"><span>Tổng thu</span><b class="cf-in">${escapeHtml(formatCurrency(s.totalIn))}</b><small>${s.countIn} khoản</small></div>
      <div class="cf-card"><span>Tổng chi</span><b class="cf-out">${escapeHtml(formatCurrency(s.totalOut))}</b><small>${s.countOut} khoản</small></div>
      <div class="cf-card"><span>Lợi nhuận (thu - chi)</span><b class="${s.profit < 0 ? 'cf-out' : 'cf-in'}">${escapeHtml(formatCurrency(s.profit))}</b></div>
    </div>
    <div class="cf-cols">
      <div><h3 class="cf-h">Thu theo nhóm</h3>${cat(s.byCategory.in)}</div>
      <div><h3 class="cf-h">Chi theo nhóm</h3>${cat(s.byCategory.out)}</div>
    </div>`;

  $('cChips').innerHTML = [['all', 'Tất cả'], ...CASHFLOW_KINDS].map(([k, label]) =>
    `<button type="button" class="ord-chip ${state.kind === k ? 'active' : ''}" data-kind="${k}">${label}</button>`).join('');

  const rows = filterEntries(inMonth, { kind: state.kind });
  const canDelete = state.role === 'owner';
  $('cList').innerHTML = rows.length === 0 ? '<p class="ord-empty">Chưa có khoản nào.</p>' : rows.map(e => `
    <article class="ord-card cf-row">
      <div class="ord-card-head">
        <span class="ord-code ${e.kind === 'in' ? 'cf-in' : 'cf-out'}">${e.kind === 'in' ? '+' : '-'}${escapeHtml(formatCurrency(e.amount))}</span>
        <span class="ord-time">${escapeHtml(formatDate(e.entry_date))}</span>
      </div>
      <p class="ord-line">${e.kind === 'in' ? 'Thu' : 'Chi'} · ${escapeHtml(e.category)}${e.ref_code ? ` · ${escapeHtml(e.ref_code)}` : ''}</p>
      ${e.note ? `<p class="ord-line ord-muted">${escapeHtml(e.note)}</p>` : ''}
      ${canDelete ? `<div class="ord-actions"><button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(e.id)}">Xóa</button></div>` : ''}
    </article>`).join('');
}

function openDialog(kind) {
  state.formKind = kind;
  $('cDialogTitle').textContent = kind === 'in' ? 'Ghi khoản thu' : 'Ghi khoản chi';
  $('eCategory').innerHTML = categoriesFor(kind).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  $('eAmount').value = '';
  $('eNote').value = '';
  $('eDate').value = todayIso();
  $('cFormError').classList.add('hidden');
  $('cDialog').showModal();
}

async function save(e) {
  e.preventDefault();
  const result = validateEntry({ kind: state.formKind, amount: $('eAmount').value, category: $('eCategory').value, date: $('eDate').value, note: $('eNote').value });
  if (!result.valid) {
    $('cFormError').textContent = result.errors[0];
    $('cFormError').classList.remove('hidden');
    return;
  }
  const { error } = await supabase.from('cashflow_entries').insert(result.row);
  if (error) {
    $('cFormError').textContent = error.message || 'Không lưu được.';
    $('cFormError').classList.remove('hidden');
    return;
  }
  $('cDialog').close();
  toast('Đã lưu');
  state.month = monthKey(result.row.entry_date);
  await load();
}

async function remove(id) {
  if (state.role !== 'owner') return toast('Chỉ chủ shop được xóa.', 'error');
  if (!await confirmDialog('Xóa khoản này? Không thể khôi phục.', { title: 'Xóa khoản thu chi', okText: 'Xóa', danger: true })) return;
  const { error } = await supabase.from('cashflow_entries').delete().eq('id', id);
  if (error) return toast(error.message || 'Không xóa được.', 'error');
  state.entries = state.entries.filter(x => x.id !== id);
  render();
  toast('Đã xóa');
}

function bindEvents() {
  $('addInBtn').addEventListener('click', () => openDialog('in'));
  $('addOutBtn').addEventListener('click', () => openDialog('out'));
  $('cCancel').addEventListener('click', () => $('cDialog').close());
  $('cForm').addEventListener('submit', save);
  $('cPrint').addEventListener('click', () => window.print());
  $('cMonth').addEventListener('change', (e) => { state.month = e.target.value; render(); });
  $('cChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-kind]');
    if (!chip) return;
    state.kind = chip.dataset.kind;
    render();
  });
  $('cList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (btn) remove(btn.dataset.id);
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
  setTimeout(() => el.remove(), 3500);
}

init();
