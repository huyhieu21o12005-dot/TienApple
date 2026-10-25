/**
 * Tien Mobile - Main Application Controller
 * Connects UI with Store, CartManager, Filter, and Modals
 */

import { CartManager, ProductFilter, BookingValidator } from './store.js';
import { alertDialog } from './dialog.js';
import { Phone3DStudio } from './hero3d.js';
import { WaterRipplesEngine } from './waterRipples.js';
import { fetchProducts } from './productsApi.js';
import { submitOrder, submitBooking, buildOrderItems } from './ordersApi.js';
import { lookupInstallment } from './installmentApi.js';
import { lookupWarranty } from './warrantyApi.js';
import { validateTradeIn, buildTradeInBooking } from './tradeIn.js';
import { calcInstallment, INSTALLMENT_REFERENCE_RATE } from './installment.js';

const ACCESSORY_LABELS = { charger: 'Củ sạc & Cáp', audio: 'Tai nghe AirPods', case: 'Ốp lưng & Cường lực', tablet: 'iPad', watch: 'Apple Watch', other: 'Phụ kiện khác' };
import { validateZaloOffer, buildZaloMessage, buildOfferBooking, ZALO_URL } from './zalo.js';
import { enhanceSelects } from './customSelect.js';
import { safeUrl, partitionProducts, escapeHtml } from './utils.js';
import {
  productCardHtml,
  emptyCatalogHtml,
  swatchesHtml,
  storageChipsHtml,
  cartItemHtml,
  emptyCartHtml,
  warrantyResultsHtml,
  installmentResultHtml
} from './templates.js';

// Dữ liệu dự phòng nhúng sẵn (phòng trường hợp người dùng mở trực tiếp file:// mà không qua HTTP server)
const FALLBACK_PRODUCTS = [
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

const ACCESSORIES_DATA = [
  {
    "id": "charger-30w",
    "name": "Củ sạc nhanh Apple 30W USB-C chính hãng",
    "category": "charger",
    "badge": "Apple Zin",
    "price": 650000,
    "oldPrice": 850000,
    "rating": 5.0,
    "reviewCount": 320,
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBjJ20plbKYzKLiFb8cWsaqo6RrIyPTlD47tS2kbPjqVCJmkKcPMgLPkrqvCTEkJ9XWbJ06yojIDSdzbr2fPudTpPIhVSRy8MBz2Oh-kZ3yVrayY67Dj5mVkGvxE0_4QsBOUhkUM0DMjfpem7LTC7lDv3NuRaTRnV73uyzlQsMaeNQAIluD8DD0W45LK72TwESHO5bIgz_a84tnVku__BphNq8G0CN4gl3YX5I_DTAgNy1pM77VWG4u",
    "description": "Chuẩn Power Delivery 3.0 • Sạc 50% trong 30 phút • Bảo hành 12 tháng 1 đổi 1."
  },
  {
    "id": "cable-c-to-c",
    "name": "Cáp sạc dệt dù Apple USB-C 60W (1m) chính hãng",
    "category": "charger",
    "badge": "Dệt dù cao cấp",
    "price": 490000,
    "oldPrice": 590000,
    "rating": 4.9,
    "reviewCount": 215,
    "image": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80",
    "description": "Vỏ sợi dệt dù chống gãy đứt • Hỗ trợ sạc nhanh và truyền dữ liệu tốc độ cao."
  },
  {
    "id": "airpods-pro-2",
    "name": "Tai nghe AirPods Pro 2 USB-C Like New 99%",
    "category": "audio",
    "badge": "Chống ồn 2X",
    "price": 4290000,
    "oldPrice": 5990000,
    "rating": 5.0,
    "reviewCount": 184,
    "image": "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&auto=format&fit=crop&q=80",
    "description": "Cổng sạc Type-C • Chip H2 chống ồn chủ động gấp đôi • Âm thanh không gian cá nhân hóa."
  },
  {
    "id": "case-magsafe-clear",
    "name": "Ốp lưng MagSafe trong suốt chính hãng",
    "category": "case",
    "badge": "MagSafe Zin",
    "price": 890000,
    "oldPrice": 1290000,
    "rating": 4.8,
    "reviewCount": 142,
    "image": "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&auto=format&fit=crop&q=80",
    "description": "Vòng nam châm MagSafe hít cực chặt • Nhựa polycarbonate chống ố vàng cao cấp."
  },
  {
    "id": "glass-kingkong",
    "name": "Kính cường lực KingKong 9H chống vân tay",
    "category": "case",
    "badge": "Dán miễn phí",
    "price": 180000,
    "oldPrice": 250000,
    "rating": 4.9,
    "reviewCount": 450,
    "image": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&auto=format&fit=crop&q=80",
    "description": "Độ cứng 9H chống trầy xước • Cảm ứng mượt mà • Hỗ trợ dán chuẩn đẹp không bong bóng tại quầy."
  }
];

class App {
  constructor() {
    window.tienApp = this;
    this.products = partitionProducts(FALLBACK_PRODUCTS).phones;
    this.accessories = ACCESSORIES_DATA;
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
    // Thử tải dữ liệu từ Supabase trước; nếu chưa cấu hình hoặc lỗi sẽ fallback về data/products.json hoặc dữ liệu dự phòng
    let loaded = null;
    let remoteLoaded = false;
    try {
      // Kết nối được cơ sở dữ liệu thì chỉ hiện hàng thật (kể cả khi trống); hàng mẫu chỉ dùng lúc không kết nối được
      const remoteProducts = await fetchProducts({ allowEmpty: true });
      if (remoteProducts && Array.isArray(remoteProducts)) {
        loaded = remoteProducts;
        remoteLoaded = true;
      } else {
        let res = await fetch('data/products.json');
        if (!res.ok) {
          res = await fetch('../Data/products.json');
        }
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) loaded = json;
        }
      }
    } catch (e) {
      console.log('Using bundled fallback products data.', e);
    }

    if (loaded) {
      const { phones, accessories } = partitionProducts(loaded);
      if (remoteLoaded || phones.length > 0) this.products = phones;
      if (remoteLoaded || accessories.length > 0) this.accessories = accessories;
    }

    // Load giỏ hàng từ localStorage rồi đồng bộ giá mới nhất (giá có thể đổi liên tục từ trang quản trị)
    this.cart.loadFromLocalStorage();
    const { removed, priceChanged } = this.cart.reconcile([...this.products, ...this.accessories]);
    if (removed.length > 0) {
      this.showToast(`Đã bỏ khỏi giỏ hàng vì không còn bán: ${removed.join(', ')}`);
    } else if (priceChanged.length > 0) {
      this.showToast('Giá một số sản phẩm trong giỏ hàng đã được cập nhật.');
    }

    this.renderProducts();
    this.renderAccessories();
    this.updateCartBadge();
    this.bindEvents();
    this.initHero3DInteraction();
    this.initHeroMotion();
    this.initLayerNavigation();
    this.openCartFromQuery();
    this.initMobileMenu();
    this.initMegaMenu();
    this.initWarrantyLookup();
    this.initTradeInForm();
    this.initInstallmentForm();
    enhanceSelects();
  }

  /** Từ trang chi tiết sản phẩm: index.html?cart=1 mở sẵn popup giỏ hàng rồi bỏ tham số khỏi URL. */
  openCartFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('cart') !== '1') return;
    params.delete('cart');
    const query = params.toString();
    history.replaceState(history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    setTimeout(() => this.openCartDrawer(), 150);
  }

  initTradeInForm() {
    const form = document.getElementById('tradeInForm');
    if (!form) return;
    const val = (id) => document.getElementById(id)?.value ?? '';
    const button = document.getElementById('tradeInSubmit');
    const error = document.getElementById('tradeInError');
    const done = document.getElementById('tradeInDone');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (button.disabled) return;
      error.classList.add('hidden');
      done.classList.add('hidden');

      const data = {
        brand: val('tiBrand'), model: val('tiModel'), storage: val('tiStorage'),
        condition: val('tiCondition'), battery: val('tiBattery'),
        accessories: document.getElementById('tiAccessories')?.checked === true,
        name: val('tiName'), phone: val('tiPhone'), note: val('tiNote')
      };
      const check = validateTradeIn(data);
      if (!check.valid) {
        error.textContent = check.errors[0];
        error.classList.remove('hidden');
        return;
      }

      button.disabled = true;
      button.textContent = 'Đang gửi...';
      try {
        const result = await submitBooking(buildTradeInBooking(data));
        if (!result.ok) {
          error.textContent = result.message;
          error.classList.remove('hidden');
          return;
        }
        form.reset();
        done.textContent = `Đã nhận yêu cầu ${result.code}. Cửa hàng sẽ gọi lại báo giá cho bạn sớm nhất.`;
        done.classList.remove('hidden');
      } finally {
        button.disabled = false;
        button.textContent = 'Gửi yêu cầu báo giá';
      }
    });
  }

  initInstallmentForm() {
    const preview = document.getElementById('tgPreview');
    if (preview) {
      const val = (id) => document.getElementById(id)?.value ?? '';
      const money = (n) => CartManager.formatCurrency(n);
      const rateInput = document.getElementById('tgRate');
      if (rateInput && INSTALLMENT_REFERENCE_RATE > 0) rateInput.value = String(INSTALLMENT_REFERENCE_RATE).replace('.', ',');
      const update = () => {
        const calc = calcInstallment({ price: val('tgPrice'), downPayment: val('tgDown'), rate: val('tgRate'), term: val('tgTerm') });
        if (!calc.valid) {
          preview.innerHTML = '<div class="text-[13px] opacity-80">Nhập giá máy (và trả trước nếu có) để xem số tiền góp ước tính.</div>';
          return;
        }
        preview.innerHTML = `
          <div class="text-[13px] opacity-80">Góp mỗi tháng (ước tính)</div>
          <div class="text-[24px] font-semibold">${money(calc.monthly)} <span class="text-[14px] font-normal opacity-80">x ${Number(val('tgTerm'))} tháng</span></div>
          <div class="text-[12px] opacity-80 mt-1">Khoản vay ${money(calc.loan)} · tổng phải trả ${money(calc.total)}</div>`;
      };
      ['tgPrice', 'tgDown', 'tgRate', 'tgTerm'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', update);
        document.getElementById(id)?.addEventListener('change', update);
      });
    }

    const form = document.getElementById('installmentLookupForm');
    if (!form) return;
    const button = document.getElementById('ilSubmit');
    const error = document.getElementById('ilError');
    const results = document.getElementById('ilResults');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (button.disabled) return;
      error.classList.add('hidden');
      results.innerHTML = '';
      button.disabled = true;
      button.textContent = 'Đang tra cứu...';
      try {
        const result = await lookupInstallment(document.getElementById('ilPhone').value, document.getElementById('ilCode').value);
        if (!result.ok) {
          error.textContent = result.message;
          error.classList.remove('hidden');
          return;
        }
        results.innerHTML = installmentResultHtml(result.record);
      } finally {
        button.disabled = false;
        button.textContent = 'Tra cứu';
      }
    });
  }

  initWarrantyLookup() {
    const form = document.getElementById('warrantyForm');
    if (!form) return;
    const input = document.getElementById('warrantyPhone');
    const button = document.getElementById('warrantySubmit');
    const results = document.getElementById('warrantyResults');
    const error = document.getElementById('warrantyError');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (button.disabled) return;
      error.classList.add('hidden');
      results.innerHTML = '';
      button.disabled = true;
      button.textContent = 'Đang tra cứu...';
      try {
        const result = await lookupWarranty(input.value);
        if (!result.ok) {
          error.textContent = result.message;
          error.classList.remove('hidden');
          return;
        }
        results.innerHTML = warrantyResultsHtml(result.records);
      } finally {
        button.disabled = false;
        button.textContent = 'Tra cứu';
      }
    });
  }

  /** Bảng sổ ra trên thanh header (máy tính) và nút nhanh trong menu điện thoại, dựng theo sản phẩm thật. */
  renderMegaMenu() {
    const mega = document.getElementById('megaMenu');
    const quick = document.getElementById('mobileQuick');
    if (!mega && !quick) return;
    const brands = new Map();
    for (const p of this.products) {
      const key = String(p.brand || 'other').toLowerCase();
      const e = brands.get(key) || { key, label: p.brandName || p.brand || 'Khác', count: 0 };
      e.count += 1;
      brands.set(key, e);
    }
    const phones = [...brands.values()].sort((a, b) => (b.key === 'apple') - (a.key === 'apple') || b.count - a.count);
    const cats = new Map();
    for (const a of this.accessories) cats.set(a.category || 'other', (cats.get(a.category || 'other') || 0) + 1);
    const devices = ['tablet', 'watch'].filter(k => cats.has(k));
    const rest = [...cats.keys()].filter(k => !devices.includes(k));
    const link = (kind, key, label, n) => `<button type="button" class="mega-link" data-mm="${kind}" data-key="${escapeHtml(key)}"><span>${escapeHtml(label)}</span><small>${n}</small></button>`;
    const col = (title, links) => links ? `<div class="mega-col"><h3>${title}</h3>${links}</div>` : '';
    if (mega) {
      mega.innerHTML =
        col('Điện thoại', link('phone', 'all', 'Tất cả điện thoại', this.products.length) + phones.map(b => link('phone', b.key, b.label, b.count)).join(''))
        + col('iPad & Apple Watch', devices.map(k => link('acc', k, ACCESSORY_LABELS[k], cats.get(k))).join(''))
        + col('Phụ kiện', link('acc', 'all', 'Tất cả phụ kiện', this.accessories.length) + rest.map(k => link('acc', k, ACCESSORY_LABELS[k] || 'Phụ kiện khác', cats.get(k))).join(''));
    }
    if (quick) {
      const chip = (kind, key, label) => `<button type="button" class="mega-chip" data-mm="${kind}" data-key="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
      quick.innerHTML = phones.map(b => chip('phone', b.key, b.label)).join('') + devices.map(k => chip('acc', k, ACCESSORY_LABELS[k])).join('')
        + rest.filter(k => k !== 'other').map(k => chip('acc', k, ACCESSORY_LABELS[k])).join('');
    }
  }

  openFromMenu(kind, key) {
    if (kind === 'phone') {
      this.activeCategory = key;
      this.switchLayer('layer-dienthoai');
      this.renderProducts();
    } else {
      this.switchLayer('layer-phukien');
      this.renderAccessories(key);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  initMegaMenu() {
    const header = document.getElementById('mainHeader');
    const mega = document.getElementById('megaMenu');
    if (!header || !mega) return;
    const triggers = [...document.querySelectorAll('#mainNav [data-mega]')];
    let timer = null;
    const setOpen = (open) => {
      clearTimeout(timer);
      triggers.forEach(t => t.setAttribute('aria-expanded', String(open)));
      if (open) {
        mega.hidden = false;
        requestAnimationFrame(() => mega.classList.add('is-open'));
      } else {
        mega.classList.remove('is-open');
        timer = setTimeout(() => { mega.hidden = true; }, 180);
      }
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(() => setOpen(false), 140); };
    triggers.forEach(t => {
      t.addEventListener('mouseenter', () => setOpen(true));
      t.addEventListener('focus', () => setOpen(true));
      t.addEventListener('mouseleave', later);
    });
    mega.addEventListener('mouseenter', () => clearTimeout(timer));
    mega.addEventListener('mouseleave', later);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', (e) => {
      const item = e.target.closest('[data-mm]');
      if (!item) return;
      setOpen(false);
      this.openFromMenu(item.dataset.mm, item.dataset.key);
    });
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const panel = document.getElementById('mobileMenuPanel');
    const icon = document.getElementById('mobileMenuIcon');
    if (!btn || !panel) return;

    const setOpen = (open) => {
      panel.classList.toggle('hidden', !open);
      document.body.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
      if (icon) icon.textContent = open ? 'close' : 'menu';
    };

    btn.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
    panel.querySelectorAll('a, button').forEach(el => el.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.classList.contains('hidden')) {
        setOpen(false);
        btn.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1280) setOpen(false);
    });
  }

  bindEvents() {
    // 1. Brand Filter Buttons (nút được dựng động theo sản phẩm thật, nên dùng ủy quyền sự kiện)
    const brandPills = document.getElementById('brandFilterPills');
    if (brandPills) {
      brandPills.addEventListener('click', (e) => {
        const btn = e.target.closest('.brand-btn');
        if (!btn) return;
        this.activeCategory = btn.getAttribute('data-brand') || 'all';
        this.renderProducts();
      });
    }

    // 1.2. Accessory Filter Buttons (dựng động, ủy quyền sự kiện)
    const accPills = document.getElementById('accessoryFilterPills');
    if (accPills) {
      accPills.addEventListener('click', (e) => {
        const btn = e.target.closest('.accessory-filter-btn');
        if (!btn) return;
        this.renderAccessories(btn.getAttribute('data-acc-filter') || 'all');
      });
    }

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

    const cartBackBtn = document.getElementById('cart-back-btn');
    if (cartBackBtn) {
      cartBackBtn.addEventListener('click', () => this.closeCartDrawer());
    }

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
      document.getElementById('quick-bar-copy')?.addEventListener('click', async () => {
        const message = document.getElementById('quick-bar-done')?.dataset.message || '';
        if (message && await this.copyText(message)) this.showToast('Đã sao chép lại thông tin.');
      });
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

    // Modal Buy Now & Add To Cart
    const modalBuyNowBtn = document.getElementById('modal-buy-now-btn');
    if (modalBuyNowBtn) {
      modalBuyNowBtn.addEventListener('click', () => {
        if (this.selectedProduct) {
          this.cart.addItem(this.selectedProduct, 1, this.selectedColor, this.selectedStorage);
          this.updateCartBadge();
          this.showToast(`Đã chọn mua "${this.selectedProduct.name}"!`);
          this.closeProductModal();
          this.openCartDrawer();
          setTimeout(() => {
            const custName = document.getElementById('cust-name');
            if (custName) custName.focus();
          }, 350);
        }
      });
    }

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
          this.showToast('Tien Mobile Thu Duc đã nhận tin nhắn. Kỹ thuật viên sẽ hỗ trợ bạn sau vài giây!');
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
    // 0. Nút CTA "Đặt mua sản phẩm" trên Hero Section
    const heroBuyBtn = document.getElementById('heroBuyProductBtn');
    if (heroBuyBtn) {
      heroBuyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchLayer('layer-dienthoai');
        setTimeout(() => {
          const productSection = document.getElementById('dienthoai');
          if (productSection) {
            productSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      });
    }

    // 1. Listen to layer links (Header links, CTA buttons, Layer Switcher tabs)
    const layerTriggers = document.querySelectorAll('[data-layer], .nav-layer-link');
    layerTriggers.forEach(trigger => {
      // Bỏ qua nếu là heroBuyBtn đã được gắn handler riêng
      if (trigger.id === 'heroBuyProductBtn') return;
      trigger.addEventListener('click', (e) => {
        const layerId = trigger.getAttribute('data-layer');
        if (!layerId) return;
        e.preventDefault();
        const filter = trigger.getAttribute('data-filter');
        this.switchLayer(layerId, filter, trigger);
      });
    });

    // 2. Hash Change Support (direct URLs like #dienthoai, #suachua, #phukien, #camket, #lienhe)
    window.addEventListener('hashchange', () => {
      this.handleHashChange();
    });
    window.addEventListener('popstate', () => {
      this.handleHashChange();
    });

    // Handle initial hash on page load if present
    if (window.location.hash) {
      this.handleHashChange();
    }
    this.updateBackButtons();
  }

  handleHashChange() {
    const hash = window.location.hash.replace('#', '');
    const hashMap = {
      'trangchu': 'layer-trangchu',
      'dienthoai': 'layer-dienthoai',
      'suachua': 'layer-suachua',
      'phukien': 'layer-phukien',
      'camket': 'layer-camket',
      'tragop': 'layer-tragop',
      'baohanh': 'layer-baohanh',
      'lienhe': 'layer-lienhe'
    };
    if (hashMap[hash]) {
      this.switchLayer(hashMap[hash], null, null, true);
    } else if (!hash) {
      this.switchLayer('layer-trangchu', null, null, true);
    }
  }

  /** Thêm nút "Quay lại" vào đầu mỗi mục (trừ Trang chủ) và ẩn/hiện theo mục đang xem. */
  updateBackButtons(layerId) {
    document.querySelectorAll('.app-layer').forEach(layer => {
      let bar = layer.querySelector(':scope > .layer-back-bar');
      if (layer.id === 'layer-trangchu') { if (bar) bar.remove(); return; }
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'layer-back-bar w-full px-6 sm:px-10 lg:px-16 pt-4';
        bar.innerHTML = '<button type="button" class="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[13px] font-medium text-[#1D1D1F] cursor-pointer border-0"><span class="material-symbols-outlined text-[18px]">arrow_back</span> Quay lại</button>';
        bar.firstElementChild.addEventListener('click', () => this.goBackLayer());
        layer.insertBefore(bar, layer.firstChild);
      }
    });
  }

  goBackLayer() {
    if (history.state && history.state.tmLayer) history.back();
    else this.switchLayer('layer-trangchu', null, null, true);
  }

  switchLayer(layerId, filter = null, trigger = null, fromHistory = false) {
    // Nếu là 'layer-lienhe' -> cuộn mượt xuống chân trang #lienhe
    if (layerId === 'layer-lienhe') {
      const footer = document.getElementById('lienhe');
      if (footer) {
        footer.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

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

    // 2. Cập nhật trạng thái Active trên Top Header:
    // Mỗi link trên navbar có data-layer độc lập ('layer-dienthoai' vs 'layer-phukien'), đảm bảo active chính xác
    const navLinks = document.querySelectorAll('#mainNav .nav-layer-link');
    navLinks.forEach(link => {
      const linkLayer = link.getAttribute('data-layer');
      const bar = link.querySelector('.nav-active-bar');
      const isMatch = (linkLayer === layerId);

      if (isMatch) {
        link.classList.remove('text-[#6E6E73]', 'font-normal');
        link.classList.add('text-[#1D1D1F]', 'font-semibold', 'active');
        if (bar) bar.classList.remove('hidden');
      } else {
        link.classList.remove('text-[#1D1D1F]', 'font-semibold', 'active');
        link.classList.add('text-[#6E6E73]', 'font-normal');
        if (bar) bar.classList.add('hidden');
      }
    });

    // 3. Nếu là layer Phụ kiện -> render phụ kiện
    if (layerId === 'layer-phukien') {
      this.renderAccessories();
    }

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
      'layer-phukien': 'phukien',
      'layer-camket': 'camket',
      'layer-tragop': 'tragop',
      'layer-baohanh': 'baohanh'
    };
    const newHash = reverseHashMap[layerId] ? `#${reverseHashMap[layerId]}` : '';
    if (newHash && !fromHistory && history.pushState && window.location.hash !== newHash) {
      // pushState để nút Quay lại của trình duyệt và nút "Quay lại" trên trang về đúng mục trước đó
      history.pushState({ tmLayer: true }, '', newHash);
    }
    this.updateBackButtons(layerId);
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

  /** Dựng lại các thẻ hãng với số máy thật (đã áp dụng tình trạng, khoảng giá, tìm kiếm đang chọn). */
  renderBrandTags() {
    const box = document.getElementById('brandFilterPills');
    if (!box) return;
    let pool = ProductFilter.filterByCondition([...this.products], this.activeCondition);
    pool = ProductFilter.filterByPriceRange(pool, this.activePrice);
    if (this.searchQuery) pool = ProductFilter.searchProducts(pool, this.searchQuery);

    const brands = new Map();
    for (const p of pool) {
      const key = String(p.brand || 'other').toLowerCase();
      const entry = brands.get(key) || { key, label: p.brandName || p.brand || 'Khác', count: 0 };
      entry.count += 1;
      brands.set(key, entry);
    }
    // hãng đang chọn không còn máy nào: về "Tất cả" để không hiện danh sách trống khó hiểu
    const all = String(this.activeCategory || 'all').toLowerCase();
    if (all !== 'all' && !brands.has(all)) this.activeCategory = 'all';
    const active = String(this.activeCategory || 'all').toLowerCase();

    const list = [...brands.values()].sort((a, b) => (b.key === 'apple') - (a.key === 'apple') || b.count - a.count);
    const btn = (key, label, count) => {
      const on = key === active;
      return `<button type="button" class="brand-btn px-4 py-2 rounded-full text-[13px] font-medium ${on ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#EAEAEA]'} transition-colors cursor-pointer shrink-0 whitespace-nowrap" data-brand="${escapeHtml(key)}" aria-pressed="${on}">${escapeHtml(label)} (${count})</button>`;
    };
    box.innerHTML = btn('all', 'Tất cả', pool.length) + list.map(b => btn(b.key, b.label, b.count)).join('');
  }

  renderProducts() {
    this.renderBrandTags();
    this.renderMegaMenu();
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
      grid.innerHTML = emptyCatalogHtml({ storeEmpty: this.products.length === 0 });
      return;
    }

    grid.innerHTML = filtered.map(p => productCardHtml(p)).join('');
  }

  // Render danh mục Phụ kiện chính hãng riêng biệt
  renderAccessories(category = 'all') {
    const grid = document.getElementById('accessoryGrid');
    if (!grid) return;

    const labels = ACCESSORY_LABELS;
    const counts = new Map();
    for (const a of this.accessories) counts.set(a.category || 'other', (counts.get(a.category || 'other') || 0) + 1);
    if (category !== 'all' && !counts.has(category)) category = 'all';

    const pills = document.getElementById('accessoryFilterPills');
    if (pills) {
      const btn = (key, label, count) => {
        const on = key === category;
        return `<button type="button" class="accessory-filter-btn px-4 py-2 rounded-full text-[13px] font-medium ${on ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#EAEAEA]'} transition-colors cursor-pointer shrink-0 whitespace-nowrap" data-acc-filter="${escapeHtml(key)}">${escapeHtml(label)} (${count})</button>`;
      };
      pills.innerHTML = btn('all', 'Tất cả phụ kiện', this.accessories.length)
        + [...counts.entries()].map(([key, n]) => btn(key, labels[key] || 'Phụ kiện khác', n)).join('');
    }

    this.renderMegaMenu();
    let items = this.accessories;
    if (category !== 'all') {
      items = items.filter(a => (a.category || 'other') === category);
    }

    grid.innerHTML = items.length ? items.map(p => productCardHtml(p, { accessory: true })).join('') : emptyCatalogHtml({ storeEmpty: this.accessories.length === 0 });
  }

  findProduct(productId) {
    return this.products.find(p => p.id === productId) || this.accessories.find(a => a.id === productId) || null;
  }

  quickAddToCart(productId) {
    const product = this.findProduct(productId);
    if (!product) return;

    const color = product.defaultColor || (product.colors && product.colors[0]?.name) || 'Tiêu chuẩn';
    const storage = product.storages ? product.storages[0] : 'Chuẩn Zin';
    this.cart.addItem(product, 1, color, storage);
    this.updateCartBadge();
    this.showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
    this.openCartDrawer();
  }

  /** Bấm vào sản phẩm: mở trang chi tiết riêng (có nút Quay lại). */
  openProductModalById(productId) {
    if (productId === undefined || productId === null || productId === '') return;
    window.location.href = `product.html?id=${encodeURIComponent(productId)}`;
  }

  /** Popup xem nhanh cũ, không còn dùng cho thẻ sản phẩm. */
  openQuickViewModalById(productId) {
    const product = this.findProduct(productId);
    if (!product) return;

    this.selectedProduct = product;
    this.selectedColor = product.defaultColor || (product.colors && product.colors[0]?.name) || 'Tiêu chuẩn';
    this.selectedStorage = product.storages ? product.storages[0] : 'Chuẩn Zin';

    document.getElementById('modalProductTitle').innerText = product.name;
    document.getElementById('modalProductPrice').innerText = CartManager.formatCurrency(product.price);
    document.getElementById('modalProductOldPrice').innerText = product.oldPrice ? CartManager.formatCurrency(product.oldPrice) : '';
    document.getElementById('modalProductImg').src = safeUrl(product.image);
    document.getElementById('modalThumb1').src = safeUrl(product.image);

    document.getElementById('modalSpecChip').innerText = product.chip || 'Chuẩn Apple';
    document.getElementById('modalSpecCam').innerText = product.camera || 'Phụ kiện zin';
    document.getElementById('modalSpecBattery').innerText = product.battery || 'Tối ưu hiệu năng';
    document.getElementById('modalSpecScreen').innerText = product.screen || 'Chính hãng';

    // Render Color Swatches
    const swatchesContainer = document.getElementById('modal-swatches-container');
    const colorLabel = document.getElementById('modalProductColor');
    colorLabel.innerText = this.selectedColor;

    if (swatchesContainer) {
      swatchesContainer.innerHTML = swatchesHtml(product.colors, this.selectedColor);
    }

    // Render Storage Chips
    const storageContainer = document.getElementById('modal-storage-container');
    if (storageContainer) {
      storageContainer.innerHTML = storageChipsHtml(product.storages, this.selectedStorage);
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

    itemsContainer.innerHTML = items.length === 0
      ? emptyCartHtml()
      : items.map((item, index) => cartItemHtml(item, index)).join('');

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

  async handleCheckout(e) {
    e.preventDefault();
    if (this._submitting) return;
    if (this.cart.getItemCount() === 0) {
      this.showToast('Giỏ hàng trống. Vui lòng chọn sản phẩm trước khi thanh toán.');
      return;
    }

    const name = document.getElementById('cust-name')?.value || '';
    const phone = document.getElementById('cust-phone')?.value || '';
    const address = document.getElementById('cust-address')?.value || '';

    const validation = BookingValidator.validateOrderForm({ name, phone, address });
    if (!validation.isValid) {
      await alertDialog(validation.errors[0].message);
      return;
    }

    this._submitting = true;
    const submitBtn = e.target.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const result = await submitOrder({
        name,
        phone: validation.normalizedPhone || phone,
        address,
        items: buildOrderItems(this.cart.getItems()),
        voucher: this.cart.appliedVoucher
      });

      if (!result.ok) {
        await alertDialog(result.message);
        return;
      }

      this.cart.clearCart();
      this.updateCartBadge();
      this.closeCartDrawer();
      await alertDialog(`ĐẶT HÀNG THÀNH CÔNG!\n\nMã đơn: ${result.code}\nCảm ơn bạn ${name} (${validation.normalizedPhone || phone}).\nTổng thanh toán: ${CartManager.formatCurrency(result.total)}\nĐịa chỉ nhận: ${address}\n\nNhân viên Tien Mobile sẽ gọi xác nhận đơn trong thời gian sớm nhất.`);
    } finally {
      this._submitting = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // Booking Modal
  openBookingModal(context = '') {
    const select = document.getElementById('repairServiceSelect');
    if (select && context) {
      const match = [...select.options].find(o => o.value === context);
      if (match) select.value = match.value;
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

  async handleRepairSubmit(e) {
    e.preventDefault();
    if (this._submitting) return;
    const name = document.getElementById('repairCustName')?.value || 'Khách hàng';
    const phone = document.getElementById('repairCustPhone')?.value;
    const device = document.getElementById('repairDeviceInput')?.value;
    const service = document.getElementById('repairServiceSelect')?.value;

    const validation = BookingValidator.validateBookingForm({ name, phone, device, service });
    if (!validation.isValid) {
      await alertDialog(validation.errors[0].message);
      return;
    }

    this._submitting = true;
    try {
      const result = await submitBooking({ name, phone: validation.normalizedPhone || phone, device, service });
      if (!result.ok) {
        await alertDialog(result.message);
        return;
      }
      this.closeBookingModal();
      await alertDialog(`ĐÃ ĐẶT LỊCH HẸN!\n\nMã lịch: ${result.code}\n- Khách hàng: ${name} (${phone})\n- Máy: ${device}\n- Dịch vụ: ${service}\n\nKỹ thuật viên sẽ gọi xác nhận trong thời gian sớm nhất.`);
    } finally {
      this._submitting = false;
    }
  }

  // Sao chép nội dung vào clipboard; trả về true nếu thành công (có phương án dự phòng cho trình duyệt cũ)
  async copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) { /* thử phương án dự phòng bên dưới */ }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (err) {
      return false;
    }
  }

  // "Nhận ưu đãi": gửi thông tin về cửa hàng (lưu vào quản trị và báo Telegram) và mở Zalo của chủ cửa hàng
  async handleQuickRepairBarSubmit(e) {
    e.preventDefault();
    if (this._submitting) return;
    const val = (id) => document.getElementById(id)?.value ?? '';
    const error = document.getElementById('quick-bar-error');
    const done = document.getElementById('quick-bar-done');
    const button = document.getElementById('quick-bar-submit');
    error.classList.add('hidden');
    done.classList.add('hidden');

    const data = {
      name: val('quick-bar-name'), phone: val('quick-bar-phone'), device: val('quick-bar-device'),
      service: val('quick-bar-service'), note: val('quick-bar-note')
    };
    const check = validateZaloOffer(data);
    if (!check.valid) {
      error.textContent = check.errors[0];
      error.classList.remove('hidden');
      return;
    }

    // Mở Zalo ngay trong thao tác bấm để trình duyệt không chặn cửa sổ mới
    const zaloWindow = window.open(ZALO_URL, '_blank', 'noopener');
    const message = buildZaloMessage(data);
    const label = button?.querySelector('span');
    this._submitting = true;
    if (button) button.disabled = true;
    if (label) label.textContent = 'Đang gửi...';
    try {
      const result = await submitBooking(buildOfferBooking(data));
      document.getElementById('quick-bar-preview').textContent = message;
      done.dataset.message = message;
      done.querySelector('p').textContent = result.ok
        ? `Đã gửi thông tin cho cửa hàng (mã ${result.code}). Cửa hàng sẽ liên hệ lại với bạn sớm nhất. Zalo của cửa hàng đã mở để bạn nhắn thêm.`
        : `Chưa gửi được thông tin tự động. ${result.message} Bạn hãy sao chép nội dung dưới đây và gửi qua Zalo cửa hàng.`;
      const copied = await this.copyText(message);
      if (result.ok && copied) {
        done.querySelector('p').textContent += ' Nội dung yêu cầu đã được sao chép, bạn chỉ cần dán vào Zalo và gửi.';
      }
      done.classList.remove('hidden');
      if (result.ok) document.getElementById('quick-repair-bar-form').reset();
      if (!zaloWindow) this.showToast('Trình duyệt chặn cửa sổ mới, bấm "Mở Zalo" bên dưới.');
    } finally {
      this._submitting = false;
      if (button) button.disabled = false;
      if (label) label.textContent = 'Nhận ưu đãi 10% qua Zalo';
    }
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
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-[18px] text-emerald-400';
    icon.textContent = 'check_circle';
    const text = document.createElement('span');
    text.textContent = message;
    toast.append(icon, text);
    toast.setAttribute('role', 'status');

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
