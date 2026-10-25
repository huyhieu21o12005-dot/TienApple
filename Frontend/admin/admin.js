/**
 * Tien Mobile - Product Admin Application Controller
 * Handles Supabase Auth, CRUD, Quick Inline Price Edit, Stock Stepper,
 * Visibility Toggle, Bulk Operations, Image Upload with Client Resize, and Filters.
 */

import { allFilterGroups, baseOf, formatThousands, markupPrice, matchPricing, parseAmount, planRules } from './pricing.js';
import { imageFor } from './modelImages.js';
import { USED_IMAGE_NOTE } from './sheetPricing.js';
import { SHEET_CSV_URL, SHEET_TAB, SHEET_USED_CSV_URL, SHEET_USED_TAB, parseSheetRows, parseSheetDate, parseUsedRows, planPriceUpdates, planNewProducts, planUsedProducts } from './sheetPricing.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../js/config.js';
import {
  formatCurrency,
  parseCurrency,
  slugify,
  validateProduct,
  applyBulkDiscount,
  mapDbToProduct,
  mapProductToDb,
  resizeImage,
  canDeleteProducts,
  roleLabel,
  usernameToEmail,
  emailToUsername
} from './adminHelpers.js';

// CDN Supabase Client pinned version
let supabase = null;

// Application State
const state = {
  user: null,
  role: null,
  products: [],
  selectedIds: new Set(),
  activeFilter: 'all', // all, phone, accessory, visible, hidden, outofstock
  activeBrand: 'all',
  activeSort: 'sort_order',
  searchQuery: '',
  isEditingPrice: null, // product ID currently editing price inline
  currentEditingProduct: null, // product object being edited in modal
  deleteTargetProduct: null, // product object to delete
  isSubmitting: false,
  storagesList: [],
  colorsList: []
};

// ==============================================================================
// 1. INITIALIZATION & AUTHENTICATION
// ==============================================================================
async function init() {
  bindGlobalEvents();

  if (!isSupabaseConfigured()) {
    showSetupNotice();
    return;
  }

  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });

    // Lắng nghe thay đổi trạng thái xác thực
    // Hoãn sang tick sau: không gọi Supabase bên trong callback để tránh nghẽn khóa auth
    supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => handleAuthChange(session), 0);
    });

    // Kiểm tra session hiện tại
    const { data: { session } } = await supabase.auth.getSession();
    handleAuthChange(session);
  } catch (err) {
    console.error('[Admin] Không thể khởi tạo Supabase:', err);
    showLoginError('Không thể kết nối máy chủ Supabase. Vui lòng kiểm tra kết nối mạng.');
  }
}

/**
 * Kiểm tra tài khoản đang đăng nhập có nằm trong bảng admin_users (hàm is_admin() trên Supabase).
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function checkIsAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.warn('[Admin] Không kiểm tra được quyền quản trị:', error.message);
    return {
      ok: false,
      message: 'Chưa thiết lập phân quyền quản trị trên Supabase. Hãy chạy supabase/admin_users.sql (xem docs/ADMIN.md).'
    };
  }
  if (data !== true) {
    return { ok: false, message: 'Tài khoản này chưa được cấp quyền quản trị. Vui lòng liên hệ chủ shop.' };
  }
  const { data: role } = await supabase.rpc('current_admin_role');
  return { ok: true, role: typeof role === 'string' ? role : 'staff' };
}

async function handleAuthChange(session) {
  if (session && session.user) {
    const access = await checkIsAdmin();
    if (!access.ok) {
      await supabase.auth.signOut();
      document.getElementById('adminApp').classList.add('hidden');
      document.getElementById('loginSection').classList.remove('hidden');
      showLoginError(access.message);
      return;
    }

    state.user = session.user;
    state.role = access.role;
    document.body.dataset.role = access.role;
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    const who = `${emailToUsername(session.user.email) || 'Admin'} · ${roleLabel(access.role)}`;
    document.getElementById('userEmailBadge').innerText = who;
    document.getElementById('userEmailBadge').title = who;
    loadProducts();
  } else {
    state.user = null;
    state.role = null;
    delete document.body.dataset.role;
    state.products = [];
    state.selectedIds.clear();
    document.getElementById('adminApp').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
  }
}

function showSetupNotice() {
  const alert = document.getElementById('loginAlert');
  alert.innerHTML = `
    <strong>Chưa hoàn tất cấu hình Supabase!</strong><br>
    Vui lòng mở tệp <code>Frontend/js/config.js</code> và thay thế <code>YOUR_SUPABASE_URL</code> cùng <code>YOUR_SUPABASE_ANON_KEY</code> bằng thông tin từ Supabase Project của bạn.
  `;
  alert.classList.remove('hidden');
}

// ==============================================================================
// 2. DATA LOADING & CRUD OPERATIONS
// ==============================================================================
async function loadProducts() {
  showLoading(true);
  hideError();

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    state.products = (data || []).map(row => mapDbToProduct(row)).filter(Boolean);
    renderProducts();
  } catch (err) {
    console.error('[Admin] Lỗi nạp sản phẩm:', err);
    showError(err.message || 'Không thể tải danh sách sản phẩm. Vui lòng thử lại.');
  } finally {
    showLoading(false);
  }
}

function showLoading(isLoading) {
  const skeleton = document.getElementById('loadingSkeleton');
  const grid = document.getElementById('productsGrid');
  if (isLoading) {
    skeleton.classList.remove('hidden');
    grid.classList.add('hidden');
  } else {
    skeleton.classList.add('hidden');
    grid.classList.remove('hidden');
  }
}

function showError(msg) {
  const errBox = document.getElementById('errorState');
  document.getElementById('errorMessage').innerText = msg;
  errBox.classList.remove('hidden');
}

function hideError() {
  document.getElementById('errorState').classList.add('hidden');
}

// ==============================================================================
// 3. FILTERING, SEARCHING & SORTING
// ==============================================================================
function getFilteredProducts() {
  let list = [...state.products];

  // 1. Phân loại theo Filter Chips
  if (state.activeFilter === 'phone') {
    list = list.filter(p => p.kind === 'phone');
  } else if (state.activeFilter === 'accessory') {
    list = list.filter(p => p.kind === 'accessory');
  } else if (state.activeFilter === 'visible') {
    list = list.filter(p => p.is_visible === true);
  } else if (state.activeFilter === 'hidden') {
    list = list.filter(p => p.is_visible === false);
  } else if (state.activeFilter === 'outofstock') {
    list = list.filter(p => p.stock <= 0);
  }

  // 2. Lọc theo thương hiệu
  if (state.activeBrand !== 'all') {
    if (state.activeBrand === 'other') {
      const topBrands = ['apple', 'samsung', 'xiaomi', 'oppo', 'kingkong'];
      list = list.filter(p => !topBrands.includes((p.brand || '').toLowerCase()));
    } else {
      list = list.filter(p => (p.brand || '').toLowerCase() === state.activeBrand);
    }
  }

  // 3. Tìm kiếm theo từ khóa
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.brandName && p.brandName.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  }

  // 4. Sắp xếp
  switch (state.activeSort) {
    case 'created_desc':
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      break;
    case 'price_asc':
      list.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      list.sort((a, b) => b.price - a.price);
      break;
    case 'name_asc':
      list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      break;
    case 'stock_asc':
      list.sort((a, b) => a.stock - b.stock);
      break;
    case 'sort_order':
    default:
      list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      break;
  }

  return list;
}

// ==============================================================================
// 4. RENDERING CARDS
// ==============================================================================
function renderProducts() {
  const filtered = getFilteredProducts();
  const grid = document.getElementById('productsGrid');
  const emptyState = document.getElementById('emptyState');
  const counter = document.getElementById('productCounter');

  counter.innerText = `${filtered.length} sản phẩm`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    updateBulkActionBar();
    return;
  }

  emptyState.classList.add('hidden');

  grid.innerHTML = filtered.map(p => {
    const isSelected = state.selectedIds.has(p.id);
    const isHidden = !p.is_visible;
    const kindLabel = p.kind === 'phone' ? 'Điện thoại' : 'Phụ kiện';
    const conditionText = p.conditionLabel || (p.condition === 'like_new' ? 'Like New 99%' : 'Mới 100%');

    return `
      <article 
        class="product-card ${isSelected ? 'is-selected' : ''} ${isHidden ? 'is-hidden-product' : ''}" 
        data-id="${escapeHtml(p.id)}"
      >
        <!-- Top row: Selection Checkbox & Badges -->
        <div class="card-top-row">
          <label class="card-select-wrapper" title="Chọn sản phẩm">
            <input 
              type="checkbox" 
              class="checkbox card-checkbox" 
              data-id="${escapeHtml(p.id)}" 
              ${isSelected ? 'checked' : ''}
              aria-label="Chọn ${escapeHtml(p.name)}"
            >
          </label>
          <div class="card-badges">
            <span class="badge-tag">${escapeHtml(kindLabel)}</span>
            <span class="badge-tag">${escapeHtml(conditionText)}</span>
            ${p.badge ? `<span class="badge-tag badge-blue">${escapeHtml(p.badge)}</span>` : ''}
            ${isHidden ? `<span class="badge-tag badge-hidden">Đang ẩn</span>` : ''}
          </div>
        </div>

        <!-- Image -->
        <div class="card-image-box">
          ${p.image 
            ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="card-img" loading="lazy" onerror="this.src='';this.className='hidden';this.nextElementSibling.classList.remove('hidden')"><span class="card-no-img hidden">Lỗi ảnh</span>`
            : `<span class="card-no-img">Không có ảnh</span>`
          }
        </div>

        <!-- Info -->
        <div class="card-content">
          <div class="card-brand">${escapeHtml(p.brandName || p.brand || '')}</div>
          <h3 class="card-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>

          <!-- Price & Quick Inline Edit -->
          <div class="card-price-section">
            <div class="price-row">
              <div class="quick-price-box" data-id="${escapeHtml(p.id)}">
                ${state.isEditingPrice === p.id 
                  ? `<input 
                      type="text" 
                      class="quick-price-input" 
                      value="${p.price}" 
                      data-id="${escapeHtml(p.id)}" 
                      data-prev="${p.price}" 
                      autofocus
                    >`
                  : `<button 
                      type="button" 
                      class="price-display-btn" 
                      data-id="${escapeHtml(p.id)}" 
                      title="Chạm để sửa giá nhanh"
                    >
                      ${formatCurrency(p.price)}
                    </button>`
                }
              </div>
              ${p.oldPrice ? `<span class="card-old-price">${formatCurrency(p.oldPrice)}</span>` : ''}
              ${p.basePrice && p.basePrice !== p.price ? `<span class="card-markup${p.price < p.basePrice ? ' neg' : ''}" title="Giá gốc ${escapeHtml(formatCurrency(p.basePrice))}">Gốc ${escapeHtml(formatCurrency(p.basePrice))} · ${p.price > p.basePrice ? '+' : '−'}${escapeHtml(formatCurrency(Math.abs(p.price - p.basePrice)))}</span>` : ''}
            </div>
          </div>

          <!-- Controls: Stock Stepper & Visibility Toggle -->
          <div class="card-controls-row">
            <div class="stock-stepper" title="Điều chỉnh số lượng tồn kho">
              <button 
                type="button" 
                class="stepper-btn btn-stock-dec" 
                data-id="${escapeHtml(p.id)}" 
                aria-label="Giảm tồn kho"
                ${p.stock <= 0 ? 'disabled' : ''}
              >-</button>
              <span class="stepper-value">${p.stock}</span>
              <button 
                type="button" 
                class="stepper-btn btn-stock-inc" 
                data-id="${escapeHtml(p.id)}" 
                aria-label="Tăng tồn kho"
              >+</button>
            </div>

            <button 
              type="button" 
              class="visibility-btn ${p.is_visible ? 'is-active' : 'is-hidden'}" 
              data-id="${escapeHtml(p.id)}"
              title="Nhấn để bật/tắt hiển thị"
            >
              ${p.is_visible ? 'Đang hiện' : 'Đang ẩn'}
            </button>
          </div>

          <!-- Actions: Sửa & Xóa -->
          <div class="card-actions-row">
            <button 
              type="button" 
              class="btn btn-secondary btn-sm btn-edit-prod" 
              data-id="${escapeHtml(p.id)}"
            >
              Sửa
            </button>
            <button 
              type="button" 
              class="btn btn-danger btn-sm btn-delete-prod" 
              data-id="${escapeHtml(p.id)}" 
              data-name="${escapeHtml(p.name)}"
            >
              Xóa
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  bindCardEvents();
  updateBulkActionBar();
}

// ==============================================================================
// 5. CARD INTERACTIONS: QUICK PRICE EDIT, STOCK STEPPER, VISIBILITY
// ==============================================================================
function bindCardEvents() {
  const grid = document.getElementById('productsGrid');

  // 1. Checkbox selection for bulk mode
  grid.querySelectorAll('.card-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        state.selectedIds.add(id);
      } else {
        state.selectedIds.delete(id);
      }
      const card = e.target.closest('.product-card');
      if (card) {
        card.classList.toggle('is-selected', e.target.checked);
      }
      updateBulkActionBar();
    });
  });

  // 2. Click price to edit inline
  grid.querySelectorAll('.price-display-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      state.isEditingPrice = id;
      renderProducts();
      // Auto-focus input
      const input = grid.querySelector(`.quick-price-input[data-id="${id}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    });
  });

  // 3. Quick price input save / blur / esc
  grid.querySelectorAll('.quick-price-input').forEach(input => {
    const saveInlinePrice = async () => {
      const id = input.dataset.id;
      const prevPrice = parseInt(input.dataset.prev, 10);
      const newPrice = parseCurrency(input.value);

      state.isEditingPrice = null;

      if (isNaN(newPrice) || newPrice < 0) {
        showToast('Giá nhập vào không hợp lệ', 'error');
        renderProducts();
        return;
      }

      if (newPrice === prevPrice) {
        renderProducts();
        return;
      }

      // Optimistic update
      const prod = state.products.find(p => p.id === id);
      const hadBase = Boolean(prod?.basePrice);
      if (prod) {
        if (!hadBase) prod.basePrice = prevPrice;
        prod.price = newPrice;
      }
      renderProducts();

      try {
        const { error } = await supabase
          .from('products')
          .update({ price: newPrice, ...(hadBase ? {} : { base_price: prevPrice }), updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;
        showToast(`Đã lưu giá mới: ${formatCurrency(newPrice)}`, 'success');
      } catch (err) {
        console.error('[Admin] Lỗi cập nhật giá:', err);
        // Rollback
        if (prod) prod.price = prevPrice;
        renderProducts();
        showToast('Lỗi lưu giá mới. Đã khôi phục giá cũ.', 'error');
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveInlinePrice();
      } else if (e.key === 'Escape') {
        state.isEditingPrice = null;
        renderProducts();
      }
    });

    input.addEventListener('blur', () => {
      if (state.isEditingPrice === input.dataset.id) {
        saveInlinePrice();
      }
    });
  });

  // 4. Stock Stepper (+ / -)
  grid.querySelectorAll('.btn-stock-dec').forEach(btn => {
    btn.addEventListener('click', () => updateStock(btn.dataset.id, -1));
  });

  grid.querySelectorAll('.btn-stock-inc').forEach(btn => {
    btn.addEventListener('click', () => updateStock(btn.dataset.id, 1));
  });

  // 5. Visibility Toggle
  grid.querySelectorAll('.visibility-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleVisibility(btn.dataset.id));
  });

  // 6. Edit button (opens modal)
  grid.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  // 7. Delete button (opens confirmation dialog)
  grid.querySelectorAll('.btn-delete-prod').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const prod = state.products.find(p => p.id === id);
      if (prod) openDeleteModal(prod);
    });
  });
}

async function updateStock(id, delta) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  const prevStock = prod.stock;
  const newStock = Math.max(0, prevStock + delta);
  if (newStock === prevStock) return;

  // Optimistic update
  prod.stock = newStock;
  renderProducts();

  try {
    const { error } = await supabase
      .from('products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error('[Admin] Lỗi cập nhật tồn kho:', err);
    prod.stock = prevStock;
    renderProducts();
    showToast('Lỗi cập nhật tồn kho. Đã khôi phục.', 'error');
  }
}

async function toggleVisibility(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  const prevVisible = prod.is_visible;
  const newVisible = !prevVisible;

  // Optimistic update
  prod.is_visible = newVisible;
  renderProducts();

  try {
    const { error } = await supabase
      .from('products')
      .update({ is_visible: newVisible, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    showToast(newVisible ? `Đã hiện "${prod.name}"` : `Đã ẩn "${prod.name}"`, 'success');
  } catch (err) {
    console.error('[Admin] Lỗi cập nhật trạng thái hiển thị:', err);
    prod.is_visible = prevVisible;
    renderProducts();
    showToast('Lỗi cập nhật hiển thị. Đã khôi phục.', 'error');
  }
}

// ==============================================================================
// 6. BULK OPERATIONS
// ==============================================================================
function updateBulkActionBar() {
  const bar = document.getElementById('bulkActionBar');
  const countEl = document.getElementById('selectedCount');
  const selectAllCb = document.getElementById('selectAllCheckbox');
  const filtered = getFilteredProducts();

  const count = state.selectedIds.size;
  countEl.innerText = count;

  if (count > 0) {
    bar.classList.remove('hidden');
    selectAllCb.checked = filtered.length > 0 && filtered.every(p => state.selectedIds.has(p.id));
  } else {
    bar.classList.add('hidden');
    selectAllCb.checked = false;
  }
}

async function bulkSetVisibility(isVisible) {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;

  // Optimistic update
  ids.forEach(id => {
    const p = state.products.find(item => item.id === id);
    if (p) p.is_visible = isVisible;
  });
  renderProducts();

  try {
    const { error } = await supabase
      .from('products')
      .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
      .in('id', ids);

    if (error) throw error;
    showToast(`Đã ${isVisible ? 'hiện' : 'ẩn'} ${ids.length} sản phẩm`, 'success');
  } catch (err) {
    console.error('[Admin] Lỗi bulk update visibility:', err);
    showToast('Lỗi khi cập nhật hàng loạt', 'error');
    loadProducts(); // reload accurate state
  }
}

async function executeBulkDiscount(percent) {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;

  const updates = [];
  ids.forEach(id => {
    const prod = state.products.find(p => p.id === id);
    if (prod) {
      const newPrice = applyBulkDiscount(prod.price, percent);
      const oldPrice = prod.oldPrice || prod.price;
      const base = prod.basePrice || prod.price;
      prod.oldPrice = oldPrice;
      prod.basePrice = base;
      prod.price = newPrice;
      updates.push({ id, price: newPrice, old_price: oldPrice, base_price: base });
    }
  });

  renderProducts();

  try {
    // Cập nhật từng dòng trong database
    for (const u of updates) {
      await supabase
        .from('products')
        .update({ price: u.price, old_price: u.old_price, base_price: u.base_price, updated_at: new Date().toISOString() })
        .eq('id', u.id);
    }
    showToast(`Đã giảm ${percent}% cho ${updates.length} sản phẩm`, 'success');
  } catch (err) {
    console.error('[Admin] Lỗi giảm giá hàng loạt:', err);
    showToast('Lỗi áp dụng giảm giá hàng loạt', 'error');
    loadProducts();
  }
}

// ===== Xóa hàng loạt: lọc bằng thẻ, tích chọn tất cả hoặc từng máy. Chỉ xóa sản phẩm, KHÔNG xóa ảnh trong kho. =====
const bulkDel = { facets: new Set(), selected: new Set(), query: '' };

function bdShown() {
  const ids = new Set(matchPricing(state.products, [...bulkDel.facets]));
  const q = bulkDel.query.trim().toLowerCase();
  return state.products.filter(p => ids.has(p.id) && (!q || `${p.name} ${p.id}`.toLowerCase().includes(q)));
}

function openBulkDeleteModal() {
  if (!canDeleteProducts(state.role)) {
    showToast('Nhân viên không có quyền xóa sản phẩm.', 'error');
    return;
  }
  bulkDel.facets.clear();
  bulkDel.selected = new Set(state.selectedIds);
  bulkDel.query = '';
  document.getElementById('bdSearch').value = '';
  document.getElementById('bulkDeleteModal').classList.remove('hidden');
  renderBulkDelete();
}

function closeBulkDeleteModal() {
  document.getElementById('bulkDeleteModal').classList.add('hidden');
}

function renderBulkDelete() {
  renderFacetBar('bdFacets', allFilterGroups(state.products), bulkDel.facets);
  const list = bdShown();
  // chỉ giữ lựa chọn của máy đang hiện để không xóa nhầm máy đã bị lọc ẩn
  const shownIds = new Set(list.map(p => p.id));
  bulkDel.selected = new Set([...bulkDel.selected].filter(id => shownIds.has(id)));
  document.getElementById('bdList').innerHTML = list.length === 0 ? '<p class="dialog-subtext">Không có sản phẩm nào.</p>' : list.map(p => `
    <label class="bd-row"><input type="checkbox" data-pid="${escapeHtml(p.id)}" ${bulkDel.selected.has(p.id) ? 'checked' : ''}>
      <span class="bd-name">${escapeHtml(p.name)}</span><span class="bd-price">${escapeHtml(formatCurrency(p.price))}</span></label>`).join('');
  updateBulkDeleteCount();
}

function updateBulkDeleteCount() {
  const shown = bdShown().length;
  const n = bulkDel.selected.size;
  const all = document.getElementById('bdAll');
  all.checked = shown > 0 && n === shown;
  all.indeterminate = n > 0 && n < shown;
  all.disabled = shown === 0;
  document.getElementById('bdAllLabel').textContent = `Chọn tất cả ${shown} sản phẩm đang hiện`;
  document.getElementById('bdCount').textContent = `Đã chọn ${n} / ${shown} đang hiện (tổng ${state.products.length} sản phẩm)`;
  const btn = document.getElementById('bdConfirm');
  btn.disabled = n === 0;
  btn.textContent = n ? `Xóa ${n} sản phẩm` : 'Xóa sản phẩm đã chọn';
}

async function confirmBulkDelete() {
  const ids = [...bulkDel.selected];
  if (ids.length === 0) return;
  if (!confirm(`Xóa vĩnh viễn ${ids.length} sản phẩm? Không thể hoàn tác. Ảnh trong kho vẫn được giữ lại.`)) return;
  const btn = document.getElementById('bdConfirm');
  btn.disabled = true;
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from('products').delete().in('id', ids.slice(i, i + 100));
      if (error) throw error;
    }
    state.products = state.products.filter(p => !bulkDel.selected.has(p.id));
    ids.forEach(id => state.selectedIds.delete(id));
    closeBulkDeleteModal();
    renderProducts();
    showToast(`Đã xóa ${ids.length} sản phẩm (ảnh trong kho được giữ lại)`, 'success');
  } catch (err) {
    console.error('[Admin] Lỗi xóa hàng loạt:', err);
    showToast('Lỗi khi xóa sản phẩm hàng loạt', 'error');
    loadProducts();
  }
}

// ==============================================================================
// SET GIÁ: tích hãng / khoảng giá, cộng thêm hàng loạt, sửa trực tiếp từng máy
// ==============================================================================
// edits: id -> giá bán mới (chưa lưu). picked: máy được tích ở bảng. facets: ô lọc đang tích.
const setPrice = { facets: new Set(), picked: new Set(), edits: new Map(), query: '', tab: 'pick', rules: [], mode: 'fixed' };
const SP_RULES_KEY = 'tm_set_price_rules';

const spEsc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const spNow = (p) => (setPrice.edits.has(p.id) ? setPrice.edits.get(p.id) : p.price);

function spShown() {
  const ids = new Set(matchPricing(state.products, [...setPrice.facets]));
  const q = setPrice.query.trim().toLowerCase();
  return state.products.filter(p => ids.has(p.id) && (!q || `${p.name} ${p.brandName}`.toLowerCase().includes(q)));
}

function spDirty() {
  return state.products.filter(p => setPrice.edits.has(p.id) && setPrice.edits.get(p.id) !== p.price);
}

// Thanh lọc dạng xổ xuống + thẻ có ✕ (dùng cho Set giá và Xóa hàng loạt).
function renderFacetBar(elId, groups, facets) {
  const label = new Map(groups.flatMap(g => g.options.map(o => [o.id, `${g.label}: ${o.label}`])));
  const selects = groups.map(g => {
    const left = g.options.filter(o => !facets.has(o.id));
    return `<select class="form-input sp-filter" data-addfacet aria-label="Lọc theo ${spEsc(g.label)}"><option value="">${spEsc(g.label)} ▾</option>${left.map(o => `<option value="${spEsc(o.id)}">${spEsc(o.label)} (${o.count})</option>`).join('')}</select>`;
  }).join('');
  const chips = [...facets].filter(id => label.has(id)).map(id => `<span class="sp-chip">${spEsc(label.get(id))}<button type="button" data-rmfacet="${spEsc(id)}" aria-label="Bỏ thẻ">✕</button></span>`).join('');
  document.getElementById(elId).innerHTML = `<div class="sp-filter-row">${selects}${chips ? '<button type="button" class="btn btn-ghost btn-sm" data-clearfacets>Xóa hết thẻ</button>' : ''}</div>${chips ? `<div class="sp-chips">${chips}</div>` : ''}`;
}

/** Gắn sự kiện thêm/bỏ thẻ cho thanh lọc; facets phải là Set cố định (dùng .clear(), không gán lại). */
function bindFacetBar(elId, facets, onChange) {
  const bar = document.getElementById(elId);
  bar.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-addfacet]');
    if (!sel || !sel.value) return;
    facets.add(sel.value);
    onChange();
  });
  bar.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rmfacet]');
    if (rm) facets.delete(rm.dataset.rmfacet);
    else if (e.target.closest('[data-clearfacets]')) facets.clear();
    else return;
    onChange();
  });
}

function renderSetPriceFacets() {
  renderFacetBar('spFacets', allFilterGroups(state.products), setPrice.facets);
}

function renderSetPriceList() {
  const rows = spShown();
  document.getElementById('spList').innerHTML = rows.length === 0 ? '<p class="dialog-subtext">Không có sản phẩm nào.</p>' : `
    <table class="sp-table"><thead><tr><th></th><th>Sản phẩm</th><th>Giá gốc</th><th>Cộng thêm</th><th>Giá bán</th></tr></thead><tbody>${rows.map(p => {
      const base = baseOf(p); const now = spNow(p); const dirty = setPrice.edits.has(p.id) && now !== p.price;
      return `<tr class="${dirty ? 'sp-changed' : ''}"><td><input type="checkbox" data-pick="${spEsc(p.id)}" ${setPrice.picked.has(p.id) ? 'checked' : ''} aria-label="Chọn"></td>
        <td>${spEsc(p.name)}<br><small>${spEsc(p.brandName)}${dirty ? ` · đang bán ${spEsc(formatCurrency(p.price))}` : ''}</small></td>
        <td>${spEsc(formatCurrency(base))}</td>
        <td><input class="form-input sp-cell" data-markup="${spEsc(p.id)}" inputmode="numeric" value="${formatThousands(now - base)}" aria-label="Cộng thêm"></td>
        <td><input class="form-input sp-cell" data-final="${spEsc(p.id)}" inputmode="numeric" value="${formatThousands(now)}" aria-label="Giá bán"></td></tr>`;
    }).join('')}</tbody></table>`;
  updateSetPriceBars();
}

function updateSetPriceBars() {
  const shownIds = new Set(spShown().map(p => p.id));
  const picked = [...setPrice.picked].filter(id => shownIds.has(id)).length;
  const dirty = spDirty().length;
  document.getElementById('spPickedCount').textContent = picked ? `Đã chọn ${picked} máy` : 'Chưa chọn máy';
  document.getElementById('spApplyPicked').disabled = picked === 0;
  document.getElementById('spResetPicked').disabled = picked === 0;
  renderSetPricePreview();
  document.getElementById('spCount').textContent = `Hiện ${spShown().length}/${state.products.length} sản phẩm · ${dirty} thay đổi chưa lưu.`;
  document.getElementById('spApply').disabled = dirty === 0;
}

const SP_PRESETS = { fixed: [500000, 1000000, 2000000, 3000000, 5000000, -500000, -1000000], percent: [1, 2, 3, 5, -1, -2] };

function renderSetPricePresets() {
  const fixed = setPrice.mode === 'fixed';
  document.getElementById('spPresets').innerHTML = SP_PRESETS[setPrice.mode].map(v =>
    `<button type="button" class="sp-preset${v < 0 ? ' neg' : ''}" data-preset="${v}">${v > 0 ? '+' : '−'}${fixed ? formatThousands(Math.abs(v)) : `${Math.abs(v)}%`}</button>`).join('');
  document.querySelectorAll('[data-spmode]').forEach(b => b.classList.toggle('active', b.dataset.spmode === setPrice.mode));
  renderSetPricePreview();
}

function renderSetPricePreview() {
  const el = document.getElementById('spPreview');
  const sample = state.products.find(p => setPrice.picked.has(p.id));
  if (!sample) { el.textContent = 'Tích máy trong bảng, chọn mức cộng thêm để xem trước.'; return; }
  const next = markupPrice(baseOf(sample), setPrice.mode, document.getElementById('spValue').value, Number(document.getElementById('spRound').value) || 0);
  el.innerHTML = next === null ? 'Nhập mức cộng thêm (số âm là giảm).'
    : `Ví dụ <strong>${spEsc(sample.name)}</strong>: ${spEsc(formatCurrency(baseOf(sample)))} → <strong>${spEsc(formatCurrency(next))}</strong> (${next - baseOf(sample) >= 0 ? '+' : '−'}${spEsc(formatCurrency(Math.abs(next - baseOf(sample))))})`;
}

function setPriceEdit(id, price) {
  const p = state.products.find(item => item.id === id);
  if (!p) return;
  if (price === p.price) setPrice.edits.delete(id); else setPrice.edits.set(id, price);
}

function renderSetPriceRules() {
  const brands = [...new Set(state.products.map(p => (p.brandName || p.brand || '').trim()).filter(Boolean))].sort();
  document.getElementById('spRules').innerHTML = setPrice.rules.map((r, i) => `
    <div class="sp-rule" data-i="${i}">
      <select data-f="brand" class="form-input" aria-label="Hãng"><option value="">Mọi hãng</option>${brands.map(b => `<option value="${spEsc(b)}"${String(r.brand || '').toLowerCase() === b.toLowerCase() ? ' selected' : ''}>${spEsc(b)}</option>`).join('')}</select>
      <input data-f="from" class="form-input" inputmode="numeric" placeholder="Giá gốc từ" value="${spEsc(r.from)}" aria-label="Giá gốc từ">
      <input data-f="to" class="form-input" inputmode="numeric" placeholder="đến" value="${spEsc(r.to)}" aria-label="Giá gốc đến">
      <input data-f="keyword" class="form-input" placeholder="Tên máy chứa..." value="${spEsc(r.keyword)}" aria-label="Tên máy chứa">
      <span class="sp-plus">+</span>
      <input data-f="value" class="form-input" inputmode="decimal" placeholder="Cộng thêm" value="${spEsc(r.value)}" aria-label="Cộng thêm">
      <select data-f="mode" class="form-input" aria-label="Kiểu"><option value="fixed"${r.mode !== 'percent' ? ' selected' : ''}>đ</option><option value="percent"${r.mode === 'percent' ? ' selected' : ''}>%</option></select>
      <button type="button" class="btn btn-ghost btn-sm" data-del="${i}" aria-label="Xóa quy tắc">✕</button>
    </div>`).join('') || '<p class="dialog-subtext">Chưa có quy tắc, bấm "+ Thêm quy tắc".</p>';
}

function saveSetPriceRules() {
  try { localStorage.setItem(SP_RULES_KEY, JSON.stringify(setPrice.rules)); } catch { /* bỏ qua */ }
}

function showSetPriceTab(tab) {
  setPrice.tab = tab;
  document.querySelectorAll('[data-sptab]').forEach(b => b.classList.toggle('active', b.dataset.sptab === tab));
  document.getElementById('spPanePick').classList.toggle('hidden', tab !== 'pick');
  document.getElementById('spPaneRules').classList.toggle('hidden', tab !== 'rules');
}

function runSetPriceRules() {
  const step = Number(document.getElementById('spRuleRound').value) || 0;
  const plan = planRules(state.products, setPrice.rules, step);
  if (!plan.length) { showToast('Chưa có quy tắc hợp lệ hoặc không máy nào khớp.', 'error'); return; }
  plan.forEach(r => setPriceEdit(r.id, r.newPrice));
  renderSetPriceList();
  showToast(`Đã tính giá cho ${plan.length} máy, kiểm tra bảng rồi bấm Lưu giá.`, 'success');
}

function openSetPriceModal() {
  try { const saved = JSON.parse(localStorage.getItem(SP_RULES_KEY) || '[]'); setPrice.rules = Array.isArray(saved) ? saved : []; } catch { setPrice.rules = []; }
  if (!setPrice.rules.length) setPrice.rules = [{ brand: '', from: '', to: '', keyword: '', mode: 'fixed', value: '' }];
  showSetPriceTab('pick');
  renderSetPriceRules();
  // Liên kết với trang ngoài: lấy máy đang tích, thẻ hãng/loại/trạng thái và ô tìm kiếm của danh sách
  setPrice.facets.clear(); setPrice.picked = new Set(state.selectedIds); setPrice.edits = new Map(); setPrice.query = state.searchQuery || '';
  const outer = { phone: 'kind:phone', accessory: 'kind:accessory', visible: 'state:visible', hidden: 'state:hidden', outofstock: 'state:outofstock' }[state.activeFilter];
  if (outer) setPrice.facets.add(outer);
  if (state.activeBrand !== 'all') {
    const found = state.products.find(p => (p.brand || '').toLowerCase() === state.activeBrand);
    if (found) setPrice.facets.add(`brand:${String(found.brandName || found.brand).toLowerCase()}`);
  }
  document.getElementById('spSearch').value = setPrice.query;
  document.getElementById('spValue').value = '';
  setPrice.mode = 'fixed';
  renderSetPricePresets();
  renderSetPriceFacets();
  renderSetPriceList();
  document.getElementById('setPriceModal').classList.remove('hidden');
}

function applySetPricePicked(reset) {
  const mode = setPrice.mode;
  const value = document.getElementById('spValue').value;
  const step = Number(document.getElementById('spRound').value) || 0;
  if (!reset && markupPrice(1, mode, value) === null) { showToast('Nhập mức cộng thêm hợp lệ (số, âm là giảm).', 'error'); return; }
  // chỉ áp cho máy đang hiện trong bảng, tránh đổi giá máy đã bị lọc ẩn
  for (const p of spShown()) {
    if (!setPrice.picked.has(p.id)) continue;
    setPriceEdit(p.id, reset ? baseOf(p) : markupPrice(baseOf(p), mode, value, step));
  }
  renderSetPriceList();
}

async function saveSetPrice() {
  const dirty = spDirty();
  if (!dirty.length) return;
  const btn = document.getElementById('spApply');
  btn.disabled = true;
  let ok = 0;
  for (const p of dirty) {
    const next = setPrice.edits.get(p.id);
    const patch = { base_price: baseOf(p), price: next, updated_at: new Date().toISOString() };
    // giá gạch ngang dời cùng mức đổi để mức giảm hiển thị không đổi
    if (p.oldPrice) patch.old_price = Math.max(0, p.oldPrice + next - p.price);
    const { error } = await supabase.from('products').update(patch).eq('id', p.id);
    if (error) console.error('[Admin] Lỗi set giá', p.id, error); else ok++;
  }
  showToast(ok === dirty.length ? `Đã lưu giá ${ok} sản phẩm` : `Lưu được ${ok}/${dirty.length}, xem lại console`, ok === dirty.length ? 'success' : 'error');
  document.getElementById('setPriceModal').classList.add('hidden');
  await loadProducts();
}

function bindSetPriceModal() {
  const close = () => document.getElementById('setPriceModal').classList.add('hidden');
  document.getElementById('setPriceBtn').addEventListener('click', openSetPriceModal);
  document.getElementById('spClose').addEventListener('click', close);
  document.getElementById('spCancel').addEventListener('click', () => {
    if (spDirty().length && !confirm('Có thay đổi giá chưa lưu. Đóng và bỏ?')) return;
    close();
  });
  document.getElementById('spApply').addEventListener('click', saveSetPrice);
  document.querySelectorAll('[data-sptab]').forEach(b => b.addEventListener('click', () => showSetPriceTab(b.dataset.sptab)));
  document.getElementById('spAddRule').addEventListener('click', () => {
    setPrice.rules.push({ brand: '', from: '', to: '', keyword: '', mode: 'fixed', value: '' });
    renderSetPriceRules(); saveSetPriceRules();
  });
  document.getElementById('spRunRules').addEventListener('click', runSetPriceRules);
  document.getElementById('spRules').addEventListener('input', (e) => {
    const row = e.target.closest('[data-i]'); const f = e.target.dataset.f;
    if (!row || !f) return;
    const rule = setPrice.rules[Number(row.dataset.i)];
    if (f === 'from' || f === 'to' || (f === 'value' && rule.mode !== 'percent')) e.target.value = formatThousands(e.target.value);
    rule[f] = e.target.value; saveSetPriceRules();
  });
  document.getElementById('spRules').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    setPrice.rules.splice(Number(del.dataset.del), 1); renderSetPriceRules(); saveSetPriceRules();
  });
  document.getElementById('spApplyPicked').addEventListener('click', () => applySetPricePicked(false));
  document.getElementById('spResetPicked').addEventListener('click', () => applySetPricePicked(true));
  bindFacetBar('spFacets', setPrice.facets, () => { renderSetPriceFacets(); renderSetPriceList(); });
  document.querySelectorAll('[data-spmode]').forEach(b => b.addEventListener('click', () => {
    setPrice.mode = b.dataset.spmode;
    document.getElementById('spValue').value = '';
    renderSetPricePresets();
  }));
  const valueInput = document.getElementById('spValue');
  valueInput.addEventListener('input', () => {
    if (setPrice.mode === 'fixed') valueInput.value = formatThousands(valueInput.value);
    renderSetPricePreview();
  });
  document.getElementById('spRound').addEventListener('change', renderSetPricePreview);
  document.getElementById('spPresets').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const v = Number(btn.dataset.preset);
    valueInput.value = setPrice.mode === 'fixed' ? formatThousands(v) : String(v);
    renderSetPricePreview();
  });
  const bump = (dir) => {
    const step = setPrice.mode === 'fixed' ? 500000 : 1;
    const cur = (setPrice.mode === 'fixed' ? parseAmount(valueInput.value) : Number(String(valueInput.value).replace(',', '.'))) || 0;
    const next = cur + dir * step;
    valueInput.value = setPrice.mode === 'fixed' ? formatThousands(next) : String(Math.round(next * 100) / 100);
    renderSetPricePreview();
  };
  document.getElementById('spMinus').addEventListener('click', () => bump(-1));
  document.getElementById('spPlus').addEventListener('click', () => bump(1));
  document.getElementById('spSearch').addEventListener('input', (e) => { setPrice.query = e.target.value; renderSetPriceList(); });
  document.getElementById('spPickShown').addEventListener('click', () => { spShown().forEach(p => setPrice.picked.add(p.id)); renderSetPriceList(); });
  document.getElementById('spPickNone').addEventListener('click', () => { setPrice.picked.clear(); renderSetPriceList(); });
  const list = document.getElementById('spList');
  list.addEventListener('input', (e) => { if (e.target.matches('.sp-cell')) e.target.value = formatThousands(e.target.value); });
  list.addEventListener('change', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      if (pick.checked) setPrice.picked.add(pick.dataset.pick); else setPrice.picked.delete(pick.dataset.pick);
      updateSetPriceBars();
      return;
    }
    // sửa trực tiếp: ô "Cộng thêm" hoặc ô "Giá bán"
    const mk = e.target.closest('[data-markup]');
    const fin = e.target.closest('[data-final]');
    const id = (mk || fin)?.dataset.markup || fin?.dataset.final;
    const p = state.products.find(item => item.id === id);
    const n = parseAmount(e.target.value);
    if (p && n !== null && Number.isFinite(n)) setPriceEdit(id, Math.max(0, mk ? baseOf(p) + n : n));
    else if (p) showToast('Nhập số hợp lệ.', 'error');
    renderSetPriceList();
  });
}

function bindBulkDeleteModal() {
  document.getElementById('closeBulkDeleteBtn').addEventListener('click', closeBulkDeleteModal);
  document.getElementById('bdCancel').addEventListener('click', closeBulkDeleteModal);
  document.getElementById('bdConfirm').addEventListener('click', confirmBulkDelete);
  document.getElementById('bdSearch').addEventListener('input', (e) => { bulkDel.query = e.target.value; renderBulkDelete(); });
  bindFacetBar('bdFacets', bulkDel.facets, renderBulkDelete);
  document.getElementById('bdAll').addEventListener('change', (e) => {
    bulkDel.selected = e.target.checked ? new Set(bdShown().map(p => p.id)) : new Set();
    renderBulkDelete();
  });
  document.getElementById('bdList').addEventListener('change', (e) => {
    const box = e.target.closest('[data-pid]');
    if (!box) return;
    if (box.checked) bulkDel.selected.add(box.dataset.pid); else bulkDel.selected.delete(box.dataset.pid);
    updateBulkDeleteCount();
  });
}

// ==============================================================================
// 7. DELETE SINGLE PRODUCT (WITH IMAGE CLEANUP)
// ==============================================================================
const sheetState = { mode: 'price', tab: 'all', items: [], date: '', info: '', error: '' };

function closeSheetPriceModal() {
  document.getElementById('sheetPriceModal').classList.add('hidden');
}

function renderSheetModal() {
  const body = document.getElementById('sheetPriceBody');
  const applyBtn = document.getElementById('applySheetPriceBtn');
  const isNew = sheetState.mode === 'new' || sheetState.mode === 'used';
  const isImages = sheetState.mode === 'images';
  document.getElementById('sheetPriceTitle').textContent = isImages ? 'Gắn ảnh minh họa cho sản phẩm chưa có ảnh' :  sheetState.mode === 'used' ? 'Thêm máy cũ (tab 2ND) từ Google Sheet' : (isNew ? 'Thêm sản phẩm mới từ Google Sheet' : 'Cập nhật giá từ Google Sheet');
  document.getElementById('sheetPriceIntro').innerHTML = isImages
    ? 'Ảnh sản phẩm chính thức của hãng, ghép theo <strong>tên mẫu máy</strong>. Chỉ gắn cho sản phẩm <strong>chưa có ảnh</strong>; máy cũ được thêm dòng "ảnh minh họa" vào mô tả. Bạn thay bằng ảnh máy thật sau ở trang sửa sản phẩm.'
    : sheetState.mode === 'used'
    ? 'Mỗi máy cũ là <strong>một sản phẩm riêng</strong> (Like New, tồn kho theo sheet). Máy đã có trên web hoặc đã hết hàng trong sheet được bỏ qua. Giá gốc trong sheet không được đọc.'
    : isNew
    ? 'Web rà sheet, <strong>bỏ qua máy đã có</strong> và chỉ thêm máy mới (hàng mới 100%). Ảnh, màu, thông số để trống, bạn bổ sung sau.'
    : 'Chỉ đổi giá <strong>điện thoại hàng mới đã có trên web</strong>. Hàng Like New, hàng cũ và phụ kiện giữ nguyên giá. Giá bán = "Giá Sau Sale", giá gạch ngang = "Giá Bán".';
  if (sheetState.error) { body.textContent = sheetState.error; applyBtn.disabled = true; return; }

  const brands = [...new Set(sheetState.items.map(i => i.brand))];
  const tabs = [['all', 'Tất cả', sheetState.items.length], ...brands.map(b => [b, b, sheetState.items.filter(i => i.brand === b).length])];
  const shown = sheetState.items.filter(i => sheetState.tab === 'all' || i.brand === sheetState.tab);
  const chips = `<div class="sheet-tabs" role="tablist">${tabs.map(([k, label, n]) =>
    `<button type="button" role="tab" class="sheet-tab ${sheetState.tab === k ? 'active' : ''}" data-tab="${escapeHtml(k)}">${escapeHtml(label)} <span>${n}</span></button>`).join('')}</div>`;
  const price = (n) => escapeHtml(formatCurrency(n));
  const rows = shown.length === 0 ? `<p>${isImages ? 'Không có sản phẩm nào cần gắn ảnh ở mục này.' : isNew ? 'Không có sản phẩm mới ở mục này.' : 'Không có giá nào cần đổi ở mục này.'}</p>` : `
    <table class="sheet-price-table"><thead><tr><th></th><th>Sản phẩm</th>${isImages ? '<th>Ảnh</th>' : `<th>${isNew ? 'Giá bán' : 'Giá cũ'}</th>${isNew ? '<th>Tồn</th>' : '<th>Giá mới</th>'}`}</tr></thead><tbody>
    ${shown.map(i => `<tr class="${i.warn ? 'sheet-price-warn' : ''}">
      <td><input type="checkbox" class="sheet-price-check" data-i="${sheetState.items.indexOf(i)}" ${i.checked ? 'checked' : ''} aria-label="Chọn ${escapeHtml(i.name)}"></td>
      <td>${escapeHtml(i.name)}${i.warn ? '<br><small>Lệch hơn 30%, hãy kiểm tra trước khi tick.</small>' : ''}</td>
      ${isImages
        ? `<td><img src="${escapeHtml(i.image)}" alt="" class="sheet-thumb" loading="lazy"></td>`
        : isNew
        ? `<td>${price(i.newPrice)}</td><td>${Number(i.stock) || 0}</td>`
        : `<td>${price(i.oldPrice)}</td><td><strong>${price(i.newPrice)}</strong>${i.newList ? `<br><small>gạch: ${price(i.newList)}</small>` : ''}</td>`}
    </tr>`).join('')}</tbody></table>`;
  const visibleOpt = isNew ? `<label class="sheet-opt"><input type="checkbox" id="sheetVisibleNow"> Hiện ngay trên web (mặc định ẩn cho tới khi có ảnh)</label>` : '';
  body.innerHTML = `${chips}${rows}${visibleOpt}<p class="dialog-subtext">${escapeHtml(sheetState.info)}</p>`;
  const checked = sheetState.items.filter(i => i.checked).length;
  applyBtn.disabled = checked === 0;
  applyBtn.textContent = isImages ? `Gắn ảnh (${checked})` : isNew ? `Thêm ${checked} sản phẩm` : `Áp dụng giá (${checked})`;
}

function openImageModal() {
  sheetState.mode = 'images';
  sheetState.tab = 'all';
  sheetState.error = '';
  document.getElementById('sheetPriceModal').classList.remove('hidden');
  const withoutImage = state.products.filter(p => !p.image);
  sheetState.items = withoutImage
    .map(p => ({ id: p.id, name: p.name, brand: p.brandName || p.brand || 'Khác', image: imageFor(p.name), description: p.description || '', used: p.condition === 'likenew', checked: true }))
    .filter(i => i.image);
  sheetState.info = `Sản phẩm chưa có ảnh: ${withoutImage.length} · Có ảnh minh họa trong kho: ${sheetState.items.length} · Còn lại giữ ảnh tạm.`;
  renderSheetModal();
}

async function openSheetModal(mode) {
  sheetState.mode = mode;
  sheetState.tab = 'all';
  sheetState.items = [];
  sheetState.error = '';
  document.getElementById('sheetPriceModal').classList.remove('hidden');
  document.getElementById('sheetPriceBody').textContent = 'Đang tải bảng giá...';
  document.getElementById('applySheetPriceBtn').disabled = true;
  try {
    const res = await fetch(mode === 'used' ? SHEET_USED_CSV_URL : SHEET_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const { rows, errors } = mode === 'used' ? parseUsedRows(text) : parseSheetRows(text);
    if (rows.length === 0) throw new Error(errors[0] || 'Sheet không có dữ liệu giá.');
    const now = new Date();
    const stamp = `Đọc từ tab ${mode === 'used' ? SHEET_USED_TAB : SHEET_TAB} lúc ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${now.toLocaleDateString('vi-VN')}${parseSheetDate(text) ? ` (sheet ghi cập nhật ${parseSheetDate(text)})` : ''}`;
    const extra = errors.length ? ` · Bỏ qua ${errors.length} dòng lỗi trong sheet.` : '';
    if (mode === 'used') {
      const plan = planUsedProducts(state.products, rows);
      sheetState.items = plan.items.map(i => ({ name: i.product.name, brand: i.brand, newPrice: i.product.price, stock: i.product.stock, product: i.product, checked: true }));
      sheetState.info = `${stamp} · Đã có trên web (bỏ qua): ${plan.duplicates}${plan.soldOut ? ` · Hết hàng trong sheet: ${plan.soldOut}` : ''}${extra}`;
    } else if (mode === 'new') {
      const plan = planNewProducts(state.products, rows);
      sheetState.items = plan.items.map(i => ({ name: i.product.name, brand: i.brand, newPrice: i.product.price, stock: i.product.stock, product: i.product, checked: true }));
      sheetState.info = `${stamp} · Đã có trên web (bỏ qua): ${plan.duplicates}${plan.hiddenInSheet ? ` · Sheet đặt "Không" hiển thị: ${plan.hiddenInSheet}` : ''}${plan.notPhone ? ` · Không phải điện thoại (bỏ qua): ${plan.notPhone}` : ''}${extra}`;
    } else {
      const plan = planPriceUpdates(state.products, rows);
      const brandOf = new Map(rows.map(r => [r.key, r.brand]));
      sheetState.items = plan.changes.map(c => ({ ...c, brand: brandOf.get(c.sheetKey) || '', warn: c.bigChange, checked: !c.bigChange }));
      const missing = plan.unmatched.length ? ` · Không có trong sheet (giữ giá): ${plan.unmatched.map(u => u.name).join(', ')}` : '';
      sheetState.info = `${stamp} · Không đổi: ${plan.same.length} · Bỏ qua (hàng cũ, phụ kiện): ${plan.skipped}${missing}${extra}`;
    }
  } catch (err) {
    console.error('[Admin] Lỗi đọc Google Sheet:', err);
    sheetState.error = 'Không đọc được Google Sheet. Kiểm tra sheet còn chia sẻ "bất kỳ ai có đường liên kết" và thử lại.';
  }
  renderSheetModal();
}

async function applySheetChanges() {
  const picked = sheetState.items.filter(i => i.checked);
  if (picked.length === 0) return showToast('Chưa chọn sản phẩm nào.', 'error');
  const applyBtn = document.getElementById('applySheetPriceBtn');
  applyBtn.disabled = true;
  let ok = 0;
  if (sheetState.mode === 'images') {
    for (const c of picked) {
      const description = c.used && !c.description.includes(USED_IMAGE_NOTE) ? [c.description, USED_IMAGE_NOTE].filter(Boolean).join(' • ') : c.description;
      const { error } = await supabase.from('products').update({ image_url: c.image, description, updated_at: new Date().toISOString() }).eq('id', c.id);
      if (error) console.error('[Admin] Lỗi gắn ảnh', c.id, error);
      else ok++;
    }
    showToast(ok === picked.length ? `Đã gắn ảnh cho ${ok} sản phẩm` : `Gắn được ${ok}/${picked.length}, xem lại console`, ok === picked.length ? 'success' : 'error');
  } else if (sheetState.mode !== 'price') {
    const visible = Boolean(document.getElementById('sheetVisibleNow')?.checked);
    for (let i = 0; i < picked.length; i += 25) {
      const batch = picked.slice(i, i + 25).map(p => ({ ...p.product, is_visible: visible }));
      const { error } = await supabase.from('products').insert(batch);
      if (error) console.error('[Admin] Lỗi thêm sản phẩm', error);
      else ok += batch.length;
    }
    showToast(ok === picked.length ? `Đã thêm ${ok} sản phẩm mới${visible ? '' : ' (đang ẩn, thêm ảnh rồi bật hiển thị)'}` : `Thêm được ${ok}/${picked.length}, xem lại console`, ok === picked.length ? 'success' : 'error');
  } else {
    for (const c of picked) {
      const { error } = await supabase.from('products')
        .update({ base_price: c.newPrice, price: c.newPrice + (c.markup || 0), old_price: c.newList && (c.newList + (c.markup || 0)), updated_at: new Date().toISOString() })
        .eq('id', c.id);
      if (error) console.error('[Admin] Lỗi cập nhật giá', c.id, error);
      else ok++;
    }
    showToast(ok === picked.length ? `Đã cập nhật giá ${ok} sản phẩm từ Sheet` : `Cập nhật được ${ok}/${picked.length}, xem lại console`, ok === picked.length ? 'success' : 'error');
  }
  closeSheetPriceModal();
  await loadProducts();
}

function bindSheetModal() {
  document.getElementById('sheetNewBtn').addEventListener('click', () => openSheetModal('new'));
  document.getElementById('sheetImageBtn').addEventListener('click', openImageModal);
  document.getElementById('sheetUsedBtn').addEventListener('click', () => openSheetModal('used'));
  document.getElementById('sheetPriceBtn').addEventListener('click', () => openSheetModal('price'));
  document.getElementById('closeSheetPriceBtn').addEventListener('click', closeSheetPriceModal);
  document.getElementById('cancelSheetPriceBtn').addEventListener('click', closeSheetPriceModal);
  document.getElementById('applySheetPriceBtn').addEventListener('click', applySheetChanges);
  document.getElementById('sheetPriceBody').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { sheetState.tab = tab.dataset.tab; renderSheetModal(); }
  });
  document.getElementById('sheetPriceBody').addEventListener('change', (e) => {
    const box = e.target.closest('.sheet-price-check');
    if (!box) return;
    sheetState.items[Number(box.dataset.i)].checked = box.checked;
    const checked = sheetState.items.filter(i => i.checked).length;
    const btn = document.getElementById('applySheetPriceBtn');
    btn.disabled = checked === 0;
    btn.textContent = sheetState.mode === 'images' ? `Gắn ảnh (${checked})` : sheetState.mode !== 'price' ? `Thêm ${checked} sản phẩm` : `Áp dụng giá (${checked})`;
  });
}

function openDeleteModal(prod) {
  if (!canDeleteProducts(state.role)) {
    showToast('Nhân viên không có quyền xóa sản phẩm.', 'error');
    return;
  }
  state.deleteTargetProduct = prod;
  document.getElementById('deleteProductName').innerText = `«${prod.name}»`;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
  state.deleteTargetProduct = null;
  document.getElementById('deleteModal').classList.add('hidden');
}

async function confirmDeleteProduct() {
  const prod = state.deleteTargetProduct;
  if (!prod) return;

  const btn = document.getElementById('confirmDeleteBtn');
  setBtnLoading(btn, true);

  try {
    // Ảnh giữ lại trong kho (product-images) để dùng lại khi đăng hàng; chỉ xóa dòng sản phẩm.
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', prod.id);

    if (error) throw error;

    state.products = state.products.filter(p => p.id !== prod.id);
    state.selectedIds.delete(prod.id);
    closeDeleteModal();
    renderProducts();
    showToast(`Đã xóa sản phẩm «${prod.name}»`, 'success');
  } catch (err) {
    console.error('[Admin] Lỗi xóa sản phẩm:', err);
    showToast(`Lỗi xóa sản phẩm: ${err.message || 'Thất bại'}`, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

// ==============================================================================
// 8. ADD & EDIT PRODUCT FORM
// ==============================================================================
function openAddModal() {
  state.currentEditingProduct = null;
  document.getElementById('formMode').value = 'add';
  document.getElementById('modalTitle').innerText = 'Thêm Sản Phẩm Mới';
  document.getElementById('productForm').reset();
  document.getElementById('prodId').readOnly = false;
  document.getElementById('modalAlert').classList.add('hidden');

  state.storagesList = ['128GB', '256GB', '512GB'];
  state.colorsList = [{ name: 'Titan Tự Nhiên', hex: '#8E8D8A' }];

  renderStoragesChips();
  renderColorsInputs();
  updateImagePreview('');

  document.getElementById('productModal').classList.remove('hidden');
  document.getElementById('prodName').focus();
}

function openEditModal(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  state.currentEditingProduct = prod;
  document.getElementById('formMode').value = 'edit';
  document.getElementById('modalTitle').innerText = 'Chỉnh Sửa Sản Phẩm';
  document.getElementById('modalAlert').classList.add('hidden');

  // Điền dữ liệu
  document.getElementById('prodName').value = prod.name || '';
  document.getElementById('prodId').value = prod.id || '';
  document.getElementById('prodId').readOnly = true; // Slug không được sửa khi edit
  document.getElementById('prodKind').value = prod.kind || 'phone';
  document.getElementById('prodCategory').value = prod.category || '';
  document.getElementById('prodBrand').value = (prod.brand || 'apple').toLowerCase();
  document.getElementById('prodBrandName').value = prod.brandName || '';
  document.getElementById('prodCondition').value = prod.condition === 'likenew' ? 'like_new' : (prod.condition || 'new');
  document.getElementById('prodConditionLabel').value = prod.conditionLabel || '';
  document.getElementById('prodBadge').value = prod.badge || '';
  document.getElementById('prodPrice').value = formatCurrency(prod.price).replace('đ', '');
  document.getElementById('prodOldPrice').value = prod.oldPrice ? formatCurrency(prod.oldPrice).replace('đ', '') : '';
  document.getElementById('prodStock').value = prod.stock !== undefined ? prod.stock : 0;
  document.getElementById('prodSortOrder').value = prod.sort_order || 0;
  document.getElementById('prodIsVisible').checked = prod.is_visible !== false;
  document.getElementById('prodImageUrl').value = prod.image || '';

  document.getElementById('prodChip').value = prod.chip || '';
  document.getElementById('prodCamera').value = prod.camera || '';
  document.getElementById('prodBattery').value = prod.battery || '';
  document.getElementById('prodScreen').value = prod.screen || '';
  document.getElementById('prodDescription').value = prod.description || '';

  state.storagesList = Array.isArray(prod.storages) ? [...prod.storages] : [];
  state.colorsList = Array.isArray(prod.colors) ? JSON.parse(JSON.stringify(prod.colors)) : [];

  renderStoragesChips();
  renderColorsInputs();
  updateImagePreview(prod.image || '');

  document.getElementById('productModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('productModal').classList.add('hidden');
  state.currentEditingProduct = null;
}

function renderStoragesChips() {
  const container = document.getElementById('storagesChipList');
  container.innerHTML = state.storagesList.map((tag, idx) => `
    <span class="storage-chip-tag">
      ${escapeHtml(tag)}
      <button type="button" class="chip-remove-btn" data-idx="${idx}" aria-label="Xóa ${escapeHtml(tag)}">✕</button>
    </span>
  `).join('');

  container.querySelectorAll('.chip-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      state.storagesList.splice(idx, 1);
      renderStoragesChips();
    });
  });
}

function renderColorsInputs() {
  const container = document.getElementById('colorsContainer');
  container.innerHTML = state.colorsList.map((color, idx) => `
    <div class="color-row-item" data-idx="${idx}">
      <input type="color" class="color-picker-input" value="${escapeHtml(color.hex || '#000000')}" data-idx="${idx}">
      <input type="text" class="form-input color-name-input" placeholder="Tên màu (ví dụ: Titan Đen)" value="${escapeHtml(color.name || '')}" data-idx="${idx}">
      <button type="button" class="btn btn-secondary btn-sm color-remove-btn" data-idx="${idx}" aria-label="Xóa màu">Xóa</button>
    </div>
  `).join('');

  container.querySelectorAll('.color-picker-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      if (state.colorsList[idx]) state.colorsList[idx].hex = e.target.value;
    });
  });

  container.querySelectorAll('.color-name-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      if (state.colorsList[idx]) state.colorsList[idx].name = e.target.value;
    });
  });

  container.querySelectorAll('.color-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      state.colorsList.splice(idx, 1);
      renderColorsInputs();
    });
  });
}

function updateImagePreview(url) {
  const img = document.getElementById('imagePreviewImg');
  const noImg = document.getElementById('noImageText');
  if (url && typeof url === 'string' && url.trim() !== '') {
    img.src = url;
    img.classList.remove('hidden');
    noImg.classList.add('hidden');
  } else {
    img.src = '';
    img.classList.add('hidden');
    noImg.classList.remove('hidden');
  }
}

// Xử lý nén ảnh client-side và tải lên Storage
async function handleImageUpload(file) {
  if (!file) return;

  const statusText = document.getElementById('uploadStatusText');
  statusText.innerText = 'Đang nén ảnh và tải lên...';

  try {
    // Nén ảnh sang kích thước tối đa 1200px, 80% quality
    const resizedBlob = await resizeImage(file, 1200, 0.8);

    const slug = slugify(document.getElementById('prodName').value) || 'product';
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const fileName = `${slug}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, resizedBlob, {
        contentType: resizedBlob.type || 'image/jpeg',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;
    document.getElementById('prodImageUrl').value = publicUrl;
    updateImagePreview(publicUrl);
    statusText.innerText = 'Tải ảnh thành công!';
    showToast('Tải ảnh và tối ưu hóa thành công', 'success');
  } catch (err) {
    console.error('[Admin] Lỗi upload ảnh:', err);
    statusText.innerText = 'Lỗi tải ảnh lên Storage.';
    showToast(`Không thể tải ảnh: ${err.message || 'Lỗi'}`, 'error');
  }
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const isEdit = document.getElementById('formMode').value === 'edit';
  const alert = document.getElementById('modalAlert');
  alert.classList.add('hidden');

  const rawFormData = {
    id: document.getElementById('prodId').value.trim(),
    name: document.getElementById('prodName').value.trim(),
    kind: document.getElementById('prodKind').value,
    category: document.getElementById('prodCategory').value.trim() || null,
    brand: document.getElementById('prodBrand').value,
    brand_name: document.getElementById('prodBrandName').value.trim(),
    condition: document.getElementById('prodCondition').value,
    condition_label: document.getElementById('prodConditionLabel').value.trim(),
    badge: document.getElementById('prodBadge').value.trim(),
    price: parseCurrency(document.getElementById('prodPrice').value),
    old_price: document.getElementById('prodOldPrice').value ? parseCurrency(document.getElementById('prodOldPrice').value) : null,
    stock: parseInt(document.getElementById('prodStock').value, 10) || 0,
    sort_order: parseInt(document.getElementById('prodSortOrder').value, 10) || 0,
    is_visible: document.getElementById('prodIsVisible').checked,
    image_url: document.getElementById('prodImageUrl').value.trim(),
    colors: state.colorsList.filter(c => c.name && c.name.trim() !== ''),
    storages: state.storagesList,
    chip: document.getElementById('prodChip').value.trim(),
    camera: document.getElementById('prodCamera').value.trim(),
    battery: document.getElementById('prodBattery').value.trim(),
    screen: document.getElementById('prodScreen').value.trim(),
    description: document.getElementById('prodDescription').value.trim()
  };

  // Tự động gán default_color
  if (rawFormData.colors.length > 0) {
    rawFormData.default_color = rawFormData.colors[0].name;
  }

  // Validate
  const validation = validateProduct(rawFormData, isEdit);
  if (!validation.valid) {
    alert.innerHTML = validation.errors.map(err => `<div>• ${escapeHtml(err)}</div>`).join('');
    alert.classList.remove('hidden');
    return;
  }

  const saveBtn = document.getElementById('saveProductBtn');
  setBtnLoading(saveBtn, true);

  try {
    const dbPayload = mapProductToDb(rawFormData);

    // Giá gốc: sản phẩm mới lấy theo giá nhập; sản phẩm cũ chưa có giá gốc thì giữ giá trước khi sửa (để Set giá còn tính đúng)
    const before = state.products.find(p => p.id === dbPayload.id);
    if (!isEdit) dbPayload.base_price = dbPayload.price;
    else if (before && !before.basePrice) dbPayload.base_price = before.price;

    if (isEdit) {
      dbPayload.updated_at = new Date().toISOString();
      const { error } = await supabase
        .from('products')
        .update(dbPayload)
        .eq('id', dbPayload.id);

      if (error) throw error;
      showToast(`Đã cập nhật sản phẩm "${rawFormData.name}"`, 'success');
    } else {
      // Kiểm tra trùng ID
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('id', dbPayload.id)
        .maybeSingle();

      if (existing) {
        throw new Error(`Mã sản phẩm "${dbPayload.id}" đã tồn tại. Vui lòng đổi mã khác.`);
      }

      const { error } = await supabase
        .from('products')
        .insert([dbPayload]);

      if (error) throw error;
      showToast(`Đã thêm sản phẩm "${rawFormData.name}"`, 'success');
    }

    closeModal();
    loadProducts();
  } catch (err) {
    console.error('[Admin] Lỗi lưu sản phẩm:', err);
    alert.innerHTML = `Lỗi: ${escapeHtml(err.message || 'Không thể lưu sản phẩm')}`;
    alert.classList.remove('hidden');
  } finally {
    setBtnLoading(saveBtn, false);
  }
}

// ==============================================================================
// 9. EVENT BINDINGS
// ==============================================================================
function bindGlobalEvents() {
  // Login Form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginEmail').value.trim();
    const email = usernameToEmail(username);
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    const alert = document.getElementById('loginAlert');

    alert.classList.add('hidden');

    if (!username || !password) {
      showLoginError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    if (!email) {
      showLoginError('Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch nối (3-30 ký tự).');
      return;
    }

    setBtnLoading(btn, true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      console.error('[Admin] Lỗi đăng nhập:', err);
      let msg = 'Đăng nhập không thành công. Vui lòng kiểm tra lại.';
      const text = String(err.message || '');
      if (text.includes('Invalid login credentials')) {
        msg = `Sai tên đăng nhập hoặc mật khẩu (đang đăng nhập bằng: ${email}). Nếu tài khoản dùng email khác, hãy gõ đầy đủ email.`;
      } else if (text.includes('Email not confirmed')) {
        msg = 'Tài khoản chưa được xác nhận trên Supabase (cần tick Auto Confirm khi tạo).';
      } else if (/banned|user_banned/i.test(text)) {
        msg = 'Tài khoản đã bị khóa trên Supabase.';
      } else if (/rate limit|too many/i.test(text) || err.status === 429) {
        msg = 'Đăng nhập sai quá nhiều lần, vui lòng đợi vài phút rồi thử lại.';
      } else if (/fetch|network|failed|timeout/i.test(text)) {
        msg = 'Không kết nối được máy chủ. Kiểm tra mạng hoặc tắt trình chặn quảng cáo cho trang này.';
      } else {
        msg = `Đăng nhập không thành công: ${text}`;
      }
      showLoginError(msg);
    } finally {
      setBtnLoading(btn, false);
    }
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (confirm('Bạn có muốn đăng xuất khỏi trang quản trị?')) {
      await supabase.auth.signOut();
      showToast('Đã đăng xuất', 'info');
    }
  });

  // Search input & clear button
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClearBtn');

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    searchClear.classList.toggle('hidden', state.searchQuery === '');
    renderProducts();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    searchClear.classList.add('hidden');
    renderProducts();
    searchInput.focus();
  });

  // Filter Chips
  document.querySelectorAll('.filter-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chips .chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');
      state.activeFilter = chip.dataset.filter;
      renderProducts();
    });
  });

  // Brand dropdown
  document.getElementById('brandFilter').addEventListener('change', (e) => {
    state.activeBrand = e.target.value;
    renderProducts();
  });

  // Sort dropdown
  document.getElementById('sortOrderSelect').addEventListener('change', (e) => {
    state.activeSort = e.target.value;
    renderProducts();
  });

  // Retry button
  document.getElementById('retryFetchBtn').addEventListener('click', () => {
    loadProducts();
  });

  // Add Product button
  document.getElementById('addProductBtn').addEventListener('click', () => {
    openAddModal();
  });
  document.getElementById('emptyAddBtn').addEventListener('click', () => {
    openAddModal();
  });

  // Auto-generate slug from name in Add modal
  document.getElementById('prodName').addEventListener('input', (e) => {
    if (document.getElementById('formMode').value === 'add') {
      const generated = slugify(e.target.value);
      document.getElementById('prodId').value = generated;
    }
  });

  // Format currency on blur in modal
  document.getElementById('prodPrice').addEventListener('blur', (e) => {
    const parsed = parseCurrency(e.target.value);
    e.target.value = parsed > 0 ? formatCurrency(parsed).replace('đ', '') : '';
  });
  document.getElementById('prodOldPrice').addEventListener('blur', (e) => {
    const parsed = parseCurrency(e.target.value);
    e.target.value = parsed > 0 ? formatCurrency(parsed).replace('đ', '') : '';
  });

  // Storages input (comma or enter adds tag)
  document.getElementById('prodStoragesInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = e.target.value.trim().replace(',', '');
      if (val && !state.storagesList.includes(val)) {
        state.storagesList.push(val);
        renderStoragesChips();
      }
      e.target.value = '';
    }
  });

  // Add color row button
  document.getElementById('addColorBtn').addEventListener('click', () => {
    state.colorsList.push({ name: '', hex: '#1D1D1F' });
    renderColorsInputs();
  });

  // Image input URL preview
  document.getElementById('prodImageUrl').addEventListener('input', (e) => {
    updateImagePreview(e.target.value.trim());
  });

  // Image File input (Camera or Gallery)
  document.getElementById('prodImageFileInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
  });

  // Product Form Submit
  document.getElementById('productForm').addEventListener('submit', handleProductFormSubmit);

  // Close modals
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);

  // Delete modal buttons
  bindSheetModal();
  bindSetPriceModal();
  document.getElementById('closeDeleteBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDeleteProduct);

  // Bulk actions
  document.getElementById('selectAllCheckbox').addEventListener('change', (e) => {
    const filtered = getFilteredProducts();
    if (e.target.checked) {
      filtered.forEach(p => state.selectedIds.add(p.id));
    } else {
      filtered.forEach(p => state.selectedIds.delete(p.id));
    }
    renderProducts();
  });

  document.getElementById('bulkModeBtn').addEventListener('click', () => openBulkDeleteModal());
  document.getElementById('bulkDeselectBtn').addEventListener('click', () => {
    state.selectedIds.clear();
    renderProducts();
  });

  document.getElementById('bulkShowBtn').addEventListener('click', () => {
    bulkSetVisibility(true);
  });

  document.getElementById('bulkHideBtn').addEventListener('click', () => {
    bulkSetVisibility(false);
  });

  document.getElementById('bulkDiscountBtn').addEventListener('click', () => {
    document.getElementById('discountItemCount').innerText = state.selectedIds.size;
    document.getElementById('bulkDiscountModal').classList.remove('hidden');
    document.getElementById('discountPercentInput').focus();
  });

  document.getElementById('closeBulkDiscountBtn').addEventListener('click', () => {
    document.getElementById('bulkDiscountModal').classList.add('hidden');
  });
  document.getElementById('cancelBulkDiscountBtn').addEventListener('click', () => {
    document.getElementById('bulkDiscountModal').classList.add('hidden');
  });

  document.getElementById('bulkDiscountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const percent = parseInt(document.getElementById('discountPercentInput').value, 10);
    if (isNaN(percent) || percent <= 0 || percent > 90) {
      showToast('Phần trăm giảm giá phải từ 1% đến 90%', 'error');
      return;
    }
    document.getElementById('bulkDiscountModal').classList.add('hidden');
    await executeBulkDiscount(percent);
  });

  document.getElementById('bulkDeleteBtn').addEventListener('click', () => openBulkDeleteModal());
  document.getElementById('bulkSetPriceBtn').addEventListener('click', openSetPriceModal);
  bindBulkDeleteModal();

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
      closeBulkDeleteModal();
      document.getElementById('bulkDiscountModal').classList.add('hidden');
    }
  });
}

function showLoginError(msg) {
  const alert = document.getElementById('loginAlert');
  alert.innerText = msg;
  alert.classList.remove('hidden');
}

function setBtnLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  const loader = btn.querySelector('.btn-loader');
  const text = btn.querySelector('.btn-text');
  if (loader) loader.classList.toggle('hidden', !isLoading);
  if (text) text.classList.toggle('hidden', isLoading);
}

// ==============================================================================
// 10. TOAST NOTIFICATIONS
// ==============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Start Admin App
init();
