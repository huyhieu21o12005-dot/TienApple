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
  it('mã JS/CSS lưu đệm ngắn nhưng có stale-while-revalidate để vào lại nhanh', () => {
    for (const p of ['/js/app.js', '/css/style.css', '/js/three.min.js']) {
      assert.match(cacheFor(p), /stale-while-revalidate/, p);
    }
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
