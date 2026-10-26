import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const exists = (p) => existsSync(new URL(p, root));
const read = (p) => readFileSync(new URL(p, root), 'utf8');

describe('dự án gọn: không còn bản sao và tài nguyên không dùng', () => {
  it('dữ liệu mẫu chỉ có một nơi duy nhất (Frontend/data), không còn Data/ và Mock/', () => {
    assert.equal(exists('Data/products.json'), false);
    assert.equal(exists('Mock/products.json'), false);
    assert.ok(exists('Frontend/data/products.json'));
    assert.ok(exists('Frontend/data/services.json'));
    assert.doesNotMatch(read('Frontend/js/app.js'), /\.\.\/Data\//);
  });
  it('không còn ảnh, mô hình thô không trang nào dùng trong thư mục triển khai', () => {
    for (const p of ['Frontend/assets/hand_open.jpg', 'Frontend/assets/hand_open.png', 'Frontend/assets/hand_transparent.png', 'Frontend/assets/ip18promax', 'Frontend/models/new_model']) {
      assert.equal(exists(p), false, p);
    }
    assert.ok(exists('Frontend/models/iphone_18_pro_max.glb'));
  });
});

describe('admin.js không còn mã của các nút Sheet cũ', () => {
  const js = read('Frontend/admin/admin.js');
  it('không còn tham chiếu nút đã bị gỡ khỏi trang', () => {
    for (const id of ['sheetNewBtn', 'sheetAccBtn', 'sheetUsedBtn', 'sheetPriceBtn']) assert.doesNotMatch(js, new RegExp(id), id);
  });
  it('mọi id admin.js tìm bằng getElementById đều có trong trang quản trị hoặc do mã tự tạo', () => {
    const html = read('Frontend/admin/index.html');
    const ids = new Set([...js.matchAll(/getElementById\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)].map(m => m[1]));
    const missing = [...ids].filter(id => !new RegExp(`id=["']${id}["']`).test(html) && !new RegExp(`id=\\\\?["']${id}\\\\?["']|\\.id\\s*=\\s*['"]${id}['"]`).test(js));
    assert.deepEqual(missing, []);
  });
});

describe('hàm đã thay thế không còn tồn tại', () => {
  it('sheetPricing không còn planPriceUpdates và brandsOf (luồng đồng bộ hợp nhất đã thay thế)', async () => {
    const m = await import('../../Frontend/admin/sheetPricing.js');
    assert.equal('planPriceUpdates' in m, false);
    assert.equal('brandsOf' in m, false);
    assert.ok(typeof m.planNewProducts === 'function' && typeof m.planUsedProducts === 'function');
  });
  it('không còn hàm mở xem nhanh không ai gọi trong app.js', () => {
    assert.doesNotMatch(read('Frontend/js/app.js'), /openQuickViewModalById/);
  });
});

describe('style.css không còn lớp mồ côi', () => {
  it('mọi lớp khai báo trong style.css đều được trang bán hàng hoặc mã JS dùng', async () => {
    const { execSync } = await import('node:child_process');
    const css = read('Frontend/css/style.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const files = execSync("git ls-files Frontend | grep -E '\\.(js|html)$' | grep -vE 'three.min|GLTFLoader|admin/'", { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(f => exists(f));
    const src = files.map(read).join('\n');
    const helpers = new Set(['truncate', 'line-clamp-1', 'line-clamp-2']); // bổ sung cho tiện ích Tailwind
    const classes = [...new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m => m[1]))].filter(c => !helpers.has(c));
    const unused = classes.filter(c => !new RegExp(`(?<![\\w-])${c.replace(/-/g, '\\-')}(?![\\w-])`).test(src));
    assert.deepEqual(unused, []);
  });
  it('trang halora.html không liên quan không còn nằm trong thư mục triển khai', () => {
    assert.equal(exists('Frontend/halora.html'), false);
  });
});

describe('không dùng logo quả táo của Apple (tránh vi phạm bản quyền)', () => {
  const APPLE_GLYPH = /M18\.71 19\.5c/;
  it('không file triển khai nào chứa đường vẽ logo Apple', async () => {
    const { execSync } = await import('node:child_process');
    const files = execSync("git ls-files Frontend api | grep -E '\\.(js|html|css|svg)$' | grep -vE 'three.min|GLTFLoader'", { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(f => exists(f));
    const hits = files.filter(f => APPLE_GLYPH.test(read(f)));
    assert.deepEqual(hits, []);
  });
  it('trang chủ không còn hình nền logo Apple và mã chuyển động của nó', () => {
    assert.doesNotMatch(read('Frontend/index.html'), /apple-bg-watermark|apple-watermark-svg|appleBgWatermark/);
    assert.doesNotMatch(read('Frontend/css/style.css'), /apple-bg-watermark|apple-watermark-svg/);
    assert.doesNotMatch(read('Frontend/js/app.js'), /appleBgWatermark|appleWatermark/);
  });
  it('logo.svg là biểu tượng điện thoại tự thiết kế, không có hình quả táo', () => {
    assert.doesNotMatch(read('Frontend/assets/logo.svg'), APPLE_GLYPH);
    assert.match(read('Frontend/assets/logo.svg'), /Tien Mobile Thu Duc/);
  });
});

describe('thư mục nháp và tệp lời nhắc không dùng đã được xóa', () => {
  it('không còn Design/ và các tệp lời nhắc ở gốc dự án', () => {
    for (const p of ['Design', 'antigravity-admin-prompt.txt', 'stitch-prompt.txt']) assert.equal(exists(p), false, p);
  });
});

describe('trang quản trị và đăng nhập không hiện logo', () => {
  it('không trang admin nào còn ảnh logo hoặc lớp brand-logo', async () => {
    const { readdirSync } = await import('node:fs');
    const pages = readdirSync(new URL('Frontend/admin/', root)).filter(f => /\.(html|css)$/.test(f));
    for (const f of pages) assert.doesNotMatch(read(`Frontend/admin/${f}`), /brand-logo|assets\/logo\.svg"\s+width/, f);
  });
});

describe('thanh trên trang quản trị gom gọn cho điện thoại', () => {
  const html = read('Frontend/admin/index.html');
  const bar = html.slice(html.indexOf('class="topbar-actions"'), html.indexOf('</header>'));
  it('chỉ còn tối đa 4 nhóm ngoài cùng: Quản lý, Công cụ, nút chính, tài khoản', () => {
    const groups = (bar.match(/class="(?:menu-group|btn btn-primary|user-menu)\b/g) || []).length;
    assert.ok(groups <= 6 && /class="menu-group/.test(bar), String(groups));
    assert.equal((bar.match(/<details class="menu-group/g) || []).length, 2);
  });
  it('mọi nút và liên kết cũ vẫn còn đúng id/đường dẫn', () => {
    for (const id of ['visBtn', 'setPriceBtn', 'sheetSyncBtn', 'bulkModeBtn', 'sheetImageBtn', 'addProductBtn', 'logoutBtn']) assert.match(bar, new RegExp(`id="${id}"`), id);
    for (const h of ['../index.html', './orders.html', './warranty.html', './installments.html', './cashflow.html', './buyback.html']) assert.ok(bar.includes(`href="${h}"`), h);
  });
});
