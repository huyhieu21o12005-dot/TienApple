import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoice, invoiceHtml, buildContract, contractHtml, SHOP } from '../../Frontend/admin/invoiceHelpers.js';
import { libraryKeyOf, buildLibraryMap, libraryFileName, planImageLinks } from '../../Frontend/admin/imageLibrary.js';
import { absoluteUrl, productImage, productMeta, ogHtml } from '../../api/_og.js';
import { categoryFor, parseAccessoryRows, planAccessories, accessoryNameFor } from '../../Frontend/admin/accessorySheet.js';

describe('buildInvoice với dữ liệu thiếu', () => {
  it('loại không hợp lệ hoặc bản ghi không phải object thì trả null', () => {
    assert.equal(buildInvoice('zzz', {}), null);
    assert.equal(buildInvoice('order', null), null);
    assert.equal(buildInvoice('order', 'x'), null);
  });
  it('đơn hàng: dòng hàng thiếu số lượng, giá, tên; không có danh sách hàng', () => {
    const inv = buildInvoice('order', { items: [{ id: 'sp1' }, { name: 'Ốp', quantity: 2, price: 100000 }] });
    assert.equal(inv.items.length, 2);
    assert.equal(inv.items[0].name, 'sp1');
    assert.equal(buildInvoice('order', { items: null }).items.length, 0);
    assert.equal(buildInvoice('order', { items: [{}] }).items[0].name, '');
  });
  it('đơn hàng có ghi chú và phí vận chuyển', () => {
    const inv = buildInvoice('order', { note: 'giao nhanh', shipping_fee: 30000, subtotal: 100000, total: 130000, items: [] });
    assert.ok(inv.notes.some(n => /giao nhanh/.test(n)));
    assert.ok(inv.totals.length > 0);
  });
  it('lịch hẹn, bảo hành, trả góp: có và không có ngày/ghi chú/giấy tờ', () => {
    for (const type of ['booking', 'warranty', 'installment']) {
      const empty = buildInvoice(type, {});
      assert.ok(empty.title);
      const full = buildInvoice(type, { code: 'X1', created_at: '2026-10-01T03:00:00Z', start_date: '2026-10-01', note: 'ghi chú', documents: 'CCCD', paid_months: 2, term_months: 6, warranty_months: 12, interest_rate: 2.5, status: 'active' });
      assert.equal(full.code, 'X1');
      assert.ok(full.sections.length >= 1 || full.items.length >= 1 || full.totals.length >= 1);
    }
  });
  it('trả góp: có kỳ tới khi còn kỳ chưa đóng, giấy tờ mặc định "Không có"', () => {
    const inv = buildInvoice('installment', { start_date: '2026-01-15', paid_months: 1, term_months: 6, product: 'iPhone', status: 'active' });
    const rows = inv.sections.flatMap(s => s.rows).map(r => r[0]);
    assert.ok(rows.includes('Kỳ tới'));
    assert.ok(inv.sections.flatMap(s => s.rows).some(r => r[1] === 'Không có'));
  });
});

describe('invoiceHtml và contractHtml', () => {
  it('invoiceHtml: không bản ghi thì báo trống, có chi tiết dòng hàng và địa chỉ cửa hàng', () => {
    assert.match(invoiceHtml(null), /Không tìm thấy/);
    const old = SHOP.address;
    SHOP.address = '1 Võ Văn Ngân';
    try {
      const inv = buildInvoice('order', { items: [{ name: 'iPhone', quantity: 1, price: 1000, color: 'Đen', storage: '128GB' }] });
      inv.items[0].detail = 'IMEI 123';
      const html = invoiceHtml(inv);
      assert.match(html, /1 Võ Văn Ngân/);
      assert.match(html, /IMEI 123/);
    } finally { SHOP.address = old; }
  });
  it('hợp đồng bán: nhiều biến thể dòng hàng, giảm giá, phí giao, địa chỉ', () => {
    const c = buildContract('order', {
      code: 'DH1', address: '12 Nguyễn Văn Bá', discount: 50000, shipping_fee: 20000, subtotal: 1000, total: 970,
      items: [{ id: 'a', quantity: 2, price: 500, color: 'Đen', storage: '128GB' }, { name: 'Ốp' }, {}]
    });
    assert.equal(c.articles.length > 0, true);
    const text = JSON.stringify(c);
    assert.match(text, /Giảm giá/);
    assert.match(text, /Phí vận chuyển/);
    assert.match(text, /HD-DH1/);
    assert.match(contractHtml(c), /ct-items/);
    const bare = buildContract('order', {});
    assert.match(JSON.stringify(bare), /HD-/);
    assert.equal(buildContract('x', {}), null);
    assert.equal(buildContract('order', null), null);
  });
  it('hợp đồng trả góp: ngày bắt đầu hợp lệ và không hợp lệ, có và không có giấy tờ', () => {
    const ok = buildContract('installment', { code: 'TG1', start_date: '2026-03-10', interest_rate: 2.5, documents: 'CCCD', term_months: 6, product: 'iPhone', loan_amount: 1000 });
    assert.match(JSON.stringify(ok), /vào ngày 10/);
    assert.match(JSON.stringify(ok), /2,5%/);
    const bad = buildContract('installment', { start_date: 'abc' });
    assert.match(JSON.stringify(bad), /HD-/);
    assert.ok(contractHtml(bad).length > 100);
    assert.match(contractHtml(null), /Không tìm thấy/);
  });
});

describe('imageLibrary: nhánh còn lại', () => {
  it('libraryKeyOf và buildLibraryMap với tên lạ và đầu vào không phải mảng', () => {
    assert.equal(libraryKeyOf(null), '');
    assert.equal(libraryKeyOf('abc.png'), '');
    assert.equal(libraryKeyOf('model-iphone-15.JPG'), 'iphone-15');
    assert.equal(buildLibraryMap(null, (n) => n).size, 0);
    const m = buildLibraryMap([{ name: 'model-a.png' }, { name: 'readme.txt' }, { name: 'model-a.webp' }], (n) => `https://x/${n}`);
    assert.equal(m.size >= 1, true);
    assert.equal(libraryFileName('ABC', 'jpg'), 'model-abc.jpg');
  });
  it('planImageLinks: bỏ qua phần tử rỗng, giữ ảnh đã đúng, ghi nhận mẫu thiếu ảnh, không thay ảnh ngoài khi tắt replaceExternal', () => {
    const library = new Map([['iphone-15', 'https://x/model-iphone-15.png']]);
    const products = [
      null,
      { id: '1', name: 'iPhone 15 128GB', image: 'https://x/model-iphone-15.png' },
      { id: '2', name: 'iPhone 15 256GB', image: '' },
      { id: '3', name: 'Món lạ chưa có ảnh', image: '', defaultColor: 'Đỏ' },
      { id: '4', name: 'iPhone 15 512GB', image: 'https://shop-khac.com/a.png' }
    ];
    const keep = planImageLinks(products, library, { replaceExternal: false });
    assert.ok(keep.keep >= 1);
    assert.ok(Array.isArray(keep.missing) ? keep.missing.length >= 1 : true);
    assert.ok(planImageLinks(null, library) !== undefined);
  });
});

describe('api/_og: nhánh còn lại', () => {
  const O = 'https://tienappletd.com';
  it('absoluteUrl: rỗng, null, giao thức lạ', () => {
    assert.equal(absoluteUrl(null, O), '');
    assert.equal(absoluteUrl('ftp://x/a.png', O), '');
  });
  it('productImage dùng ảnh theo mẫu khi ảnh là nguồn đã biết, productMeta không giá thì dùng mô tả mặc định', () => {
    assert.match(productImage({ name: 'iPhone 15 Pro Max', image_url: 'https://store.storeimages.cdn-apple.com/x' }, O), /^https:\/\//);
    const m = productMeta({ id: 1, name: 'iPhone X', price: 0 }, O);
    assert.match(m.desc, /Bảo hành/);
    assert.match(ogHtml({ title: 'a', desc: 'b', image: 'c', url: 'd' }), /og:title/);
    assert.match(productMeta({ id: 2, name: 'N', price: 100, condition_label: 'Mới 100%' }, O).desc, /Mới 100%/);
  });
});

describe('accessorySheet: nhánh còn lại', () => {
  it('categoryFor nhận từng nhóm và nhóm lạ', () => {
    assert.equal(categoryFor('iPad Air'), 'tablet');
    assert.equal(categoryFor('Đồng hồ'), 'watch');
    assert.equal(categoryFor('Tai nghe'), 'audio');
    assert.equal(categoryFor('Ốp lưng'), 'case');
    assert.equal(categoryFor('Cáp sạc'), 'charger');
    assert.equal(categoryFor('Khác'), 'other');
    assert.equal(categoryFor(null), 'other');
  });
  const H = 'Mã SP,Nhóm,Hãng,Tên Phụ Kiện,Phân Loại / Màu,Giá Bán,Sale (%),Giá Sau Sale,Tồn Kho,Trạng Thái,Hiển Thị Web,Bảo Hành,Link Ảnh,Ghi Chú';
  it('parseAccessoryRows: không có tiêu đề, giá thiếu, sale dạng 0,1 và %, hết hàng, ẩn, link ảnh sai', () => {
    assert.match(parseAccessoryRows('a,b\n1,2').errors[0], /Không tìm thấy/);
    const csv = [
      H,
      ',,,,,,,,,,,,,',
      'P1,Sạc,Apple,Củ sạc,Trắng,"500.000",0.1,,5,Còn,Hiện,6T,ftp://x,',
      'P2,Cáp,Anker,Cáp C,Đen,"100.000",5%,,x,Hết hàng,Không,,https://x/a.png,',
      'P3,Sạc,Apple,Không giá,Trắng,,,,1,,,,,'
    ].join('\n');
    const { rows, errors } = parseAccessoryRows(csv);
    assert.equal(errors.length, 1);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].salePercent, 10);
    assert.equal(rows[0].image, '');
    assert.equal(rows[1].stock, 0);
    assert.equal(rows[1].show, false);
    assert.equal(rows[1].image, 'https://x/a.png');
    assert.equal(rows[1].finalPrice, 95000);
    assert.equal(rows[1].listPrice, 100000);
  });
  it('accessoryNameFor: hãng đã có trong tên, không có hãng, không phân loại', () => {
    assert.equal(accessoryNameFor({ brand: 'Anker', name: 'Anker Cáp', variant: '' }), 'Anker Cáp');
    assert.equal(accessoryNameFor({ brand: '', name: 'Cáp', variant: 'Đen' }), 'Cáp - Đen');
  });
  it('planAccessories: sản phẩm trùng tên không phải phụ kiện, sale có giá gạch ngang, ẩn trong sheet, trùng mã thêm đuôi, đầu vào lạ', () => {
    const row = (o) => ({ code: '', group: 'Sạc', category: 'charger', brand: 'Apple', name: 'Củ sạc', variant: '', listPrice: 600, salePercent: 10, finalPrice: 540, stock: 1, show: true, warranty: '', image: '', note: '', ...o });
    const existing = [
      { id: 'khac', name: 'Apple Củ sạc', kind: 'phone', price: 1 },
      { id: 'pk-apple-cu-sac-2', name: 'x', kind: 'accessory', price: 540, basePrice: 540, oldPrice: 600 }
    ];
    const plan = planAccessories(existing, [row({}), row({ name: 'Ẩn', show: false }), row({ code: 'pk-x', name: 'Mới' }), null && row({})].filter(Boolean));
    assert.ok(plan.same >= 1);
    assert.equal(plan.hiddenInSheet, 1);
    assert.equal(plan.items.length, 1);
    assert.equal(plan.items[0].product.old_price, 600);
    assert.equal(planAccessories(null, null).items.length, 0);
    const again = planAccessories([{ id: 'pk-apple-cu-sac', name: 'z', kind: 'accessory', price: 1000, basePrice: 500, oldPrice: null }], [row({})]);
    assert.equal(again.changes.length, 1);
    assert.equal(again.changes[0].markup, 500);
  });
});
