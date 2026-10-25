import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadScriptsInOrder, whenPageIdle } from '../../Frontend/js/lazyScripts.js';

/** document giả: script được gắn vào head sẽ tự gọi onload (hoặc onerror nếu src chứa "hong") ở lượt sau */
function fakeDoc() {
  const attached = [];
  const log = [];
  return {
    attached, log,
    createElement: () => ({ setAttribute() {}, set src(v) { this._src = v; }, get src() { return this._src; } }),
    head: { appendChild(el) { attached.push(el.src); log.push(`gắn ${el.src}`); queueMicrotask(() => { if (/hong/.test(el.src)) el.onerror?.(new Error('lỗi')); else { log.push(`xong ${el.src}`); el.onload?.(); } }); } }
  };
}

describe('loadScriptsInOrder', () => {
  it('nạp lần lượt từng script, script sau chỉ gắn khi script trước đã chạy xong', async () => {
    const doc = fakeDoc();
    const order = [];
    await loadScriptsInOrder(['a.js', 'b.js'], { doc, onEach: (s) => order.push(s) });
    assert.deepEqual(doc.log, ['gắn a.js', 'xong a.js', 'gắn b.js', 'xong b.js']);
    assert.deepEqual(order, ['a.js', 'b.js']);
  });
  it('không nạp lại script đã có (gọi hai lần dùng chung một lượt tải)', async () => {
    const doc = fakeDoc();
    const a = loadScriptsInOrder(['x.js'], { doc });
    const b = loadScriptsInOrder(['x.js'], { doc });
    await Promise.all([a, b]);
    assert.deepEqual(doc.attached, ['x.js']);
  });
  it('script lỗi thì từ chối và không nạp tiếp các script sau', async () => {
    const doc = fakeDoc();
    await assert.rejects(loadScriptsInOrder(['hong.js', 'sau.js'], { doc }));
    assert.deepEqual(doc.attached, ['hong.js']);
  });
});

describe('whenPageIdle', () => {
  it('chạy ngay khi trang đã tải xong và trình duyệt rảnh', async () => {
    let ran = 0;
    const win = { document: { readyState: 'complete' }, requestIdleCallback: (fn) => fn(), addEventListener() {} };
    whenPageIdle(() => ran++, { win });
    assert.equal(ran, 1);
  });
  it('chờ sự kiện load khi trang chưa tải xong, dùng setTimeout nếu không có requestIdleCallback', async () => {
    let ran = 0; let loadHandler;
    const win = { document: { readyState: 'loading' }, addEventListener: (ev, fn) => { if (ev === 'load') loadHandler = fn; }, setTimeout: (fn) => fn() };
    whenPageIdle(() => ran++, { win });
    assert.equal(ran, 0);
    loadHandler();
    assert.equal(ran, 1);
  });
  it('chỉ chạy một lần dù load bắn nhiều lần', () => {
    let ran = 0; let loadHandler;
    const win = { document: { readyState: 'loading' }, addEventListener: (ev, fn) => { loadHandler = fn; }, requestIdleCallback: (fn) => fn() };
    whenPageIdle(() => ran++, { win });
    loadHandler(); loadHandler();
    assert.equal(ran, 1);
  });
});
