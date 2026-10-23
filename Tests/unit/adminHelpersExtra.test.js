import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrency,
  parseCurrency,
  isNegativeInput,
  toInt,
  slugify,
  validateProduct,
  applyBulkDiscount,
  mapDbToProduct,
  mapProductToDb,
  resizeImage
} from '../../Frontend/admin/adminHelpers.js';

const valid = { id: 'ip-16', name: 'iPhone 16', kind: 'phone', price: 1000000 };

describe('adminHelpers - định dạng và chuyển đổi số', () => {
  it('formatCurrency xử lý số, chuỗi, số âm, rác', () => {
    assert.match(formatCurrency(28990000), /28\.990\.000đ/);
    assert.match(formatCurrency('1500000'), /1\.500\.000đ/);
    assert.equal(formatCurrency(-5), '0đ');
    assert.equal(formatCurrency('abc'), '0đ');
    assert.equal(formatCurrency(undefined), '0đ');
  });

  it('parseCurrency xử lý chuỗi có ký hiệu, số, rác', () => {
    assert.equal(parseCurrency('28.990.000đ'), 28990000);
    assert.equal(parseCurrency(1234.6), 1235);
    assert.equal(parseCurrency(-10), 0);
    assert.equal(parseCurrency(''), 0);
    assert.equal(parseCurrency('abc'), 0);
    assert.equal(parseCurrency(null), 0);
    assert.equal(parseCurrency({}), 0);
  });

  it('isNegativeInput và toInt', () => {
    assert.equal(isNegativeInput(-1), true);
    assert.equal(isNegativeInput(' -500.000'), true);
    assert.equal(isNegativeInput('500.000'), false);
    assert.equal(isNegativeInput(null), false);
    assert.equal(toInt('12abc'), 12);
    assert.equal(toInt('abc'), 0);
    assert.equal(toInt(undefined, 7), 7);
  });

  it('slugify bỏ dấu tiếng Việt và ký tự đặc biệt', () => {
    assert.equal(slugify('Điện thoại Ốp lưng MagSafe!'), 'dien-thoai-op-lung-magsafe');
    assert.equal(slugify('  --iPhone  16 Pro Max--  '), 'iphone-16-pro-max');
    assert.equal(slugify(''), '');
    assert.equal(slugify(null), '');
  });
});

describe('adminHelpers - validateProduct', () => {
  it('chấp nhận sản phẩm hợp lệ', () => {
    assert.deepEqual(validateProduct(valid), { valid: true, errors: [] });
  });

  it('từ chối dữ liệu rỗng hoặc sai kiểu', () => {
    assert.equal(validateProduct(null).valid, false);
    assert.equal(validateProduct('x').valid, false);
  });

  it('bắt buộc tên, id slug (khi tạo mới) và kind', () => {
    const r = validateProduct({ name: ' ', id: 'Sai ID', kind: 'xe' });
    assert.equal(r.valid, false);
    assert.equal(r.errors.length, 3);
    // Khi sửa không kiểm tra id
    const edit = validateProduct({ name: 'A', kind: 'phone', price: 1 }, true);
    assert.equal(edit.valid, true);
  });

  it('từ chối giá âm dù nhập chuỗi hay số (không âm thầm đổi thành dương)', () => {
    assert.equal(validateProduct({ ...valid, price: -100 }).valid, false);
    assert.equal(validateProduct({ ...valid, price: '-100.000' }).valid, false);
    assert.equal(validateProduct({ ...valid, old_price: '-5' }).valid, false);
  });

  it('giá gốc phải >= giá bán', () => {
    assert.equal(validateProduct({ ...valid, old_price: 500000 }).valid, false);
    assert.equal(validateProduct({ ...valid, old_price: 1500000 }).valid, true);
    assert.equal(validateProduct({ ...valid, old_price: '' }).valid, true);
    assert.equal(validateProduct({ ...valid, old_price: null }).valid, true);
  });

  it('tồn kho phải là số nguyên không âm', () => {
    assert.equal(validateProduct({ ...valid, stock: -1 }).valid, false);
    assert.equal(validateProduct({ ...valid, stock: 'abc' }).valid, false);
    assert.equal(validateProduct({ ...valid, stock: '5' }).valid, true);
    assert.equal(validateProduct({ ...valid, stock: '' }).valid, true);
  });

  it('kiểm tra mã màu hex và tình trạng', () => {
    assert.equal(validateProduct({ ...valid, colors: [{ name: 'Đỏ', hex: 'red' }] }).valid, false);
    assert.equal(validateProduct({ ...valid, colors: [{ name: 'Đỏ', hex: '#f00' }, null] }).valid, true);
    assert.equal(validateProduct({ ...valid, condition: 'broken' }).valid, false);
    assert.equal(validateProduct({ ...valid, condition: 'like_new' }).valid, true);
  });
});

describe('adminHelpers - giảm giá hàng loạt và ánh xạ DB', () => {
  it('applyBulkDiscount làm tròn 10.000đ và chặn biên', () => {
    assert.equal(applyBulkDiscount(28990000, 10), 26090000);
    assert.equal(applyBulkDiscount(1000000, 0), 1000000);
    assert.equal(applyBulkDiscount(1000000, 100), 0);
    assert.equal(applyBulkDiscount(1000000, 150), 0);
    assert.equal(applyBulkDiscount(1000000, -5), 1000000);
    assert.equal(applyBulkDiscount(1000000, 'abc'), 1000000);
    assert.equal(applyBulkDiscount(-5, 10), 0);
  });

  it('mapDbToProduct giữ đánh giá 0 (không đổi thành 5), mặc định hợp lý khi thiếu', () => {
    assert.equal(mapDbToProduct(null), null);
    const p = mapDbToProduct({ id: 'a', name: 'A', rating: 0, price: '100', brand: 'apple', condition: 'like_new', colors: [{ name: 'Đen', hex: '#000' }] });
    assert.equal(p.rating, 0);
    assert.equal(p.condition, 'likenew');
    assert.equal(p.conditionLabel, 'Like New 99%');
    assert.equal(p.brandName, 'Apple iPhone');
    assert.equal(p.defaultColor, 'Đen');
    assert.equal(p.price, 100);
    assert.equal(p.oldPrice, undefined);

    const q = mapDbToProduct({ id: 'b', name: 'B', rating: null, old_price: 200, image_url: 'x', is_visible: false });
    assert.equal(q.rating, 5);
    assert.equal(q.oldPrice, 200);
    assert.equal(q.image, 'x');
    assert.equal(q.is_visible, false);
    assert.equal(q.kind, 'phone');
    assert.deepEqual(q.colors, []);
  });

  it('mapProductToDb không sinh NaN và nhận cả camelCase lẫn snake_case', () => {
    assert.equal(mapProductToDb(null), null);
    const db = mapProductToDb({ id: 'a', name: 'A', category: 'case', stock: 'abc', sort_order: 'x', reviewCount: 'zz', rating: 'n/a', price: '1.000đ', old_price: '2.000đ', condition: 'likenew' });
    assert.equal(db.kind, 'accessory');
    assert.equal(db.stock, 0);
    assert.equal(db.sort_order, 0);
    assert.equal(db.review_count, 0);
    assert.equal(db.rating, 5);
    assert.equal(db.price, 1000);
    assert.equal(db.old_price, 2000);
    assert.equal(db.condition, 'like_new');
    assert.equal(db.is_visible, true);
    const neg = mapProductToDb({ id: 'b', name: 'B', stock: -4, oldPrice: '' });
    assert.equal(neg.stock, 0);
    assert.equal(neg.old_price, null);
  });
});

describe('adminHelpers - resizeImage', () => {
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.FileReader;
    delete globalThis.Image;
  });

  it('trả về file gốc khi chạy ngoài trình duyệt', async () => {
    const file = { type: 'image/png' };
    assert.equal(await resizeImage(file), file);
  });

  function installBrowser({ blob, failImage = false }) {
    const drawn = {};
    globalThis.window = {};
    globalThis.document = {
      createElement: () => ({
        getContext: () => ({ drawImage: (...a) => { drawn.args = a; } }),
        toBlob(cb, mime, q) { drawn.mime = mime; drawn.quality = q; cb(blob); }
      })
    };
    globalThis.FileReader = class {
      readAsDataURL() { this.onload({ target: { result: 'data:image/png;base64,AAA' } }); }
    };
    globalThis.Image = class {
      set src(_) { failImage ? this.onerror(new Error('bad')) : (this.width = 2400, this.height = 1200, this.onload()); }
    };
    return drawn;
  }

  it('thu nhỏ về tối đa 1200px và nén ảnh', async () => {
    const out = { size: 1 };
    const drawn = installBrowser({ blob: out });
    const result = await resizeImage({ type: 'image/jpeg' }, 1200, 0.8);
    assert.equal(result, out);
    assert.equal(drawn.mime, 'image/jpeg');
    assert.equal(drawn.quality, 0.8);
    assert.deepEqual(drawn.args.slice(1), [0, 0, 1200, 600]);
  });

  it('giữ PNG và quay về file gốc nếu toBlob trả null', async () => {
    const drawn = installBrowser({ blob: null });
    const file = { type: 'image/png' };
    assert.equal(await resizeImage(file), file);
    assert.equal(drawn.mime, 'image/png');
  });

  it('từ chối khi ảnh không đọc được', async () => {
    installBrowser({ blob: null, failImage: true });
    await assert.rejects(() => resizeImage({ type: 'image/jpeg' }));
  });
});
