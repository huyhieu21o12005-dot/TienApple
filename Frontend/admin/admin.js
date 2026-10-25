/**
 * Tien Mobile - Product Admin Application Controller
 * Handles Supabase Auth, CRUD, Quick Inline Price Edit, Stock Stepper,
 * Visibility Toggle, Bulk Operations, Image Upload with Client Resize, and Filters.
 */

import { SHEET_CSV_URL, parseSheetRows, parseSheetDate, planPriceUpdates, planNewProducts } from './sheetPricing.js';
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
      if (prod) {
        prod.price = newPrice;
      }
      renderProducts();

      try {
        const { error } = await supabase
          .from('products')
          .update({ price: newPrice, updated_at: new Date().toISOString() })
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
      prod.oldPrice = oldPrice;
      prod.price = newPrice;
      updates.push({ id, price: newPrice, old_price: oldPrice });
    }
  });

  renderProducts();

  try {
    // Cập nhật từng dòng trong database
    for (const u of updates) {
      await supabase
        .from('products')
        .update({ price: u.price, old_price: u.old_price, updated_at: new Date().toISOString() })
        .eq('id', u.id);
    }
    showToast(`Đã giảm ${percent}% cho ${updates.length} sản phẩm`, 'success');
  } catch (err) {
    console.error('[Admin] Lỗi giảm giá hàng loạt:', err);
    showToast('Lỗi áp dụng giảm giá hàng loạt', 'error');
    loadProducts();
  }
}

async function executeBulkDelete() {
  if (!canDeleteProducts(state.role)) {
    showToast('Nhân viên không có quyền xóa sản phẩm.', 'error');
    return;
  }
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;

  if (!confirm(`Bạn có chắc chắn muốn xóa ${ids.length} sản phẩm đã chọn? Thao tác này không thể hoàn tác.`)) {
    return;
  }

  try {
    // 1. Thu thập danh sách ảnh để dọn dẹp Storage
    const imagesToDelete = [];
    ids.forEach(id => {
      const prod = state.products.find(p => p.id === id);
      if (prod && prod.image && prod.image.includes('/product-images/')) {
        const parts = prod.image.split('/product-images/');
        if (parts[1]) imagesToDelete.push(decodeURIComponent(parts[1]));
      }
    });

    // 2. Xóa khỏi table
    const { error } = await supabase
      .from('products')
      .delete()
      .in('id', ids);

    if (error) throw error;

    // 3. Xóa ảnh khỏi Storage
    if (imagesToDelete.length > 0) {
      await supabase.storage.from('product-images').remove(imagesToDelete);
    }

    state.products = state.products.filter(p => !state.selectedIds.has(p.id));
    state.selectedIds.clear();
    renderProducts();
    showToast(`Đã xóa ${ids.length} sản phẩm thành công`, 'success');
  } catch (err) {
    console.error('[Admin] Lỗi xóa hàng loạt:', err);
    showToast('Lỗi khi xóa sản phẩm hàng loạt', 'error');
    loadProducts();
  }
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
  const isNew = sheetState.mode === 'new';
  document.getElementById('sheetPriceTitle').textContent = isNew ? 'Thêm sản phẩm mới từ Google Sheet' : 'Cập nhật giá từ Google Sheet';
  document.getElementById('sheetPriceIntro').innerHTML = isNew
    ? 'Web rà sheet, <strong>bỏ qua máy đã có</strong> và chỉ thêm máy mới (hàng mới 100%). Ảnh, màu, thông số để trống, bạn bổ sung sau.'
    : 'Chỉ đổi giá <strong>điện thoại hàng mới đã có trên web</strong>. Hàng Like New, hàng cũ và phụ kiện giữ nguyên giá. Giá bán = "Giá Sau Sale", giá gạch ngang = "Giá Bán".';
  if (sheetState.error) { body.textContent = sheetState.error; applyBtn.disabled = true; return; }

  const brands = [...new Set(sheetState.items.map(i => i.brand))];
  const tabs = [['all', 'Tất cả', sheetState.items.length], ...brands.map(b => [b, b, sheetState.items.filter(i => i.brand === b).length])];
  const shown = sheetState.items.filter(i => sheetState.tab === 'all' || i.brand === sheetState.tab);
  const chips = `<div class="sheet-tabs" role="tablist">${tabs.map(([k, label, n]) =>
    `<button type="button" role="tab" class="sheet-tab ${sheetState.tab === k ? 'active' : ''}" data-tab="${escapeHtml(k)}">${escapeHtml(label)} <span>${n}</span></button>`).join('')}</div>`;
  const price = (n) => escapeHtml(formatCurrency(n));
  const rows = shown.length === 0 ? `<p>${isNew ? 'Không có sản phẩm mới ở mục này.' : 'Không có giá nào cần đổi ở mục này.'}</p>` : `
    <table class="sheet-price-table"><thead><tr><th></th><th>Sản phẩm</th><th>${isNew ? 'Giá bán' : 'Giá cũ'}</th>${isNew ? '<th>Tồn</th>' : '<th>Giá mới</th>'}</tr></thead><tbody>
    ${shown.map(i => `<tr class="${i.warn ? 'sheet-price-warn' : ''}">
      <td><input type="checkbox" class="sheet-price-check" data-i="${sheetState.items.indexOf(i)}" ${i.checked ? 'checked' : ''} aria-label="Chọn ${escapeHtml(i.name)}"></td>
      <td>${escapeHtml(i.name)}${i.warn ? '<br><small>Lệch hơn 30%, hãy kiểm tra trước khi tick.</small>' : ''}</td>
      ${isNew
        ? `<td>${price(i.newPrice)}</td><td>${Number(i.stock) || 0}</td>`
        : `<td>${price(i.oldPrice)}</td><td><strong>${price(i.newPrice)}</strong>${i.newList ? `<br><small>gạch: ${price(i.newList)}</small>` : ''}</td>`}
    </tr>`).join('')}</tbody></table>`;
  const visibleOpt = isNew ? `<label class="sheet-opt"><input type="checkbox" id="sheetVisibleNow"> Hiện ngay trên web (mặc định ẩn cho tới khi có ảnh)</label>` : '';
  body.innerHTML = `${chips}${rows}${visibleOpt}<p class="dialog-subtext">${escapeHtml(sheetState.info)}</p>`;
  const checked = sheetState.items.filter(i => i.checked).length;
  applyBtn.disabled = checked === 0;
  applyBtn.textContent = isNew ? `Thêm ${checked} sản phẩm` : `Áp dụng giá (${checked})`;
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
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const { rows, errors } = parseSheetRows(text);
    if (rows.length === 0) throw new Error(errors[0] || 'Sheet không có dữ liệu giá.');
    const date = parseSheetDate(text);
    const extra = errors.length ? ` · Bỏ qua ${errors.length} dòng lỗi trong sheet.` : '';
    if (mode === 'new') {
      const plan = planNewProducts(state.products, rows);
      sheetState.items = plan.items.map(i => ({ name: i.product.name, brand: i.brand, newPrice: i.product.price, stock: i.product.stock, product: i.product, checked: true }));
      sheetState.info = `Bảng giá cập nhật ngày ${date || 'không rõ'} · Đã có trên web (bỏ qua): ${plan.duplicates}${extra}`;
    } else {
      const plan = planPriceUpdates(state.products, rows);
      const brandOf = new Map(rows.map(r => [r.key, r.brand]));
      sheetState.items = plan.changes.map(c => ({ ...c, brand: brandOf.get(c.sheetKey) || '', warn: c.bigChange, checked: !c.bigChange }));
      const missing = plan.unmatched.length ? ` · Không có trong sheet (giữ giá): ${plan.unmatched.map(u => u.name).join(', ')}` : '';
      sheetState.info = `Bảng giá cập nhật ngày ${date || 'không rõ'} · Không đổi: ${plan.same.length} · Bỏ qua (hàng cũ, phụ kiện): ${plan.skipped}${missing}${extra}`;
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
  if (sheetState.mode === 'new') {
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
        .update({ price: c.newPrice, old_price: c.newList, updated_at: new Date().toISOString() })
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
    btn.textContent = sheetState.mode === 'new' ? `Thêm ${checked} sản phẩm` : `Áp dụng giá (${checked})`;
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
    // 1. Dọn dẹp ảnh trong Storage nếu được lưu trong bucket product-images
    if (prod.image && prod.image.includes('/product-images/')) {
      const parts = prod.image.split('/product-images/');
      if (parts[1]) {
        const fileName = decodeURIComponent(parts[1]);
        await supabase.storage.from('product-images').remove([fileName]);
      }
    }

    // 2. Xóa row trong bảng products
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
      if (err.message.includes('Invalid login credentials')) {
        msg = 'Sai tên đăng nhập hoặc mật khẩu.';
      } else if (err.message.includes('Email not confirmed')) {
        msg = 'Tài khoản chưa được xác nhận trên Supabase (cần tick Auto Confirm khi tạo).';
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

  document.getElementById('bulkDeleteBtn').addEventListener('click', () => {
    executeBulkDelete();
  });

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
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
