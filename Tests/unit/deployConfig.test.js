import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const routes = cfg.routes;
const cacheFor = (path) => {
  for (const r of routes) {
    if (r.handle) continue;
    if (new RegExp(`^${r.src}$`).test(path) && r.headers?.['Cache-Control']) return r.headers['Cache-Control'];
  }
  return '';
};

describe('vercel.json: lưu đệm và định tuyến', () => {
  it('ảnh, mô hình 3D và biểu tượng được lưu đệm lâu', () => {
    for (const p of ['/assets/og-logo.jpg', '/assets/models/ipadpro97inch.png', '/models/iphone_18_pro_max.glb', '/assets/icons/zalo.svg']) {
      assert.match(cacheFor(p), /max-age=(\d{7,})/, p);
      assert.match(cacheFor(p), /immutable|stale-while-revalidate/, p);
    }
  });
  it('mã JS/CSS luôn hỏi lại máy chủ (304 nếu không đổi) để bản mới hiện ngay, không kẹt bản cũ trong bộ nhớ đệm', () => {
    for (const p of ['/js/app.js', '/js/store.js', '/css/style.css', '/css/tailwind.css', '/js/three.min.js']) {
      assert.match(cacheFor(p), /max-age=0/, p);
      assert.match(cacheFor(p), /must-revalidate/, p);
    }
  });
  it('trang liên kết css và app.js kèm ?v= để máy đang giữ bản cũ tải lại ngay', () => {
    for (const f of ['Frontend/index.html', 'Frontend/product.html']) {
      const h = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
      assert.match(h, /href="css\/style\.css\?v=\w+"/, f);
      assert.match(h, /href="css\/tailwind\.css\?v=\w+"/, f);
    }
    assert.match(readFileSync(new URL('../../Frontend/index.html', import.meta.url), 'utf8'), /src="js\/app\.js\?v=\w+"/);
  });
  it('trang HTML không bị lưu đệm cứng để cập nhật hiện ngay', () => {
    assert.equal(cacheFor('/index.html'), '');
    assert.equal(cacheFor('/product.html'), '');
  });
  it('bot chia sẻ link vẫn được định tuyến trước bước đọc file, và có bước filesystem', () => {
    const iBot = routes.findIndex(r => r.dest === '/api/product-og');
    const iFs = routes.findIndex(r => r.handle === 'filesystem');
    assert.ok(iBot >= 0 && iFs > iBot);
  });
});
