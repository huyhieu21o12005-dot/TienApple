import test from 'node:test';
import assert from 'node:assert/strict';
import { WaterRipplesEngine } from '../../Frontend/js/waterRipples.js';

test('Tien Mobile - Water Ripples Engine & 3D Lighting Suite', async (t) => {
  await t.test('1. WaterRipplesEngine class structure & undulating wave methods', () => {
    assert.strictEqual(typeof WaterRipplesEngine, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.spawnRipple, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.triggerInteractionRipple, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.updateCenterPosition, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.drawUndulatingWavefronts, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.drawWaveRowPath, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.drawCenterDepression, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.drawPhoneReflection, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.drawCircularRipples, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.drawWaterBackground, 'function');
    assert.strictEqual(typeof WaterRipplesEngine.prototype.drawSingleRippleCircle, 'function');
  });

  await t.test('2. Water ripples configuration & perspective wave pulses', () => {
    const dummyEngine = Object.create(WaterRipplesEngine.prototype);
    dummyEngine.pulses = [];
    dummyEngine.centerX = 200;
    dummyEngine.centerY = 40;
    dummyEngine.width = 600;

    dummyEngine.triggerInteractionRipple(1.2);
    assert.strictEqual(dummyEngine.pulses.length, 1);
    
    const p = dummyEngine.pulses[0];
    assert.strictEqual(p.radius, 0);
    assert.strictEqual(p.speed, 1.6);
    assert.strictEqual(p.intensity, 1.2);
    assert.ok(p.maxRadius >= 390);
  });

  await t.test('3. Interaction ripple trigger smoothly limits intensity', () => {
    const dummyEngine = Object.create(WaterRipplesEngine.prototype);
    dummyEngine.pulses = [];
    dummyEngine.centerX = 300;
    dummyEngine.centerY = 45;
    dummyEngine.width = 800;

    dummyEngine.triggerInteractionRipple(2.5); // Excessive intensity
    assert.strictEqual(dummyEngine.pulses.length, 1);
    assert.strictEqual(dummyEngine.pulses[0].intensity, 1.5, 'Intensity should clamp to 1.5');
  });

  await t.test('4. Circular water ripples engine methods execution without canvas error', () => {
    const dummyEngine = Object.create(WaterRipplesEngine.prototype);
    const mockCtxCalls = [];
    dummyEngine.ctx = {
      save: () => mockCtxCalls.push('save'),
      restore: () => mockCtxCalls.push('restore'),
      beginPath: () => mockCtxCalls.push('beginPath'),
      arc: (cx, cy, r) => mockCtxCalls.push(`arc:${cx},${cy},${r.toFixed(1)}`),
      ellipse: (cx, cy, rx, ry) => mockCtxCalls.push(`arc:${cx},${cy},${rx.toFixed(1)}`),
      stroke: () => mockCtxCalls.push('stroke'),
      fill: () => mockCtxCalls.push('fill'),
      fillRect: () => mockCtxCalls.push('fillRect'),
      clearRect: () => mockCtxCalls.push('clearRect'),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} })
    };
    dummyEngine.centerX = 250;
    dummyEngine.centerY = 350;
    dummyEngine.width = 500;
    dummyEngine.height = 400;
    dummyEngine.waveTime = 1.0;
    dummyEngine.pulses = [];

    // Verify circular ripples draw concentric circles
    dummyEngine.drawSingleRippleCircle(250, 350, 60, 0.8, false);
    assert.ok(mockCtxCalls.some(c => c.startsWith('arc:250,350')));

    // Verify background gradient/clean execution
    dummyEngine.drawWaterBackground();
    assert.ok(mockCtxCalls.includes('clearRect') || mockCtxCalls.includes('fillRect'));
  });
});
