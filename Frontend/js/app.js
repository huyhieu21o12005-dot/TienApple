/**
 * Tien Mobile - Main Application Controller
 * Connects UI with Store, CartManager, Filter, and Modals
 */

import { CartManager, ProductFilter, BookingValidator } from './store.js';
import { Phone3DStudio } from './hero3d.js';
import { WaterRipplesEngine } from './waterRipples.js';

// Dữ liệu dự phòng nhúng sẵn (phòng trường hợp người dùng mở trực tiếp file:// mà không qua HTTP server)
const FALLBACK_PRODUCTS = [
  {
    "id": "halora-ring",
    "name": "Nhẫn thông minh Halora Smart Ring Rose Gold",
    "brand": "halora",
    "brandName": "Halora Wellness",
    "condition": "new",
    "conditionLabel": "Mới 100%",
    "badge": "Siêu phẩm 2025",
    "price": 7490000,
    "oldPrice": 8990000,
    "rating": 5.0,
    "reviewCount": 98,
    "defaultColor": "Vàng Hồng Rose Gold",
    "colors": [
      { "name": "Vàng Hồng Rose Gold", "hex": "#B76E79" },
      { "name": "Titanium Đen", "hex": "#1E1E1E" },
      { "name": "Bạc Ánh Kim", "hex": "#E0E0E0" }
    ],
    "storages": ["Size 7 (54mm)", "Size 8 (57mm)", "Size 9 (60mm)", "Size 10 (63mm)"],
    "chip": "Bio-Sensors PPG Gen 3",
    "camera": "Không có",
    "battery": "Pin 7 ngày liên tục",
    "screen": "Titanium Chống nước 50M",
    "image": "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&auto=format&fit=crop&q=80",
    "description": "Vàng Hồng Rose Gold • Cảm biến nhịp tim, HRV, giấc ngủ 24/7 • Pin 7 ngày • Chống nước chuẩn 5ATM."
  },
  {
    "id": "ip16-pro",
    "name": "iPhone 16 Pro 256GB",
    "brand": "apple",
    "brandName": "Apple iPhone",
    "condition": "new",
    "conditionLabel": "Mới 100%",
    "badge": "0% LS",
    "price": 28990000,
    "oldPrice": 31990000,
    "rating": 5.0,
    "reviewCount": 64,
    "defaultColor": "Titan Tự Nhiên",
    "colors": [
      { "name": "Titan Tự Nhiên", "hex": "#8E8D8A" },
      { "name": "Titan Đen", "hex": "#2C2C2E" },
      { "name": "Titan Trắng", "hex": "#E5E5EA" },
      { "name": "Titan Sa Mạc", "hex": "#D4AF37" }
    ],
    "storages": ["128GB", "256GB", "512GB", "1TB"],
    "chip": "Apple A18 Pro 3nm",
    "camera": "48MP Fusion 5x Zoom",
    "battery": "3.582 mAh",
    "screen": "6.3 inch Super Retina XDR 120Hz",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBy9wAmLXHhHp6wVjvekkgPCkjyDVWoupN1GsZ3bKWwtTXYvGFOHLSa-d79qMzyDnCO71bCdIuL8pIzWkGHgyDm4V3nwi9EN90z4gpJ6anBcbKgp3XqpNsWxsjLqXWS1t9JdBox2ZDJJFnhvTIwpCTRJHXGyYAiV00zdr00ALHsavla23JPOCnFDL0pPkAZnxPTRDBv6IYHFF6sCI52tOI821qrFkDOm6gk8pl8CmQzIVxj4aHlTsTf",
    "description": "Titan Tự Nhiên • Chip A18 Pro • Camera 48MP • Bảo hành 12 tháng chính hãng."
  },
  {
    "id": "ip16-plus",
    "name": "iPhone 16 Plus 128GB",
    "brand": "apple",
    "brandName": "Apple iPhone",
    "condition": "new",
    "conditionLabel": "Mới 100%",
    "badge": "Pin 27h",
    "price": 24290000,
    "oldPrice": 25990000,
    "rating": 4.7,
    "reviewCount": 67,
    "defaultColor": "Xanh Lưu Ly",
    "colors": [
      { "name": "Xanh Lưu Ly", "hex": "#43658B" },
      { "name": "Hồng", "hex": "#E8A7A1" },
      { "name": "Trắng", "hex": "#F0F0F0" },
      { "name": "Đen", "hex": "#2B2B2C" }
    ],
    "storages": ["128GB", "256GB", "512GB"],
    "chip": "Apple A18 Bionic",
    "camera": "48MP Fusion 2x",
    "battery": "4.674 mAh",
    "screen": "6.7 inch Super Retina XDR",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuD4_UmvVqXfu20h2LpiFFJAKmnkKplb4m8CmwRwUO01bXt7q57z603gW5K0PQ7MPLN8PjA7jFsk2QEZVgY0We_GXlJvF5H9_7f42fJr7cDj6O9F1ZHNaVP_pTl_pr6TmMkSQglzrPZX6U4kFEYdgORtHG39-S5t2fH_f0XGsanxYuVL3u-IRm4kbSug6iCp1WhL3AQkn1VIllJ8s5zXhoj82EAqz6_1zHv26dhxF4teOCfbPsr_UnDI",
    "description": "Xanh Lưu Ly • Màn hình 6.7 inch Super Retina • Pin dùng liên tục 27 giờ."
  },
  {
    "id": "ip15-pink",
    "name": "iPhone 15 128GB",
    "brand": "apple",
    "brandName": "Apple iPhone",
    "condition": "new",
    "conditionLabel": "Mới 100%",
    "badge": "Hot deal",
    "price": 18990000,
    "oldPrice": 21490000,
    "rating": 4.9,
    "reviewCount": 182,
    "defaultColor": "Hồng Pastel",
    "colors": [
      { "name": "Hồng Pastel", "hex": "#E3A5A9" },
      { "name": "Xanh Lá", "hex": "#CDE0C9" },
      { "name": "Vàng", "hex": "#F0E4B2" },
      { "name": "Đen", "hex": "#2D2D2E" }
    ],
    "storages": ["128GB", "256GB", "512GB"],
    "chip": "Apple A16 Bionic",
    "camera": "48MP Chính • 12MP Siêu rộng",
    "battery": "3.349 mAh",
    "screen": "6.1 inch Super Retina XDR",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBCAwsq3u_1RdaoEn2EdYMLlzHknePN29UbIFTNZDstieRtU9SaUsAeEijYsT1_eWhEXWyZtFG9oPqHZOPiDAu0GvOFLabKEG91qtnNj51OEYZcaw-AC-4pHFvMacE3-NPxWgro5nBYVoPYJGOTspiCLLqnNIGoztjfNO67XgL0V5yOwnYqA5hr_M6AF_YtTi3-Vk8Fwtt9TBbGBAqTcJ8hOYtvv8pZU3dHZjQAuebbJDKjcx_jMbmR",
    "description": "Hồng Pastel • Dynamic Island • Cổng USB-C • Mặt lưng kính pha màu sang trọng."
  },
  {
    "id": "ip14-likenew",
    "name": "iPhone 14 128GB Quốc Tế",
    "brand": "apple",
    "brandName": "Apple iPhone",
    "condition": "likenew",
    "conditionLabel": "Like New 99%",
    "badge": "Bảo hành 12T",
    "price": 13890000,
    "oldPrice": 16500000,
    "rating": 4.8,
    "reviewCount": 210,
    "defaultColor": "Đen Midnight",
    "colors": [
      { "name": "Đen Midnight", "hex": "#1E2024" },
      { "name": "Trắng Ánh Sao", "hex": "#F4F3ED" },
      { "name": "Tím Khói", "hex": "#D8CFD8" }
    ],
    "storages": ["128GB", "256GB"],
    "chip": "Apple A15 Bionic (5 GPU)",
    "camera": "12MP Kép Photonic Engine",
    "battery": "3.279 mAh",
    "screen": "6.1 inch OLED Super Retina",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuB5BizSsfy_wwWlaWbNtI9UsuD3F-rHxRmYAHsy5eXPjW3lVrrngxYvHy1N6Iiilmy8ksG8wkVIH1VVnqq0tq_YrY0xWj4THYqfan9G9lo4UILPeGfdwN_503NNqfVEVyX7k8iTDm9rB74qwFG4WXxJ5dnLoeLqJTB_xxTqLXfn_US97VQO64PyeqDoY6_xKZDFUqr-RxK_oqtwz77RcldseyTJc06HnlW8nl_LZhYtx-ZulIclRBcL",
    "description": "Đen Midnight • Đẹp 99.9% Không tì vết • Pin 95-100% nguyên bản."
  },
  {
    "id": "samsung-s24-ultra",
    "name": "Samsung Galaxy S24 Ultra 256GB",
    "brand": "samsung",
    "brandName": "Samsung Galaxy",
    "condition": "new",
    "conditionLabel": "Mới 100%",
    "badge": "Galaxy AI",
    "price": 27490000,
    "oldPrice": 33990000,
    "rating": 4.9,
    "reviewCount": 115,
    "defaultColor": "Xám Titan",
    "colors": [
      { "name": "Xám Titan", "hex": "#6C6B67" },
      { "name": "Đen Titan", "hex": "#272727" },
      { "name": "Tím Titan", "hex": "#504E5F" }
    ],
    "storages": ["256GB", "512GB", "1TB"],
    "chip": "Snapdragon 8 Gen 3 for Galaxy",
    "camera": "200MP Quad Zoom AI",
    "battery": "5.000 mAh",
    "screen": "6.8 inch QHD+ 120Hz 2600 nits",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBSXkzKQ-Ofrs0Gy-d0iMlkf-YSiS0Tcs3nNJ_UNQsJhodHmrTb6Ib1P-xE5ml5FS66LFNWm45ShgtGT1r7ZAiw3ZhiU9gbicpch1A17yW6aqHW51Uj7TR6AjR87BdR4leTNqPHwYATqufVK2ZShPiUtG2Ks7XnPeOM_zAK0Gxqps6ODheudpGVcoq7qi6BEP9Vm5Vv_eJec3Xf9zcnckpy9MJXXGCZZ5cxcLLLI33CMSJTtXTt3q12",
    "description": "Khung viền Titan • Bút S-Pen tích hợp • Galaxy AI dịch thuật trực tiếp."
  },
  {
    "id": "xiaomi-14",
    "name": "Xiaomi 14 5G 256GB",
    "brand": "xiaomi",
    "brandName": "Xiaomi",
    "condition": "new",
    "conditionLabel": "Mới 100%",
    "badge": "Leica Optics",
    "price": 18490000,
    "oldPrice": 22990000,
    "rating": 4.9,
    "reviewCount": 85,
    "defaultColor": "Xanh Ngọc",
    "colors": [
      { "name": "Xanh Ngọc", "hex": "#4D766C" },
      { "name": "Đen", "hex": "#1F1F1F" },
      { "name": "Trắng", "hex": "#EBEBEB" }
    ],
    "storages": ["256GB", "512GB"],
    "chip": "Snapdragon 8 Gen 3",
    "camera": "50MP Leica Summilux",
    "battery": "4.610 mAh (Sạc 90W)",
    "screen": "6.36 inch OLED 1.5K 120Hz",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBSXkzKQ-Ofrs0Gy-d0iMlkf-YSiS0Tcs3nNJ_UNQsJhodHmrTb6Ib1P-xE5ml5FS66LFNWm45ShgtGT1r7ZAiw3ZhiU9gbicpch1A17yW6aqHW51Uj7TR6AjR87BdR4leTNqPHwYATqufVK2ZShPiUtG2Ks7XnPeOM_zAK0Gxqps6ODheudpGVcoq7qi6BEP9Vm5Vv_eJec3Xf9zcnckpy9MJXXGCZZ5cxcLLLI33CMSJTtXTt3q12",
    "description": "Ống kính Leica Summilux cao cấp • Thiết kế viền mỏng đỉnh cao • Sạc nhanh 90W."
  },
  {
    "id": "oppo-find-x7",
    "name": "OPPO Find X7 256GB",
    "brand": "oppo",
    "brandName": "OPPO",
    "condition": "new",
    "conditionLabel": "Mới 100%",
    "badge": "Hasselblad",
    "price": 17290000,
    "oldPrice": 19990000,
    "rating": 4.7,
    "reviewCount": 43,
    "defaultColor": "Nâu Da Vàng",
    "colors": [
      { "name": "Nâu Da Vàng", "hex": "#C29A6C" },
      { "name": "Đen Nhám", "hex": "#252525" }
    ],
    "storages": ["256GB", "512GB"],
    "chip": "MediaTek Dimensity 9300",
    "camera": "50MP 3 Camera Hasselblad",
    "battery": "5.000 mAh (Sạc 100W)",
    "screen": "6.78 inch AMOLED 120Hz",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuA7_r211gjM4nCQntMUSxGB4tEzVV2C-hf-G1d17FqFoXLt4gFL70RMOQgZw_EzXn4HJousRWcMELWiEPK-pskAHrF4mShnIQGRfnSxnx0rBqTC5SmKWRUShxX_XXK-Em8rAhp6JC0TmCHimTCHUor39uqEWjXwXZhmAHATYc2kgFqXUhr2xOTzn1wQ1DC0kEv884OP8JALL2rmhlpKJayVV4uhN4ecTeqFNbsx_Ve-145nGX9dEs7Z",
    "description": "Nâu Da Vàng • Dimensity 9300 • Camera Hasselblad • Mặt lưng da thuần chay cao cấp."
  },
  {
    "id": "charger-30w",
    "name": "Củ sạc nhanh 30W USB-C chính hãng",
    "brand": "apple",
    "brandName": "Apple iPhone",
    "condition": "new",
    "conditionLabel": "Phụ kiện Zin",
    "badge": "Chính hãng",
    "price": 650000,
    "oldPrice": 850000,
    "rating": 5.0,
    "reviewCount": 320,
    "defaultColor": "Trắng",
    "colors": [{ "name": "Trắng", "hex": "#FFFFFF" }],
    "storages": ["Chuẩn 30W"],
    "chip": "Power Delivery 3.0",
    "camera": "Không có",
    "battery": "Công suất 30W",
    "screen": "Chuẩn Type-C",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBjJ20plbKYzKLiFb8cWsaqo6RrIyPTlD47tS2kbPjqVCJmkKcPMgLPkrqvCTEkJ9XWbJ06yojIDSdzbr2fPudTpPIhVSRy8MBz2Oh-kZ3yVrayY67Dj5mVkGvxE0_4QsBOUhkUM0DMjfpem7LTC7lDv3NuRaTRnV73uyzlQsMaeNQAIluD8DD0W45LK72TwESHO5bIgz_a84tnVku__BphNq8G0CN4gl3YX5I_DTAgNy1pM77VWG4u",
    "description": "Củ sạc nhanh Apple 30W USB-C chính hãng • Sạc 50% pin chỉ trong 30 phút • Bảo hành 12 tháng 1 đổi 1."
  }
];

class App {
  constructor() {
    this.products = [...FALLBACK_PRODUCTS];
    this.cart = new CartManager();
    this.activeCategory = 'all';
    this.activeCondition = 'all';
    this.activePrice = 'all';
    this.activeSort = 'newest';
    this.searchQuery = '';
    
    // Quick View state
    this.selectedProduct = null;
    this.selectedColor = null;
    this.selectedStorage = null;

    this.init();
  }

  async init() {
    // Thử fetch dữ liệu ngoài nếu có HTTP server
    try {
      let res = await fetch('data/products.json');
      if (!res.ok) {
        res = await fetch('../Data/products.json');
      }
      if (res.ok) {
        this.products = await res.json();
      }
    } catch (e) {
      console.log('Using bundled fallback products data.');
    }

    // Load giỏ hàng từ localStorage nếu có
    this.cart.loadFromLocalStorage();

    // Khởi tạo các item mặc định ban đầu nếu giỏ hàng trống (giống bản thiết kế gốc có 2 items)
    if (this.cart.getItemCount() === 0) {
      this.cart.addItem(this.products[0], 1, 'Titan Tự Nhiên', '256GB');
      this.cart.addItem(this.products[7], 1, 'Trắng', 'Chuẩn 30W');
    }

    this.renderProducts();
    this.updateCartBadge();
    this.bindEvents();
    this.initHero3DInteraction();
    this.initHeroMotion();
    this.initLayerNavigation();
  }

  bindEvents() {
    // 1. Brand Filter Buttons
    const brandButtons = document.querySelectorAll('.brand-btn');
    brandButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        brandButtons.forEach(b => {
          b.classList.remove('bg-[#1D1D1F]', 'text-white');
          b.classList.add('bg-[#F5F5F7]', 'text-[#1D1D1F]');
        });
        btn.classList.remove('bg-[#F5F5F7]', 'text-[#1D1D1F]');
        btn.classList.add('bg-[#1D1D1F]', 'text-white');

        this.activeCategory = btn.getAttribute('data-brand') || 'all';
        this.renderProducts();
      });
    });

    // 2. Dropdown Filters
    const conditionFilter = document.getElementById('filter-condition');
    if (conditionFilter) {
      conditionFilter.addEventListener('change', (e) => {
        this.activeCondition = e.target.value;
        this.renderProducts();
      });
    }

    const priceFilter = document.getElementById('filter-price');
    if (priceFilter) {
      priceFilter.addEventListener('change', (e) => {
        this.activePrice = e.target.value;
        this.renderProducts();
      });
    }

    const sortFilter = document.getElementById('filter-sort');
    if (sortFilter) {
      sortFilter.addEventListener('change', (e) => {
        this.activeSort = e.target.value;
        this.renderProducts();
      });
    }

    // 3. Search Bar
    const searchInput = document.getElementById('product-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderProducts();
      });
    }

    // 4. Cart Triggers
    const cartTriggers = document.querySelectorAll('.cart-open-trigger');
    cartTriggers.forEach(btn => {
      btn.addEventListener('click', () => this.openCartDrawer());
    });

    const closeCartBtn = document.getElementById('close-drawer-btn');
    if (closeCartBtn) {
      closeCartBtn.addEventListener('click', () => this.closeCartDrawer());
    }

    const cartBackdrop = document.getElementById('drawer-backdrop');
    if (cartBackdrop) {
      cartBackdrop.addEventListener('click', () => this.closeCartDrawer());
    }

    // 5. Checkout Submit
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', (e) => this.handleCheckout(e));
    }

    // 6. Voucher Apply
    const voucherBtn = document.getElementById('apply-voucher-btn');
    if (voucherBtn) {
      voucherBtn.addEventListener('click', () => {
        const input = document.getElementById('voucher-input');
        const code = input ? input.value : '';
        const result = this.cart.applyVoucher(code);
        this.showToast(result.message);
        this.renderCartDrawer();
      });
    }

    // 7. Repair Booking Modals & Form
    const bookingTriggers = document.querySelectorAll('.booking-trigger');
    bookingTriggers.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const context = btn.getAttribute('data-service-context') || 'Tư vấn sửa chữa trực tiếp';
        this.openBookingModal(context);
      });
    });

    const closeRepairModalBtn = document.getElementById('close-repair-modal-btn');
    if (closeRepairModalBtn) {
      closeRepairModalBtn.addEventListener('click', () => this.closeBookingModal());
    }

    const repairModalOverlay = document.getElementById('repairModal');
    if (repairModalOverlay) {
      repairModalOverlay.addEventListener('click', (e) => {
        if (e.target === repairModalOverlay) this.closeBookingModal();
      });
    }

    const repairForm = document.getElementById('repair-modal-form');
    if (repairForm) {
      repairForm.addEventListener('submit', (e) => this.handleRepairSubmit(e));
    }

    const quickRepairBarForm = document.getElementById('quick-repair-bar-form');
    if (quickRepairBarForm) {
      quickRepairBarForm.addEventListener('submit', (e) => this.handleQuickRepairBarSubmit(e));
    }

    // 8. Quick View Modal Listeners
    const closeQuickViewBtn = document.getElementById('close-quickview-btn');
    if (closeQuickViewBtn) {
      closeQuickViewBtn.addEventListener('click', () => this.closeProductModal());
    }

    const quickViewOverlay = document.getElementById('quickViewModal');
    if (quickViewOverlay) {
      quickViewOverlay.addEventListener('click', (e) => {
        if (e.target === quickViewOverlay) this.closeProductModal();
      });
    }

    // Modal Add To Cart
    const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');
    if (modalAddToCartBtn) {
      modalAddToCartBtn.addEventListener('click', () => {
        if (this.selectedProduct) {
          this.cart.addItem(this.selectedProduct, 1, this.selectedColor, this.selectedStorage);
          this.updateCartBadge();
          this.showToast(`Đã thêm "${this.selectedProduct.name}" vào giỏ hàng!`);
          this.closeProductModal();
          this.openCartDrawer();
        }
      });
    }

    // 9. Chat Widget Toggle
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    if (chatToggleBtn) {
      chatToggleBtn.addEventListener('click', () => this.toggleChat());
    }

    const closeChatBtn = document.getElementById('close-chat-btn');
    if (closeChatBtn) {
      closeChatBtn.addEventListener('click', () => this.toggleChat());
    }

    // Chat Quick Actions
    const chatQuickBtns = document.querySelectorAll('.chat-quick-btn');
    chatQuickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.getAttribute('data-chat-query');
        this.openBookingModal(query);
      });
    });

    const chatSendBtn = document.getElementById('chat-send-btn');
    if (chatSendBtn) {
      chatSendBtn.addEventListener('click', () => {
        const input = document.getElementById('chat-input');
        if (input && input.value.trim()) {
          this.showToast('Tien Mobile đã nhận tin nhắn. Kỹ thuật viên sẽ hỗ trợ bạn sau vài giây!');
          input.value = '';
        }
      });
    }

    // 10. Global Escape Key Listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeProductModal();
        this.closeBookingModal();
        this.closeCartDrawer();
        const chat = document.getElementById('chatPopover');
        if (chat && !chat.classList.contains('hidden')) {
          chat.classList.add('hidden');
        }
      }
    });
  }

  // Single-Layer Navigation Architecture (Chuyển đổi từng layer độc lập)
  initLayerNavigation() {
    // 1. Listen to layer links (Header links, CTA buttons, Layer Switcher tabs)
    const layerTriggers = document.querySelectorAll('[data-layer], .nav-layer-link');
    layerTriggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        const layerId = trigger.getAttribute('data-layer');
        if (!layerId) return;
        e.preventDefault();
        const filter = trigger.getAttribute('data-filter');
        this.switchLayer(layerId, filter);
      });
    });

    // 2. Hash Change Support (direct URLs like #dienthoai, #suachua, #camket)
    window.addEventListener('hashchange', () => {
      this.handleHashChange();
    });

    // Handle initial hash on page load if present
    if (window.location.hash) {
      this.handleHashChange();
    }
  }

  handleHashChange() {
    const hash = window.location.hash.replace('#', '');
    const hashMap = {
      'trangchu': 'layer-trangchu',
      'dienthoai': 'layer-dienthoai',
      'suachua': 'layer-suachua',
      'camket': 'layer-camket',
      'lienhe': 'layer-camket'
    };
    if (hashMap[hash]) {
      this.switchLayer(hashMap[hash]);
    }
  }

  switchLayer(layerId, filter = null) {
    const targetLayer = document.getElementById(layerId);
    if (!targetLayer) return;

    // 1. Transition Layers
    const allLayers = document.querySelectorAll('.app-layer');
    allLayers.forEach(layer => {
      layer.classList.remove('active');
      layer.classList.add('hidden');
    });

    targetLayer.classList.remove('hidden');
    void targetLayer.offsetWidth; // Force reflow
    targetLayer.classList.add('active');

    // 2. Update Header Navigation Links Active State (Chữ đen khi chọn kèm thanh ngang gạch dưới, chữ xám khi không chọn)
    const navLinks = document.querySelectorAll('.nav-layer-link');
    navLinks.forEach(link => {
      const linkLayer = link.getAttribute('data-layer');
      const bar = link.querySelector('.nav-active-bar');
      if (linkLayer === layerId) {
        link.classList.remove('text-[#6E6E73]', 'font-normal', 'text-[#0071E3]');
        link.classList.add('text-[#1D1D1F]', 'font-semibold', 'active');
        if (bar) bar.classList.remove('hidden');
      } else {
        link.classList.remove('text-[#1D1D1F]', 'font-semibold', 'active', 'text-[#0071E3]');
        link.classList.add('text-[#6E6E73]', 'font-normal');
        if (bar) bar.classList.add('hidden');
      }
    });

    // 4. If filter is specified (e.g., accessories)
    if (filter && layerId === 'layer-dienthoai') {
      const filterBtn = document.querySelector(`.brand-btn[data-brand="${filter}"]`);
      if (filterBtn) {
        filterBtn.click();
      }
    }

    // 5. Smooth scroll to top of viewport
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 6. Update URL Hash without jump
    const reverseHashMap = {
      'layer-trangchu': 'trangchu',
      'layer-dienthoai': 'dienthoai',
      'layer-suachua': 'suachua',
      'layer-camket': 'camket'
    };
    if (reverseHashMap[layerId] && history.pushState) {
      history.pushState(null, null, `#${reverseHashMap[layerId]}`);
    }
  }

  // 3D Studio Interaction: 18 Pro Max Three.js Engine & Chromatic Aura Flow
  initHero3DInteraction() {
    // 1. Khởi tạo 3D Three.js Studio cho 18 Pro Max
    try {
      this.phone3DStudio = new Phone3DStudio('phone3DCanvas', 'phone3DCanvasWrap');
    } catch (err) {
      console.warn('Error initializing Phone3DStudio:', err);
    }

    // 1.5. Khởi tạo hiệu ứng gợn nước mặt gương tĩnh lặng ở 1/3 góc dưới màn hình
    try {
      this.waterRipplesEngine = new WaterRipplesEngine('waterRipplesCanvas', 'waterRipplesStage');
    } catch (err) {
      console.warn('Error initializing WaterRipplesEngine:', err);
    }

    // 2. Chuyển động Parallax chiều sâu cho Logo Apple Watermark nền
    const heroSection = document.getElementById('heroSection');
    const appleWatermark = document.getElementById('appleBgWatermark');
    const canvasWrap = document.getElementById('phone3DCanvasWrap');

    if (!heroSection) return;

    let ticking = false;

    heroSection.addEventListener('mousemove', (e) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = heroSection.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
        const normY = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5

        if (appleWatermark) {
          appleWatermark.style.transform = `translate(calc(-50% + ${(normX * 18).toFixed(1)}px), calc(-50% + ${(normY * 14).toFixed(1)}px))`;
        }

        if (canvasWrap) {
          canvasWrap.style.transform = `perspective(1000px) rotateX(${(-normY * 6).toFixed(2)}deg) rotateY(${(normX * 8).toFixed(2)}deg)`;
        }

        ticking = false;
      });
    });

    heroSection.addEventListener('mouseleave', () => {
      if (appleWatermark) {
        appleWatermark.style.transform = 'translate(-50%, -50%)';
      }
      if (canvasWrap) {
        canvasWrap.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
      }
    });

    if (canvasWrap) {
      canvasWrap.addEventListener('pointerdown', () => {
        this.waterRipplesEngine?.triggerInteractionRipple(1.35);
      });
    }

    heroSection.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, a, input, select, textarea')) return;
      this.waterRipplesEngine?.triggerInteractionRipple(1.25);
    });
  }

  // Sequenced Reveal Entrance Animation for Hero Copy & Frosted Cards
  initHeroMotion() {
    const elements = [
      { el: document.getElementById('heroEyebrow'), delay: 60, dy: 16 },
      { el: document.getElementById('heroLine1'), delay: 140, dy: 24 },
      { el: document.getElementById('heroLine2'), delay: 220, dy: 24 },
      { el: document.getElementById('heroParagraph'), delay: 300, dy: 20 },
      { el: document.getElementById('heroCtaWrap'), delay: 380, dy: 18 },
      { el: document.getElementById('phone3DCanvasWrap'), delay: 180, dy: 30, isScale: true },
      { el: document.getElementById('metricCard1'), delay: 260, dy: 20 },
      { el: document.getElementById('metricCard2'), delay: 340, dy: 20 },
      { el: document.getElementById('metricCard3'), delay: 420, dy: 20 }
    ];

    elements.forEach(item => {
      if (!item.el || typeof item.el.animate !== 'function') return;
      if (item.isScale) {
        item.el.animate([
          { opacity: 0, transform: `translateY(${item.dy}px) scale(0.96)` },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], {
          duration: 850,
          delay: item.delay,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards'
        });
      } else {
        item.el.animate([
          { opacity: 0, transform: `translateY(${item.dy}px)` },
          { opacity: 1, transform: 'translateY(0)' }
        ], {
          duration: 750,
          delay: item.delay,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards'
        });
      }
    });
  }

  renderProducts() {
    let filtered = [...this.products];

    // Filter by Brand
    filtered = ProductFilter.filterByBrand(filtered, this.activeCategory);

    // Filter by Condition
    filtered = ProductFilter.filterByCondition(filtered, this.activeCondition);

    // Filter by Price Range
    filtered = ProductFilter.filterByPriceRange(filtered, this.activePrice);

    // Search Query
    if (this.searchQuery) {
      filtered = ProductFilter.searchProducts(filtered, this.searchQuery);
    }

    // Sort
    filtered = ProductFilter.sortProducts(filtered, this.activeSort);

    const grid = document.getElementById('productGrid');
    const countEl = document.getElementById('catalog-count-badge');
    if (countEl) {
      countEl.innerText = `${filtered.length} mẫu có sẵn`;
    }

    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-[#6E6E73]">
          <span class="material-symbols-outlined text-[48px] text-[#D2D2D7] mb-2 block">devices_off</span>
          <p class="text-[17px] font-medium text-[#1D1D1F]">Không tìm thấy thiết bị phù hợp</p>
          <p class="text-[14px]">Vui lòng điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(p => `
      <article class="product-card" data-id="${p.id}">
        <div>
          <div class="flex items-center justify-between gap-1 mb-2">
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-white text-[#1D1D1F] border border-[#D2D2D7]/70">${p.conditionLabel}</span>
            <span class="text-[10px] font-medium text-[#0071E3] bg-[#0071E3]/5 px-2 py-0.5 rounded">${p.badge}</span>
          </div>

          <div class="h-44 w-full flex items-center justify-center p-3 mb-2 bg-[#F5F5F7] rounded-xl cursor-pointer overflow-hidden group" onclick="window.tienApp.openProductModalById('${p.id}')">
            <img 
              alt="${p.name}" 
              class="h-full object-contain group-hover:scale-105 transition-transform duration-300" 
              src="${p.image}"
              loading="lazy"
            />
          </div>

          <div class="text-[11px] text-[#6E6E73] flex items-center gap-1 mb-1">
            <span class="text-amber-500 font-semibold">★ ${p.rating.toFixed(1)}</span>
            <span>(${p.reviewCount} đánh giá)</span>
          </div>

          <h3 class="text-[16px] font-semibold text-[#1D1D1F] leading-snug line-clamp-1 cursor-pointer hover:text-[#0071E3] transition-colors" onclick="window.tienApp.openProductModalById('${p.id}')">
            ${p.name}
          </h3>
          <p class="text-[12px] text-[#6E6E73] line-clamp-1 mt-0.5">${p.description}</p>
        </div>

        <div class="mt-4 pt-3 border-t border-[#D2D2D7]/50">
          <div class="flex items-baseline justify-between mb-3">
            <div>
              <div class="text-[18px] font-semibold text-[#1D1D1F] leading-tight">${CartManager.formatCurrency(p.price)}</div>
              ${p.oldPrice ? `<div class="text-[12px] text-[#6E6E73] line-through">${CartManager.formatCurrency(p.oldPrice)}</div>` : ''}
            </div>
            ${p.oldPrice ? `<span class="text-[10px] font-medium text-[#0071E3] bg-[#0071E3]/10 px-1.5 py-0.5 rounded">-${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : ''}
          </div>

          <div class="grid grid-cols-2 gap-1.5">
            <button class="w-full py-2 text-center rounded-full bg-[#F5F5F7] text-[#1D1D1F] text-[12px] font-medium hover:bg-[#EAEAEA] transition-colors cursor-pointer" onclick="window.tienApp.openProductModalById('${p.id}')">
              Chi tiết
            </button>
            <button class="w-full py-2 text-center rounded-full bg-[#1D1D1F] text-white text-[12px] font-medium hover:bg-black transition-colors cursor-pointer" onclick="window.tienApp.quickAddToCart('${p.id}')">
              + Giỏ hàng
            </button>
          </div>
        </div>
      </article>
    `).join('');
  }

  quickAddToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    this.cart.addItem(product, 1, product.defaultColor, product.storages ? product.storages[0] : '');
    this.updateCartBadge();
    this.showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
    this.openCartDrawer();
  }

  openProductModalById(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    this.selectedProduct = product;
    this.selectedColor = product.defaultColor;
    this.selectedStorage = product.storages ? product.storages[0] : '';

    document.getElementById('modalProductTitle').innerText = product.name;
    document.getElementById('modalProductPrice').innerText = CartManager.formatCurrency(product.price);
    document.getElementById('modalProductOldPrice').innerText = product.oldPrice ? CartManager.formatCurrency(product.oldPrice) : '';
    document.getElementById('modalProductImg').src = product.image;
    document.getElementById('modalThumb1').src = product.image;

    document.getElementById('modalSpecChip').innerText = product.chip || 'Chuẩn Apple';
    document.getElementById('modalSpecCam').innerText = product.camera || '48MP Pro';
    document.getElementById('modalSpecBattery').innerText = product.battery || 'Pin tối ưu';
    document.getElementById('modalSpecScreen').innerText = product.screen || 'Retina OLED';

    // Render Color Swatches
    const swatchesContainer = document.getElementById('modal-swatches-container');
    const colorLabel = document.getElementById('modalProductColor');
    colorLabel.innerText = this.selectedColor;

    if (swatchesContainer) {
      swatchesContainer.innerHTML = (product.colors || []).map(c => `
        <button 
          title="${c.name}"
          class="swatch-btn ${c.name === this.selectedColor ? 'active' : ''}" 
          style="background-color: ${c.hex};"
          onclick="window.tienApp.selectModalColor('${c.name}')"
        ></button>
      `).join('');
    }

    // Render Storage Chips
    const storageContainer = document.getElementById('modal-storage-container');
    if (storageContainer) {
      storageContainer.innerHTML = (product.storages || []).map(s => `
        <button 
          class="storage-chip ${s === this.selectedStorage ? 'active' : ''}"
          onclick="window.tienApp.selectModalStorage('${s}')"
        >
          ${s}
        </button>
      `).join('');
    }

    const modal = document.getElementById('quickViewModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  selectModalColor(colorName) {
    this.selectedColor = colorName;
    document.getElementById('modalProductColor').innerText = colorName;
    const btns = document.querySelectorAll('#modal-swatches-container .swatch-btn');
    btns.forEach(b => {
      if (b.title === colorName) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  selectModalStorage(storage) {
    this.selectedStorage = storage;
    const chips = document.querySelectorAll('#modal-storage-container .storage-chip');
    chips.forEach(c => {
      if (c.innerText.trim() === storage) c.classList.add('active');
      else c.classList.remove('active');
    });
  }

  closeProductModal() {
    const modal = document.getElementById('quickViewModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  }

  // Cart Drawer
  openCartDrawer() {
    this.renderCartDrawer();
    const drawer = document.getElementById('cart-drawer-root');
    const panel = document.getElementById('cart-drawer-panel');
    if (drawer && panel) {
      drawer.classList.remove('hidden');
      setTimeout(() => {
        panel.classList.add('open');
      }, 10);
      document.body.style.overflow = 'hidden';
    }
  }

  closeCartDrawer() {
    const drawer = document.getElementById('cart-drawer-root');
    const panel = document.getElementById('cart-drawer-panel');
    if (drawer && panel) {
      panel.classList.remove('open');
      setTimeout(() => {
        drawer.classList.add('hidden');
        document.body.style.overflow = '';
      }, 300);
    }
  }

  renderCartDrawer() {
    const items = this.cart.getItems();
    const count = this.cart.getItemCount();

    document.querySelectorAll('.cart-count-display').forEach(el => {
      el.innerText = count;
    });

    const itemsContainer = document.getElementById('cart-items-list');
    if (!itemsContainer) return;

    if (items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="py-12 text-center text-[#6E6E73]">
          <span class="material-symbols-outlined text-[44px] text-[#D2D2D7] mb-2 block">shopping_cart</span>
          <p class="text-[15px] font-medium text-[#1D1D1F]">Giỏ hàng của bạn đang trống</p>
          <p class="text-[13px] mt-1">Hãy khám phá các mẫu điện thoại chính hãng và thêm vào giỏ.</p>
        </div>
      `;
    } else {
      itemsContainer.innerHTML = items.map((item, index) => `
        <div class="p-3.5 rounded-2xl bg-[#F5F5F7] flex gap-3.5 relative">
          <div class="w-18 h-18 rounded-xl bg-white flex-shrink-0 p-1 flex items-center justify-center border border-[#D2D2D7]/50">
            <img class="max-h-full max-w-full object-contain" src="${item.product.image}" alt="${item.product.name}" />
          </div>
          <div class="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <div class="flex items-start justify-between gap-1">
                <h4 class="text-[14px] font-semibold text-[#1D1D1F] truncate leading-tight">${item.product.name}</h4>
                <button class="text-[#6E6E73] hover:text-red-600 transition-colors cursor-pointer p-0.5" onclick="window.tienApp.removeCartItem(${index})" title="Xóa">
                  <span class="material-symbols-outlined text-[17px]">delete</span>
                </button>
              </div>
              <p class="text-[11px] text-[#6E6E73] mt-0.5">${item.color} • ${item.storage}</p>
            </div>
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-[#D2D2D7]/60">
              <div class="flex items-center rounded-full bg-white px-2 py-0.5 gap-2 border border-[#D2D2D7]">
                <button class="text-[#6E6E73] hover:text-[#1D1D1F] font-bold text-xs w-4 h-4 flex items-center justify-center cursor-pointer" onclick="window.tienApp.updateCartQty(${index}, ${item.quantity - 1})">-</button>
                <span class="text-xs font-semibold text-[#1D1D1F] px-1">${item.quantity}</span>
                <button class="text-[#6E6E73] hover:text-[#1D1D1F] font-bold text-xs w-4 h-4 flex items-center justify-center cursor-pointer" onclick="window.tienApp.updateCartQty(${index}, ${item.quantity + 1})">+</button>
              </div>
              <span class="text-[15px] font-semibold text-[#1D1D1F]">${CartManager.formatCurrency(item.product.price * item.quantity)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }

    // Update Summary
    document.getElementById('cart-subtotal').innerText = CartManager.formatCurrency(this.cart.getSubtotal());
    document.getElementById('cart-discount').innerText = `-${CartManager.formatCurrency(this.cart.getDiscount())}`;
    document.getElementById('cart-shipping').innerText = this.cart.getShippingFee() === 0 ? 'Miễn phí (Siêu tốc 2h)' : CartManager.formatCurrency(this.cart.getShippingFee());
    document.getElementById('cart-total').innerText = CartManager.formatCurrency(this.cart.getTotal());
  }

  updateCartQty(index, newQty) {
    this.cart.updateQuantity(index, newQty);
    this.updateCartBadge();
    this.renderCartDrawer();
  }

  removeCartItem(index) {
    this.cart.removeItem(index);
    this.updateCartBadge();
    this.renderCartDrawer();
    this.showToast('Đã xóa sản phẩm khỏi giỏ hàng.');
  }

  updateCartBadge() {
    const count = this.cart.getItemCount();
    document.querySelectorAll('.cart-badge-number').forEach(el => {
      el.innerText = count;
    });
  }

  handleCheckout(e) {
    e.preventDefault();
    if (this.cart.getItemCount() === 0) {
      this.showToast('Giỏ hàng trống. Vui lòng chọn sản phẩm trước khi thanh toán.');
      return;
    }

    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const address = document.getElementById('cust-address').value;

    const validation = BookingValidator.validateBookingForm({
      name,
      phone,
      device: 'Đơn mua online',
      service: 'Giao hàng tận nơi'
    });

    if (!validation.isValid) {
      alert(validation.errors[0].message);
      return;
    }

    const totalStr = CartManager.formatCurrency(this.cart.getTotal());
    this.cart.clearCart();
    this.updateCartBadge();
    this.closeCartDrawer();

    alert(`🎉 ĐẶT HÀNG THÀNH CÔNG!\n\nCảm ơn bạn ${name} (${phone}).\nTổng thanh toán: ${totalStr}\nĐịa chỉ nhận: ${address}\n\nNhân viên Tien Mobile sẽ gọi xác nhận đơn và giao hàng siêu tốc trong 2 giờ.`);
  }

  // Booking Modal
  openBookingModal(context = '') {
    const input = document.getElementById('repairDeviceInput');
    if (input && context) {
      input.value = context;
    }
    const modal = document.getElementById('repairModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden';
    }
  }

  closeBookingModal() {
    const modal = document.getElementById('repairModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  }

  handleRepairSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('repairCustName')?.value || 'Khách hàng';
    const phone = document.getElementById('repairCustPhone')?.value;
    const device = document.getElementById('repairDeviceInput')?.value;
    const service = document.getElementById('repairServiceSelect')?.value;

    const validation = BookingValidator.validateBookingForm({ name, phone, device, service });
    if (!validation.isValid) {
      alert(validation.errors[0].message);
      return;
    }

    this.closeBookingModal();
    alert(`✅ ĐÃ ĐẶT LỊCH HẸN ƯU TIÊN!\n\nTien Mobile đã ghi nhận thông tin:\n- Khách hàng: ${name} (${phone})\n- Máy: ${device}\n- Dịch vụ: ${service}\n\nKỹ thuật viên sẽ gọi xác nhận trong 5 phút và chuẩn bị sẵn linh kiện zin để phục vụ bạn ngay khi tới shop.`);
  }

  handleQuickRepairBarSubmit(e) {
    e.preventDefault();
    const phone = document.getElementById('quick-bar-phone').value;
    const device = document.getElementById('quick-bar-device').value;
    const service = document.getElementById('quick-bar-service').value;

    const validation = BookingValidator.validateBookingForm({
      name: 'Khách hàng đặt nhanh',
      phone,
      device,
      service
    });

    if (!validation.isValid) {
      alert(validation.errors[0].message);
      return;
    }

    alert(`✅ ĐÃ LƯU ƯU ĐÃI GIẢM 10%!\n\nSố điện thoại: ${phone}\nThiết bị: ${device}\nDịch vụ: ${service}\n\nCảm ơn bạn! Kỹ thuật viên sẽ liên hệ lại ngay để xác nhận thời gian.`);
  }

  // Chat Widget
  toggleChat() {
    const popover = document.getElementById('chatPopover');
    if (popover) {
      popover.classList.toggle('hidden');
    }
  }

  // Toast
  showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
}

// Khởi tạo app trên window
document.addEventListener('DOMContentLoaded', () => {
  window.tienApp = new App();
});
