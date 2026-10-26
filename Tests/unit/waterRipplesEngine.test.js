import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { WaterRipplesEngine } from '../../Frontend/js/waterRipples.js';

/** Canvas 2D giả: mọi phương thức vẽ đều là no-op, gradient có addColorStop */
function fakeContext() {
  const gradient = { addColorStop() {} };
  const target = { calls: 0 };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return () => { t.calls++; };
    },
    set(t, prop, value) { t[prop] = value; return true; }
  });
}

let raf;
let listeners;
let observers;

function installDom({ withPhone = true, reducedMotion = false, withObserver = true } = {}) {
  const ctx = fakeContext();
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const container = { getBoundingClientRect: () => ({ width: 800, height: 300, left: 0, top: 0 }) };
  const phone = { getBoundingClientRect: () => ({ left: 300, top: 20, width: 200, height: 260 }) };
  raf = { callbacks: [], cancelled: [] };
  listeners = {};
  observers = [];

  globalThis.document = {
    getElementById: id => ({ waterRipplesCanvas: canvas, waterRipplesStage: container, phoneContainer3D: withPhone ? phone : null }[id] || null)
  };
  globalThis.window = {
    innerWidth: 1024,
    devicePixelRatio: 3,
    matchMedia: () => ({ matches: reducedMotion }),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: type => { delete listeners[type]; }
  };
  globalThis.requestAnimationFrame = cb => { raf.callbacks.push(cb); return raf.callbacks.length; };
  globalThis.cancelAnimationFrame = id => { raf.cancelled.push(id); };
  if (withObserver) {
    globalThis.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; this.disconnected = false; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    };
  }
  return { ctx, canvas, container };
}

function uninstallDom() {
  for (const key of ['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver']) {
    delete globalThis[key];
  }
}

describe('WaterRipplesEngine - vòng đời, hiệu năng, giảm chuyển động', () => {
  afterEach(uninstallDom);

  it('không khởi tạo khi thiếu canvas hoặc container', () => {
    installDom();
    globalThis.document.getElementById = () => null;
    const engine = new WaterRipplesEngine();
    assert.equal(engine.ctx, undefined);
    assert.equal(raf.callbacks.length, 0);
  });

  it('resize dùng DPR tối đa 2 và căn tâm theo vị trí điện thoại', () => {
    const { canvas } = installDom();
    const engine = new WaterRipplesEngine();
    assert.equal(engine.dpr, 2);
    assert.equal(canvas.width, 1600);
    assert.equal(canvas.height, 600);
    assert.equal(engine.centerX, 400);
    assert.ok(engine.centerY >= 42 && engine.centerY <= 300 * 0.54);
  });

  it('căn tâm giữa stage khi không có điện thoại 3D', () => {
    installDom({ withPhone: false });
    const engine = new WaterRipplesEngine();
    assert.equal(engine.centerX, 400);
    assert.equal(engine.centerY, 300 * 0.42);
  });

  it('chạy vòng lặp, vẽ khung hình, sinh và loại bỏ xung sóng, kích hoạt giọt mới theo chu kỳ', () => {
    const { ctx } = installDom();
    const engine = new WaterRipplesEngine();
    assert.equal(raf.callbacks.length, 1);

    engine.pulses = [{ radius: 99, maxRadius: 100, speed: 5, intensity: 1, seed: 1, life: 0 }];
    engine.dropState.intervalTimer = engine.dropState.intervalDuration - 1;
    engine.dropState.progress = 0.9;
    engine.triggerInteractionRipple(9);
    assert.equal(engine.pulses.at(-1).intensity, 1.5);

    // Chạy nhiều khung hình để đi qua giọt rơi, hạt nảy và các nhánh vẽ
    for (let i = 0; i < 400; i++) {
      const cb = raf.callbacks.pop();
      cb();
    }
    assert.ok(ctx.calls > 100);
    assert.equal(engine.pulses.some(p => p.radius >= p.maxRadius), false);
    assert.ok(engine.waveTime > 0);
  });

  it('spawnRipple là alias của triggerInteractionRipple', () => {
    installDom();
    const engine = new WaterRipplesEngine();
    const before = engine.pulses.length;
    engine.spawnRipple(10, 10, 0.5);
    assert.equal(engine.pulses.length, before + 1);
  });

  it('tạm dừng khi ra khỏi màn hình và chạy lại khi hiện lại, không tạo hai vòng lặp', () => {
    installDom();
    const engine = new WaterRipplesEngine();
    assert.equal(observers.length, 1);

    observers[0].cb([{ isIntersecting: false }]);
    raf.callbacks.pop()(); // khung đang chờ chạy rồi dừng hẳn
    assert.equal(raf.callbacks.length, 0);

    observers[0].cb([{ isIntersecting: true }]);
    observers[0].cb([{ isIntersecting: true }]); // gọi lặp không được tạo thêm vòng lặp
    assert.equal(raf.callbacks.length, 1);
    assert.equal(engine._visible, true);
  });

  it('chế độ giảm chuyển động: vẽ một khung tĩnh và không chạy vòng lặp', () => {
    const { ctx } = installDom({ reducedMotion: true });
    const engine = new WaterRipplesEngine();
    assert.equal(engine.reducedMotion, true);
    assert.equal(raf.callbacks.length, 0);
    assert.ok(ctx.calls > 0);
    assert.equal(observers.length, 0);
  });

  it('hoạt động khi trình duyệt không có IntersectionObserver hoặc matchMedia', () => {
    installDom({ withObserver: false });
    delete globalThis.window.matchMedia;
    const engine = new WaterRipplesEngine();
    assert.equal(engine.reducedMotion, false);
    assert.equal(raf.callbacks.length, 1);
  });

  it('resize gọi lại khi cửa sổ đổi kích thước', () => {
    installDom();
    const engine = new WaterRipplesEngine();
    let resized = 0;
    engine.resize = () => { resized++; };
    listeners.resize();
    assert.equal(resized, 1);
  });

  it('destroy dừng vòng lặp, ngắt observer và gỡ listener resize', () => {
    installDom();
    const engine = new WaterRipplesEngine();
    engine.destroy();
    assert.equal(engine.running, false);
    assert.equal(raf.cancelled.length, 1);
    assert.equal(observers[0].disconnected, true);
    assert.equal(listeners.resize, undefined);
    // Gọi lại animate sau khi hủy không được lên lịch thêm khung
    const pending = raf.callbacks.length;
    engine.animate();
    assert.equal(raf.callbacks.length, pending);
    assert.doesNotThrow(() => engine.destroy());
  });
});
