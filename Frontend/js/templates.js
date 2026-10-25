/**
 * Tien Mobile - HTML templates (pure string builders, testable in Node)
 * Mọi dữ liệu động đều được escape; id/tên chèn vào onclick đi qua jsArg().
 */

import { CartManager } from './store.js';
import { escapeHtml, jsArg, safeUrl, safeColor, discountPercent } from './utils.js';
import { formatDate } from './warranty.js';

/** Ảnh tạm khi sản phẩm chưa có ảnh. */
const NO_IMAGE = './assets/no-image.svg';
import { installmentStatusLabel } from './installment.js';

export function isOutOfStock(product) {
  return product != null && product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0;
}

/**
 * Thẻ sản phẩm (điện thoại hoặc phụ kiện) cho lưới danh mục.
 * @param {object} p
 * @param {{ accessory?: boolean }} [opts]
 * @returns {string}
 */
export function productCardHtml(p, opts = {}) {
  const idArg = jsArg(p.id);
  const label = opts.accessory ? 'Chính hãng' : (p.conditionLabel || '');
  const rating = Number(p.rating);
  const ratingText = isFinite(rating) ? rating.toFixed(1) : '5.0';
  const percent = discountPercent(p.price, p.oldPrice);
  const soldOut = isOutOfStock(p);

  return `
      <article class="product-card" data-id="${escapeHtml(p.id)}">
        <div>
          <div class="flex flex-wrap items-center justify-between gap-1 mb-2">
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-white text-[#1D1D1F] border border-[#D2D2D7]/70">${escapeHtml(label)}</span>
            ${p.badge ? `<span class="text-[10px] font-medium text-[#0071E3] bg-[#0071E3]/5 px-2 py-0.5 rounded">${escapeHtml(p.badge)}</span>` : ''}
          </div>

          <div class="h-44 w-full flex items-center justify-center p-3 mb-2 bg-[#F5F5F7] rounded-xl cursor-pointer overflow-hidden group" onclick="window.tienApp.openProductModalById(${idArg})">
            <img
              alt="${escapeHtml(p.name)}"
              class="h-full object-contain group-hover:scale-105 transition-transform duration-300"
              src="${escapeHtml(safeUrl(p.image) || NO_IMAGE)}"
              loading="lazy"
            />
          </div>

          <div class="text-[11px] text-[#6E6E73] flex items-center gap-1 mb-1">
            <span class="text-amber-500 font-semibold">★ ${ratingText}</span>
            <span>(${Number(p.reviewCount) || 0} đánh giá)</span>
          </div>

          <h3 class="text-[16px] font-semibold text-[#1D1D1F] leading-snug line-clamp-1 cursor-pointer hover:text-[#0071E3] transition-colors" onclick="window.tienApp.openProductModalById(${idArg})">
            ${escapeHtml(p.name)}
          </h3>
          <p class="text-[12px] text-[#6E6E73] line-clamp-1 mt-0.5">${escapeHtml(p.description)}</p>
        </div>

        <div class="mt-4 pt-3 border-t border-[#D2D2D7]/50">
          <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 mb-3">
            <div>
              <div class="text-[16px] sm:text-[18px] font-semibold text-[#1D1D1F] leading-tight whitespace-nowrap">${CartManager.formatCurrency(Number(p.price) || 0)}</div>
              ${percent > 0 ? `<div class="text-[12px] text-[#6E6E73] line-through">${CartManager.formatCurrency(Number(p.oldPrice))}</div>` : ''}
            </div>
            ${percent > 0 ? `<span class="text-[10px] font-medium text-[#0071E3] bg-[#0071E3]/10 px-1.5 py-0.5 rounded">-${percent}%</span>` : ''}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <button class="w-full py-2.5 text-center rounded-full bg-[#F5F5F7] text-[#1D1D1F] text-[12px] font-medium hover:bg-[#EAEAEA] transition-colors cursor-pointer" onclick="window.tienApp.openProductModalById(${idArg})">
              Xem & Đặt mua
            </button>
            ${soldOut
              ? `<button class="w-full py-2.5 text-center rounded-full bg-[#F5F5F7] text-[#6E6E73] text-[12px] font-medium cursor-not-allowed" disabled>Hết hàng</button>`
              : `<button class="w-full py-2.5 text-center rounded-full bg-[#1D1D1F] text-white text-[12px] font-medium hover:bg-black transition-colors cursor-pointer" onclick="window.tienApp.quickAddToCart(${idArg})">+ Giỏ hàng</button>`}
          </div>
        </div>
      </article>
    `;
}

export function emptyCatalogHtml() {
  return `
        <div class="col-span-full py-16 text-center text-[#6E6E73]">
          <span class="material-symbols-outlined text-[48px] text-[#D2D2D7] mb-2 block">devices_off</span>
          <p class="text-[17px] font-medium text-[#1D1D1F]">Không tìm thấy thiết bị phù hợp</p>
          <p class="text-[14px]">Vui lòng điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm.</p>
        </div>
      `;
}

export function swatchesHtml(colors, selectedColor) {
  const list = Array.isArray(colors) && colors.length ? colors : [{ name: 'Tiêu chuẩn', hex: '#FFFFFF' }];
  return list.map(c => `
        <button
          type="button"
          title="${escapeHtml(c.name)}"
          aria-label="Màu ${escapeHtml(c.name)}"
          class="swatch-btn ${c.name === selectedColor ? 'active' : ''}"
          style="background-color: ${safeColor(c.hex)};"
          onclick="window.tienApp.selectModalColor(${jsArg(c.name)})"
        ></button>
      `).join('');
}

export function storageChipsHtml(storages, selectedStorage) {
  const list = Array.isArray(storages) && storages.length ? storages : ['Chuẩn Zin'];
  return list.map(s => `
        <button
          type="button"
          class="storage-chip ${s === selectedStorage ? 'active' : ''}"
          onclick="window.tienApp.selectModalStorage(${jsArg(s)})"
        >
          ${escapeHtml(s)}
        </button>
      `).join('');
}

export function cartItemHtml(item, index) {
  const product = item.product || {};
  const qty = Number(item.quantity) || 1;
  return `
        <div class="p-3.5 rounded-2xl bg-[#F5F5F7] flex gap-3.5 relative">
          <div class="w-18 h-18 rounded-xl bg-white flex-shrink-0 p-1 flex items-center justify-center border border-[#D2D2D7]/50">
            <img class="max-h-full max-w-full object-contain" src="${escapeHtml(safeUrl(product.image) || NO_IMAGE)}" alt="${escapeHtml(product.name)}" />
          </div>
          <div class="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <div class="flex items-start justify-between gap-1">
                <h4 class="text-[14px] font-semibold text-[#1D1D1F] truncate leading-tight">${escapeHtml(product.name)}</h4>
                <button class="text-[#6E6E73] hover:text-red-600 transition-colors cursor-pointer p-2" onclick="window.tienApp.removeCartItem(${index | 0})" title="Xóa" aria-label="Xóa khỏi giỏ hàng">
                  <span class="material-symbols-outlined text-[17px]">delete</span>
                </button>
              </div>
              <p class="text-[11px] text-[#6E6E73] mt-0.5">${escapeHtml(item.color)} • ${escapeHtml(item.storage)}</p>
            </div>
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-[#D2D2D7]/60">
              <div class="flex items-center rounded-full bg-white px-2 py-0.5 gap-2 border border-[#D2D2D7]">
                <button class="text-[#6E6E73] hover:text-[#1D1D1F] font-bold text-sm w-8 h-8 flex items-center justify-center cursor-pointer" aria-label="Giảm số lượng" onclick="window.tienApp.updateCartQty(${index | 0}, ${qty - 1})">-</button>
                <span class="text-xs font-semibold text-[#1D1D1F] px-1">${qty}</span>
                <button class="text-[#6E6E73] hover:text-[#1D1D1F] font-bold text-sm w-8 h-8 flex items-center justify-center cursor-pointer" aria-label="Tăng số lượng" onclick="window.tienApp.updateCartQty(${index | 0}, ${qty + 1})">+</button>
              </div>
              <span class="text-[15px] font-semibold text-[#1D1D1F]">${CartManager.formatCurrency((Number(product.price) || 0) * qty)}</span>
            </div>
          </div>
        </div>
      `;
}

export function emptyCartHtml() {
  return `
        <div class="py-12 text-center text-[#6E6E73]">
          <span class="material-symbols-outlined text-[44px] text-[#D2D2D7] mb-2 block">shopping_cart</span>
          <p class="text-[15px] font-medium text-[#1D1D1F]">Giỏ hàng của bạn đang trống</p>
          <p class="text-[13px] mt-1">Hãy khám phá các mẫu điện thoại chính hãng và thêm vào giỏ.</p>
        </div>
      `;
}

/**
 * Một phiếu bảo hành trả về từ hàm lookup_warranty (tên khách đã được che).
 */
export function warrantyRecordHtml(r) {
  const active = r.is_active === true;
  const days = Number(r.days_left) || 0;
  const badge = active
    ? `<span class="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#1D1D1F] text-white">Còn bảo hành</span>`
    : `<span class="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#F5F5F7] text-[#6E6E73] border border-[#D2D2D7]">Hết hạn</span>`;
  const remain = active
    ? `Còn ${days} ngày`
    : 'Đã hết thời hạn bảo hành';

  return `
        <article class="rounded-2xl border border-[#D2D2D7] bg-white p-5">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span class="text-[15px] font-semibold text-[#1D1D1F]">Phiếu ${escapeHtml(r.code)}</span>
            ${badge}
          </div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[14px]">
            <div><dt class="text-[12px] text-[#6E6E73]">Khách hàng</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(r.customer_name_masked)}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Thiết bị</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(r.device)}</dd></div>
            <div class="sm:col-span-2"><dt class="text-[12px] text-[#6E6E73]">Nội dung sửa chữa</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(r.service)}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Ngày bắt đầu</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(formatDate(r.start_date))}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Hạn bảo hành (${Number(r.warranty_months) || 0} tháng)</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(formatDate(r.end_date))} · ${escapeHtml(remain)}</dd></div>
          </dl>
        </article>`;
}

export function warrantyResultsHtml(records) {
  const list = Array.isArray(records) ? records.filter(Boolean) : [];
  if (list.length === 0) {
    return `
        <div class="rounded-2xl bg-[#F5F5F7] p-6 text-center text-[#6E6E73]">
          <p class="text-[15px] font-medium text-[#1D1D1F]">Không tìm thấy phiếu bảo hành</p>
          <p class="text-[13px] mt-1">Số điện thoại này chưa có phiếu bảo hành tại Tien Mobile Thu Duc. Vui lòng kiểm tra lại số hoặc liên hệ hotline.</p>
        </div>`;
  }
  return list.map(warrantyRecordHtml).join('');
}

/**
 * Kết quả tra cứu hồ sơ trả góp (một hồ sơ, tên khách đã được che).
 */
export function installmentResultHtml(r) {
  if (!r) {
    return `
        <div class="rounded-2xl bg-[#F5F5F7] p-6 text-center text-[#6E6E73]">
          <p class="text-[15px] font-medium text-[#1D1D1F]">Không tìm thấy hồ sơ trả góp</p>
          <p class="text-[13px] mt-1">Số điện thoại và mã hóa đơn chưa khớp. Vui lòng kiểm tra lại hoặc liên hệ hotline.</p>
        </div>`;
  }
  const money = (n) => CartManager.formatCurrency(Number(n) || 0);
  const paid = Number(r.paid_months) || 0;
  const term = Number(r.term_months) || 0;
  const percent = term > 0 ? Math.min(100, Math.round((paid / term) * 100)) : 0;
  const active = r.status === 'active';
  const badge = active
    ? '<span class="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#1D1D1F] text-white">Đang góp</span>'
    : `<span class="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#F5F5F7] text-[#6E6E73] border border-[#D2D2D7]">${escapeHtml(installmentStatusLabel(r.status))}</span>`;
  return `
        <article class="rounded-2xl border border-[#D2D2D7] bg-white p-5">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span class="text-[15px] font-semibold text-[#1D1D1F]">Hồ sơ ${escapeHtml(r.code)}</span>
            ${badge}
          </div>
          <div class="mb-4">
            <div class="flex justify-between text-[12px] text-[#6E6E73] mb-1"><span>Đã đóng ${paid}/${term} kỳ</span><span>${percent}%</span></div>
            <div class="h-2 rounded-full bg-[#F5F5F7] overflow-hidden"><div class="h-full bg-[#1D1D1F]" style="width:${percent}%"></div></div>
          </div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[14px]">
            <div><dt class="text-[12px] text-[#6E6E73]">Khách hàng</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(r.customer_name_masked)}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Sản phẩm</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(r.product)}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Giá gốc</dt><dd class="font-medium text-[#1D1D1F]">${money(r.original_price)}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Trả trước</dt><dd class="font-medium text-[#1D1D1F]">${money(r.down_payment)}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Lãi suất · kỳ hạn</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(String(Number(r.interest_rate) || 0).replace('.', ','))}%/tháng · ${term} tháng</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Góp mỗi tháng</dt><dd class="font-medium text-[#1D1D1F]">${money(r.monthly_payment)}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Hình thức trả</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(r.pay_method)}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Ngày bắt đầu</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(formatDate(r.start_date))}</dd></div>
            ${active ? `
            <div><dt class="text-[12px] text-[#6E6E73]">Còn lại</dt><dd class="font-medium text-[#1D1D1F]">${Number(r.remaining_months) || 0} kỳ · ${money(r.remaining_amount)}</dd></div>
            <div><dt class="text-[12px] text-[#6E6E73]">Kỳ tới</dt><dd class="font-medium text-[#1D1D1F]">${escapeHtml(formatDate(r.next_due_date)) || '-'}</dd></div>` : ''}
            <div class="sm:col-span-2 rounded-xl bg-[#1D1D1F] text-white p-3"><dt class="text-[12px] opacity-80">Thành tiền</dt><dd class="text-[20px] font-semibold">${money(r.total_amount)}</dd></div>
          </dl>
        </article>`;
}
