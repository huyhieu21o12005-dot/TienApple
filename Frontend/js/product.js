/**
 * Tien Mobile - Trang chi tiết sản phẩm (product.html?id=...).
 * Dùng chung giỏ hàng (localStorage) với trang chủ; nút Quay lại về trang trước đó.
 */

import { CartManager } from './store.js';
import { fetchProducts } from './productsApi.js';
import { escapeHtml, safeUrl, safeColor, discountPercent, imageZoomClass } from './utils.js';
import { confirmDialog } from './dialog.js';

const NO_IMAGE = './assets/no-image.svg';
const $ = (id) => document.getElementById(id);
const cart = new CartManager();
cart.loadFromLocalStorage();

/** Về trang trước đó; nếu mở trực tiếp (không có trang trước trong site) thì về danh mục điện thoại. */
function goBack() {
  const sameSite = document.referrer && new URL(document.referrer).origin === location.origin;
  if (sameSite && history.length > 1) history.back();
  else location.href = 'index.html#dienthoai';
}

function updateBadge() {
  $('cartCount').textContent = cart.getItemCount();
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.add('hidden'), 2200);
}

async function loadProduct(id) {
  let list = null;
  try { list = await fetchProducts({ allowEmpty: true }); } catch { list = null; }
  // chỉ dùng dữ liệu mẫu khi không kết nối được cơ sở dữ liệu (null); danh sách trống là trống thật
  if (!Array.isArray(list)) {
    try {
      const res = await fetch('data/products.json');
      if (res.ok) list = await res.json();
    } catch { /* bỏ qua */ }
  }
  return (Array.isArray(list) ? list : []).find(p => String(p.id) === String(id)) || null;
}

function render(p) {
  const colors = Array.isArray(p.colors) ? p.colors : [];
  const storages = Array.isArray(p.storages) ? p.storages : [];
  let color = p.defaultColor || colors[0]?.name || '';
  let storage = storages[0] || '';
  const soldOut = p.stock !== undefined && p.stock !== null && Number(p.stock) <= 0;
  const percent = discountPercent(p.price, p.oldPrice);
  const money = (n) => CartManager.formatCurrency(n);

  document.title = `${p.name} — Tien Mobile Thu Duc`;
  $('crumbs').innerHTML = `<a href="index.html#trangchu" class="hover:text-[#1D1D1F]">Trang chủ</a> › <a href="index.html#${p.kind === 'accessory' ? 'phukien' : 'dienthoai'}" class="hover:text-[#1D1D1F]">${p.kind === 'accessory' ? 'Phụ kiện' : 'Điện thoại'}</a> › <span class="text-[#1D1D1F]">${escapeHtml(p.name)}</span>`;

  const specs = [['Màn hình', p.screen], ['Vi xử lý', p.chip], ['Camera', p.camera], ['Pin', p.battery]].filter(([, v]) => v);
  $('detail').innerHTML = `
    <div class="bg-[#F5F5F7] rounded-3xl p-8 flex items-center justify-center min-h-[320px] overflow-hidden">
      <img src="${escapeHtml(safeUrl(p.image) || NO_IMAGE)}" alt="${escapeHtml(p.name)}" fetchpriority="high" decoding="async" class="max-h-[300px] max-w-full object-contain tm-product-img ${imageZoomClass(p.image)}" onerror="this.onerror=null;this.src='${NO_IMAGE}'" />
    </div>
    <div>
      <div class="flex flex-wrap items-center gap-2 mb-2">
        ${p.conditionLabel ? `<span class="px-2.5 py-0.5 rounded bg-[#F5F5F7] text-[11px] font-semibold uppercase">${escapeHtml(p.conditionLabel)}</span>` : ''}
        ${p.badge ? `<span class="px-2.5 py-0.5 rounded bg-[#0071E3]/10 text-[#0071E3] text-[11px] font-semibold">${escapeHtml(p.badge)}</span>` : ''}
      </div>
      <h1 class="text-[26px] font-semibold leading-tight mb-2">${escapeHtml(p.name)}</h1>
      <div class="text-[12px] text-[#6E6E73] mb-4">★ ${Number.isFinite(Number(p.rating)) ? Number(p.rating).toFixed(1) : '5.0'} (${Number(p.reviewCount) || 0} đánh giá)</div>
      <div class="flex items-baseline flex-wrap gap-3 mb-5">
        <span class="text-[28px] font-bold">${money(p.price)}</span>
        ${p.oldPrice ? `<span class="text-[15px] text-[#6E6E73] line-through">${money(p.oldPrice)}</span>` : ''}
        ${percent ? `<span class="text-[12px] font-semibold px-2 py-0.5 rounded bg-[#0071E3]/10 text-[#0071E3]">-${percent}%</span>` : ''}
      </div>
      ${colors.length ? `<div class="mb-4"><div class="text-[12px] font-semibold text-[#6E6E73] uppercase mb-2">Màu sắc: <span id="colorLabel" class="text-[#1D1D1F]">${escapeHtml(color)}</span></div>
        <div id="swatches" class="flex gap-2.5 flex-wrap">${colors.map(c => `<button type="button" data-color="${escapeHtml(c.name)}" title="${escapeHtml(c.name)}" class="w-8 h-8 rounded-full border-2 cursor-pointer" style="background:${safeColor(c.hex)}"></button>`).join('')}</div></div>` : ''}
      ${storages.length ? `<div class="mb-5"><div class="text-[12px] font-semibold text-[#6E6E73] uppercase mb-2">Dung lượng</div>
        <div id="storages" class="flex gap-2 flex-wrap">${storages.map(s => `<button type="button" data-storage="${escapeHtml(s)}" class="px-4 h-9 rounded-full border text-[13px] cursor-pointer">${escapeHtml(s)}</button>`).join('')}</div></div>` : ''}
      ${specs.length ? `<div class="grid grid-cols-2 gap-2.5 text-[12px] p-3.5 bg-[#F5F5F7] rounded-xl mb-5">${specs.map(([k, v]) => `<div><span class="text-[#6E6E73]">${k}:</span> <strong>${escapeHtml(v)}</strong></div>`).join('')}</div>` : ''}
      ${p.description ? `<p class="text-[14px] leading-relaxed text-[#424245] mb-5 whitespace-pre-line">${escapeHtml(p.description)}</p>` : ''}
      <div class="flex items-center gap-2 text-[12px] text-[#6E6E73] mb-5"><span class="material-symbols-outlined text-[16px] text-emerald-600">verified</span> Bảo hành theo chính sách cửa hàng • Kiểm tra máy trước khi thanh toán</div>
      <div class="flex gap-2.5 sticky bottom-0 -mx-4 px-4 py-3 sm:static sm:m-0 sm:p-0 bg-white/95 backdrop-blur border-t border-[#D2D2D7]/60 sm:border-0">
        <button id="buyNow" type="button" ${soldOut ? 'disabled' : ''} class="flex-1 min-w-[160px] h-12 rounded-full bg-[#1D1D1F] text-white text-[14px] font-semibold cursor-pointer border-0 disabled:opacity-40">${soldOut ? 'Tạm hết hàng' : 'Đặt mua ngay'}</button>
        <button id="addCart" type="button" ${soldOut ? 'disabled' : ''} class="h-12 px-5 rounded-full border border-[#D2D2D7] text-[14px] font-medium cursor-pointer bg-white disabled:opacity-40">+ Giỏ hàng</button>
      </div>
    </div>`;

  const mark = () => {
    document.querySelectorAll('#swatches [data-color]').forEach(b => { b.style.borderColor = b.dataset.color === color ? '#1D1D1F' : '#D2D2D7'; });
    document.querySelectorAll('#storages [data-storage]').forEach(b => {
      const on = b.dataset.storage === storage;
      b.style.borderColor = on ? '#1D1D1F' : '#D2D2D7';
      b.style.background = on ? '#1D1D1F' : '#fff';
      b.style.color = on ? '#fff' : '#1D1D1F';
    });
    const label = $('colorLabel');
    if (label) label.textContent = color;
  };
  $('detail').addEventListener('click', async (e) => {
    const c = e.target.closest('[data-color]');
    const s = e.target.closest('[data-storage]');
    if (c) { color = c.dataset.color; mark(); return; }
    if (s) { storage = s.dataset.storage; mark(); return; }
    const add = e.target.closest('#addCart');
    const buy = e.target.closest('#buyNow');
    if (!add && !buy) return;
    cart.addItem(p, 1, color, storage);
    updateBadge();
    if (buy) { location.href = 'index.html?cart=1'; return; }
    toast(`Đã thêm "${p.name}" vào giỏ hàng`);
    if (await confirmDialog(`Đã thêm "${p.name}" vào giỏ hàng.`, { title: 'Thêm vào giỏ hàng', okText: 'Xem giỏ hàng', cancelText: 'Tiếp tục xem' })) location.href = 'index.html?cart=1';
  });
  mark();
  $('state').classList.add('hidden');
  $('detail').classList.remove('hidden');
}

async function init() {
  $('backBtn').addEventListener('click', goBack);
  updateBadge();
  const id = new URLSearchParams(location.search).get('id');
  const product = id ? await loadProduct(id) : null;
  if (!product) {
    $('state').innerHTML = 'Không tìm thấy sản phẩm này (có thể đã ngừng bán).<br><a href="index.html#dienthoai" class="inline-block mt-4 px-5 py-2 rounded-full bg-[#1D1D1F] text-white no-underline text-[13px]">Về danh sách sản phẩm</a>';
    return;
  }
  render(product);
}

init();
