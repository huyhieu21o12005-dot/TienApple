/**
 * Tien Mobile - Natural Water Drop Ripple Engine (Mô phỏng giọt nước rơi tạo gợn nước tự nhiên)
 * - Bỏ hoàn toàn các vạch gạch ngang ở nước
 * - Giọt nước rơi từ chân máy 18 Pro Max xuống mặt nước tạo ra các gợn sóng lan tỏa
 * - Gợn nước uốn lượn hữu cơ tự nhiên (Organic fluid ripples), KHÔNG phải hình tròn hình học cứng nhắc
 * - Đầy đủ hiệu ứng khúc xạ chất lỏng: vệt sáng phản quang trắng, ánh lam ngọc và rãnh nước mềm mại
 */

export class WaterRipplesEngine {
  constructor(canvasId = 'waterRipplesCanvas', containerId = 'waterRipplesStage') {
    this.canvas = document.getElementById(canvasId);
    this.container = document.getElementById(containerId);
    if (!this.canvas || !this.container) return;

    this.ctx = this.canvas.getContext('2d');
    this.waveTime = 0;
    this.pulses = []; // Dynamic organic wave packets from drop impacts

    // Hệ thống mô phỏng giọt nước rơi (Falling Water Droplet)
    this.dropState = {
      active: true,
      y: 0,
      progress: 0,
      speed: 0.015,
      intervalTimer: 0,
      intervalDuration: 220 // ~3.6s mỗi lần giọt nước rơi
    };

    // Hạt nước nảy nhẹ sau khi giọt rơi (Rebound bead)
    this.reboundState = {
      active: false,
      progress: 0
    };

    this.running = true;
    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Khởi tạo sẵn một xung gợn nước đang lan tỏa nhẹ để mặt nước có sức sống tự nhiên ngay khi mở trang
    this.pulses.push({
      radius: 80,
      maxRadius: Math.max(this.width * 0.65, 460),
      speed: 1.6,
      intensity: 0.65,
      seed: 28.5,
      life: 50
    });

    // Kích hoạt giọt nước đầu tiên rơi
    this.triggerDrop();

    // Vòng lặp animation
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || window.innerWidth;
    this.height = rect.height || 260;

    // Hỗ trợ màn hình Retina sắc nét
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    this.updateCenterPosition();
  }

  // Căn chỉnh điểm rơi giọt nước ngay dưới chân 18 Pro Max
  updateCenterPosition() {
    const phoneContainer = document.getElementById('phoneContainer3D') || document.getElementById('phone3DCanvasWrap');
    if (phoneContainer && this.container) {
      const pRect = phoneContainer.getBoundingClientRect();
      const sRect = this.container.getBoundingClientRect();

      // Tâm X trùng trục đứng giữa của 18 Pro Max
      this.centerX = (pRect.left + pRect.width / 2) - sRect.left;

      // Khoảng cách từ chân máy tới mặt nước trong stage 1/3 dưới
      // Tăng thêm khoảng cách 14px (trong dải 5-20px theo yêu cầu) để bố cục thoáng đãng, hài hòa tự nhiên
      const phoneBottomInStage = (pRect.top + pRect.height * 0.74) - sRect.top;
      const extraGap = 14; 
      const naturalGap = Math.max(38, Math.min(58, this.height * 0.16)) + extraGap;
      this.centerY = Math.max(42, Math.min(this.height * 0.54, phoneBottomInStage + naturalGap));
    } else {
      this.centerX = this.width / 2;
      this.centerY = this.height * 0.42;
    }
  }

  // Kích hoạt giọt nước rơi từ chân máy xuống mặt nước
  triggerDrop() {
    this.dropState.active = true;
    this.dropState.progress = 0;
  }

  // Kích hoạt xung sóng lan tỏa từ điểm rơi giọt nước
  triggerInteractionRipple(intensity = 1.0) {
    const clampedIntensity = Math.min(intensity, 1.5);
    this.pulses.push({
      radius: 0,
      maxRadius: Math.max(this.width * 0.65, 460),
      speed: 1.6,
      intensity: clampedIntensity,
      seed: Math.random() * 100, // Biến thiên ngẫu nhiên cho từng giọt nước
      life: 0
    });
  }

  // Alias tương thích ngược
  spawnRipple(x, y, intensity = 1.0) {
    this.triggerInteractionRipple(intensity);
  }

  animate() {
    if (!this.running) return;
    requestAnimationFrame(this.animate);

    this.waveTime += 0.018;

    // 1. Nền nước hoàn toàn trong suốt - không vẽ vạch gạch ngang, không vẽ màu nền background
    if (this.ctx && typeof this.ctx.clearRect === 'function') {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }

    // 2. Cột sáng phản chiếu nhẹ từ chân 18 Pro Max xuống mặt nước
    this.drawPhoneReflection();

    // 3. Cập nhật và vẽ giọt nước đang rơi xuống (Falling Water Droplet)
    this.updateAndDrawFallingDrop();

    // 4. Vẽ hạt nước nảy nhẹ sau khi giọt rơi (Rebound bead)
    this.updateAndDrawReboundBead();

    // 5. Cập nhật các chùm sóng gợn nước
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.radius += p.speed;
      p.life++;
      if (p.radius >= p.maxRadius) {
        this.pulses.splice(i, 1);
      }
    }

    // 6. Vẽ các gợn nước hữu cơ tự nhiên (Organic Fluid Ripples)
    this.drawCircularRipples();

    // 7. Tâm chấn giọt nước mềm mại
    this.drawCenterDepression();

    // Bộ đếm chu kỳ giọt nước rơi tự nhiên tiếp theo (~3.6s một lần)
    this.dropState.intervalTimer++;
    if (this.dropState.intervalTimer >= this.dropState.intervalDuration) {
      this.dropState.intervalTimer = 0;
      this.triggerDrop();
    }
  }

  // Cập nhật và vẽ giọt nước rơi từ chân máy xuống mặt hồ
  updateAndDrawFallingDrop() {
    if (!this.dropState.active) return;
    if (!this.ctx || typeof this.ctx.beginPath !== 'function') return;

    this.dropState.progress += this.dropState.speed;
    const prog = this.dropState.progress;

    const startY = Math.max(4, this.centerY - 68);
    const targetY = this.centerY;
    // Gia tốc trọng trường tự nhiên: pow(prog, 1.8)
    const currentY = startY + (targetY - startY) * Math.pow(prog, 1.8);

    if (prog >= 1.0) {
      // Giọt nước chạm mặt nước -> tạo gợn sóng lan tỏa và kích hoạt hạt nảy
      this.dropState.active = false;
      this.triggerInteractionRipple(1.15);
      this.reboundState.active = true;
      this.reboundState.progress = 0;
      return;
    }

    // Vẽ hình dáng giọt nước tự nhiên (Teardrop shape)
    this.ctx.save();
    const cx = this.centerX;
    const dropAlpha = Math.min(1.0, prog * 2.2);

    // Thân giọt nước hình giọt lệ tự nhiên (thuôn dài theo gia tốc rơi)
    this.ctx.beginPath();
    const dropW = 2.2 + (1.0 - prog) * 1.2;
    const dropH = 4.5 + prog * 4.5;
    this.ctx.moveTo(cx, currentY - dropH);
    this.ctx.bezierCurveTo(cx - dropW, currentY - dropH * 0.25, cx - dropW, currentY, cx, currentY);
    this.ctx.bezierCurveTo(cx + dropW, currentY, cx + dropW, currentY - dropH * 0.25, cx, currentY - dropH);
    this.ctx.closePath();

    // Gradient giọt nước: lõi trắng phản quang pha sắc lam ngọc trong suốt
    const dropGrad = this.ctx.createLinearGradient(cx, currentY - dropH, cx, currentY);
    dropGrad.addColorStop(0, `rgba(255, 255, 255, ${dropAlpha})`);
    dropGrad.addColorStop(0.4, `rgba(220, 242, 255, ${(dropAlpha * 0.88).toFixed(2)})`);
    dropGrad.addColorStop(0.85, `rgba(180, 222, 252, ${(dropAlpha * 0.70).toFixed(2)})`);
    dropGrad.addColorStop(1.0, `rgba(140, 200, 245, ${(dropAlpha * 0.50).toFixed(2)})`);

    this.ctx.fillStyle = dropGrad;
    this.ctx.fill();

    // Điểm sáng lóa tinh xảo ở đỉnh giọt nước
    this.ctx.beginPath();
    this.ctx.arc(cx - 0.7, currentY - dropH * 0.45, 1.1, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(255, 255, 255, ${(dropAlpha * 0.95).toFixed(2)})`;
    this.ctx.fill();

    this.ctx.restore();
  }

  // Hạt nước nhỏ nảy lên sau va chạm của giọt nước (Capillary Rebound Bead)
  updateAndDrawReboundBead() {
    if (!this.reboundState.active) return;
    if (!this.ctx || typeof this.ctx.beginPath !== 'function') return;

    this.reboundState.progress += 0.045;
    const prog = this.reboundState.progress;

    if (prog >= 1.0) {
      this.reboundState.active = false;
      return;
    }

    // 1. Vòng gợn vi mô tức thời tại điểm chạm (Impact micro-ring caustics)
    if (prog < 0.65) {
      const ringProg = prog / 0.65;
      const ringR = 4 + ringProg * 16;
      const ringAlpha = (1.0 - ringProg) * 0.8;
      this.ctx.save();
      this.ctx.beginPath();
      if (typeof this.ctx.ellipse === 'function') {
        this.ctx.ellipse(this.centerX, this.centerY, ringR, ringR * 0.28, 0, 0, Math.PI * 2);
      } else if (typeof this.ctx.arc === 'function') {
        this.ctx.arc(this.centerX, this.centerY, ringR, 0, Math.PI * 2);
      }
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha.toFixed(2)})`;
      this.ctx.lineWidth = 1.6;
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 2. Hạt nước nảy lên theo quỹ đạo parabol (Rebound Bead)
    const maxHeight = 13;
    const beadY = this.centerY - Math.sin(prog * Math.PI) * maxHeight;
    const beadAlpha = Math.sin(prog * Math.PI) * 0.90;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.centerX, beadY, 2.0, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(255, 255, 255, ${beadAlpha.toFixed(2)})`;
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(this.centerX, beadY, 2.6, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(200, 235, 255, ${(beadAlpha * 0.6).toFixed(2)})`;
    this.ctx.lineWidth = 0.8;
    this.ctx.stroke();

    this.ctx.restore();
  }

  // 1. Phản chiếu chân máy 18 Pro Max mờ ảo tự nhiên ở khoảng trống
  drawPhoneReflection() {
    this.ctx.save();
    const cx = this.centerX;
    const cy = this.centerY;
    const reflW = Math.min(85, this.width * 0.14);
    const reflH = Math.max(34, this.height * 0.32);

    const reflGrad = this.ctx.createRadialGradient(cx, cy - 10, 2, cx, cy - 10, reflW);
    reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    reflGrad.addColorStop(0.4, 'rgba(215, 238, 255, 0.22)');
    reflGrad.addColorStop(0.7, 'rgba(95, 25, 45, 0.04)');
    reflGrad.addColorStop(1.0, 'transparent');

    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy - 10, reflW, reflH * 0.48, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy - 10, reflW, 0, Math.PI * 2);
    }
    this.ctx.fillStyle = reflGrad;
    this.ctx.fill();

    this.ctx.restore();
  }

  // 2. Chỗ lõm chất lỏng mềm mại tại điểm giọt nước rơi
  drawCenterDepression() {
    this.ctx.save();
    const cx = this.centerX;
    const cy = this.centerY;
    const dipW = 38;
    const dipH = dipW * 0.28;

    const dipGrad = this.ctx.createRadialGradient(cx, cy, 1, cx, cy, dipW);
    dipGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    dipGrad.addColorStop(0.4, 'rgba(200, 235, 255, 0.25)');
    dipGrad.addColorStop(0.8, 'rgba(165, 215, 250, 0.08)');
    dipGrad.addColorStop(1.0, 'transparent');

    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy, dipW, dipH, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy, dipW, 0, Math.PI * 2);
    }
    this.ctx.fillStyle = dipGrad;
    this.ctx.fill();

    this.ctx.restore();
  }

  // Bỏ hoàn toàn các vạch sóng ngang theo yêu cầu: "tôi cần bỏ gạch ngang ở nước"
  // Giữ phương thức rỗng để tương thích ngược với unit test suite
  drawUndulatingWavefronts() {
    // Intentionally no horizontal bar lines
  }

  drawWaveRowPath(points, rowAlpha, depthRatio) {
    // Kept for backward compatibility with test suite
  }

  // Nền trong suốt
  drawWaterBackground() {
    if (this.ctx && typeof this.ctx.clearRect === 'function') {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  // 6. Vẽ các gợn nước hữu cơ tự nhiên (Organic Fluid Ripples) lan tỏa từ giọt nước rơi
  drawCircularRipples() {
    const cx = this.centerX;
    const cy = this.centerY;

    // Duyệt qua tất cả các chùm gợn nước sinh ra từ các giọt nước rơi
    for (let i = 0; i < this.pulses.length; i++) {
      const p = this.pulses[i];
      const pProg = Math.min(1.0, p.radius / p.maxRadius);
      const pFadeIn = Math.min(1.0, p.radius / 28);
      const pFadeOut = Math.pow(1.0 - pProg, 1.4);
      const pAlpha = pFadeIn * pFadeOut * p.intensity;

      if (pAlpha > 0.01 && p.radius >= 8) {
        // Gợn sóng chính (Primary organic wavefront)
        this.drawOrganicRippleWave(cx, cy, p.radius, pAlpha * 1.1, p.seed);

        // Gợn sóng thứ cấp nối tiếp sau (Secondary trailing wavefront)
        if (p.radius > 26) {
          this.drawOrganicRippleWave(cx, cy, p.radius - 22, pAlpha * 0.65, p.seed + 12);
        }

        // Gợn sóng nhẹ thứ ba (Tertiary capillary wavelet)
        if (p.radius > 50) {
          this.drawOrganicRippleWave(cx, cy, p.radius - 44, pAlpha * 0.38, p.seed + 24);
        }

        // Gợn sóng nhẹ thứ tư (Quaternary trailing wavelet)
        if (p.radius > 76) {
          this.drawOrganicRippleWave(cx, cy, p.radius - 68, pAlpha * 0.18, p.seed + 36);
        }
      }
    }
  }

  // Vẽ 1 gợn sóng nước hữu cơ tự nhiên với độ uốn lượn biến thiên mềm mại (KHÔNG phải hình tròn cứng nhắc)
  drawOrganicRippleWave(cx, cy, radius, alpha, seed = 0) {
    if (!this.ctx || typeof this.ctx.beginPath !== 'function') return;
    if (typeof this.ctx.moveTo !== 'function' || typeof this.ctx.quadraticCurveTo !== 'function') return;

    this.ctx.save();

    // Biến thiên hữu cơ tự nhiên: bán kính thay đổi mềm mại theo góc uốn lượn
    // Tỷ lệ phối cảnh 3D mặt nước nằm ngang: trục Y nén theo 0.28
    const numPoints = 44;
    const angleStep = (Math.PI * 2) / numPoints;

    const points = [];
    for (let a = 0; a <= Math.PI * 2 + angleStep; a += angleStep) {
      // 3 tầng sóng hài vi sai tự nhiên (Harmonic wave perturbations)
      const wobble = 
        Math.sin(a * 3 + seed + this.waveTime * 0.8) * 0.040 +
        Math.cos(a * 5 + seed * 1.3) * 0.022 +
        Math.sin(a * 7 - seed * 0.7) * 0.012;

      const r = radius * (1.0 + wobble);
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * 0.28; // Phối cảnh nghiêng nằm ngang 3D
      points.push({ x: px, y: py, angle: a });
    }

    // 1. Tầng rãnh bóng đổ nước mềm mại (Volumetric Soft Trough)
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y + 1.8);
    for (let j = 0; j < points.length - 1; j++) {
      const xc = (points[j].x + points[j + 1].x) / 2;
      const yc = (points[j].y + points[j + 1].y) / 2 + 1.8;
      this.ctx.quadraticCurveTo(points[j].x, points[j].y + 1.8, xc, yc);
    }
    const troughAlpha = (alpha * 0.35).toFixed(3);
    this.ctx.strokeStyle = `rgba(150, 202, 245, ${troughAlpha})`;
    this.ctx.lineWidth = 7.0; // Thân rãnh bóng đổ mềm tự nhiên
    this.ctx.stroke();

    // 2. Thân khối nước uốn lượn (Liquid Swell Body)
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y + 0.5);
    for (let j = 0; j < points.length - 1; j++) {
      const xc = (points[j].x + points[j + 1].x) / 2;
      const yc = (points[j].y + points[j + 1].y) / 2 + 0.5;
      this.ctx.quadraticCurveTo(points[j].x, points[j].y + 0.5, xc, yc);
    }
    const bodyAlpha = (alpha * 0.60).toFixed(3);
    this.ctx.strokeStyle = `rgba(215, 240, 255, ${bodyAlpha})`;
    this.ctx.lineWidth = 3.8;
    this.ctx.stroke();

    // 3. Đỉnh gờ sóng phản xạ ánh sáng trắng tinh khiết (Specular Highlight Crest)
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let j = 0; j < points.length - 1; j++) {
      const xc = (points[j].x + points[j + 1].x) / 2;
      const yc = (points[j].y + points[j + 1].y) / 2;
      this.ctx.quadraticCurveTo(points[j].x, points[j].y, xc, yc);
    }
    const crestAlpha = (alpha * 0.95).toFixed(3);
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${crestAlpha})`;
    this.ctx.lineWidth = 1.6;
    this.ctx.stroke();

    this.ctx.restore();
  }

  // Phương thức tương thích ngược với unit test suite
  drawSingleRippleCircle(cx, cy, rx, alpha, isPulse = false) {
    if (this.ctx && typeof this.ctx.arc === 'function') {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, rx, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.restore();
    }
    this.drawOrganicRippleWave(cx, cy, rx, alpha, 42);
  }

  destroy() {
    this.running = false;
  }
}
