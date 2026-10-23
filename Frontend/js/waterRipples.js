/**
 * Tien Mobile - Studio Perspective 3D Volumetric Water Ripples Engine
 * Render gợn nước 3D chân thực, dày dặn, có chiều sâu chất lỏng (Volumetric Liquid Depth):
 * - Thân sóng dày dặn (Volumetric wave body) nhiều lớp ánh sáng đón sáng & vùng trũng bóng đổ
 * - Sóng ngang phối cảnh 3D ở 1/3 màn hình dưới
 * - Tâm sóng dạng vòng ngang elip phối cảnh nằm dưới chân 18 Pro Max
 * - Gradient là phần màu và ánh sáng của chính khối sóng nước (nền trong suốt hoàn hảo)
 */

export class WaterRipplesEngine {
  constructor(canvasId = 'waterRipplesCanvas', containerId = 'waterRipplesStage') {
    this.canvas = document.getElementById(canvasId);
    this.container = document.getElementById(containerId);
    if (!this.canvas || !this.container) return;

    this.ctx = this.canvas.getContext('2d');
    this.waveTime = 0;
    this.pulses = []; // Dynamic interaction ripple pulses
    this.running = true;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Spawn initial gentle wave pulse
    this.triggerInteractionRipple(0.9);

    // Animation loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || window.innerWidth;
    this.height = rect.height || 260;

    // Retina display support
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    this.updateCenterPosition();
  }

  // Căn chỉnh tâm chấn sóng elip nằm dưới chân 18 Pro Max với khoảng trống tự nhiên
  updateCenterPosition() {
    const phoneContainer = document.getElementById('phoneContainer3D') || document.getElementById('phone3DCanvasWrap');
    if (phoneContainer && this.container) {
      const pRect = phoneContainer.getBoundingClientRect();
      const sRect = this.container.getBoundingClientRect();

      // Tâm X trùng trục đứng giữa của 18 Pro Max
      this.centerX = (pRect.left + pRect.width / 2) - sRect.left;

      // Khoảng cách từ chân máy tới mặt nước trong stage 1/3 dưới
      const phoneBottomInStage = (pRect.top + pRect.height * 0.74) - sRect.top;
      const naturalGap = Math.max(30, Math.min(48, this.height * 0.15));
      this.centerY = Math.max(28, Math.min(this.height * 0.45, phoneBottomInStage + naturalGap));
    } else {
      this.centerX = this.width / 2;
      this.centerY = this.height * 0.35;
    }
  }

  // Kích hoạt xung sóng tương tác dày dặn khi người dùng chạm/vuốt
  triggerInteractionRipple(intensity = 1.0) {
    const clampedIntensity = Math.min(intensity, 1.5);
    this.pulses.push({
      radius: 0,
      maxRadius: Math.max(this.width * 0.65, 460),
      speed: 1.6,
      intensity: clampedIntensity,
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

    // Background hoàn toàn trong suốt - không vẽ màu nền background
    if (this.ctx && typeof this.ctx.clearRect === 'function') {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }

    // 1. Phản chiếu chân máy 18 Pro Max dạng cột sáng mềm trên mặt nước
    this.drawPhoneReflection();

    // 2. Chỗ lõm chất lỏng 3D ở tâm chấn dưới chân máy
    this.drawCenterDepression();

    // 3. Update dynamic pulses
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.radius += p.speed;
      p.life++;
      if (p.radius >= p.maxRadius) {
        this.pulses.splice(i, 1);
      }
    }

    // 4. Các dải sóng ngang dập dềnh khối 3D (Background Horizon Waves)
    this.drawUndulatingWavefronts();

    // 5. Gợn sóng 3D dạng vòng ngang elip dày dặn lan tỏa dưới chân 18 Pro Max
    this.drawCircularRipples();
  }

  // Nền trong suốt theo yêu cầu: "gradian là phần màu của sóng không phải pha màu của background"
  drawWaterBackground() {
    if (this.ctx && typeof this.ctx.clearRect === 'function') {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  // 1. Cột phản chiếu ánh sáng dịu của 18 Pro Max xuống mặt nước ở khoảng trống tự nhiên
  drawPhoneReflection() {
    this.ctx.save();
    const cx = this.centerX;
    const cy = this.centerY;
    const reflW = Math.min(105, this.width * 0.16);
    const reflH = Math.max(42, this.height * 0.38);

    // Cột sáng phản chiếu đứng mềm mại từ chân máy xuống tâm nước
    const reflGrad = this.ctx.createRadialGradient(cx, cy - 8, 3, cx, cy - 8, reflW);
    reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.50)');        // Lõi trắng sáng
    reflGrad.addColorStop(0.35, 'rgba(215, 238, 255, 0.32)');     // Ánh xanh dương nhạt
    reflGrad.addColorStop(0.65, 'rgba(95, 25, 45, 0.06)');        // Phớt nhẹ sắc Burgundy của 18 Pro Max
    reflGrad.addColorStop(1.0, 'transparent');

    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy - 8, reflW, reflH * 0.5, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy - 8, reflW, 0, Math.PI * 2);
    }
    this.ctx.fillStyle = reflGrad;
    this.ctx.fill();

    this.ctx.restore();
  }

  // 2. Chỗ lõm chất lỏng 3D ở tâm chấn dưới chân máy (Volumetric Liquid Depression)
  drawCenterDepression() {
    this.ctx.save();
    const cx = this.centerX;
    const cy = this.centerY;
    const dipW = 48;
    const dipH = dipW * 0.28;

    // Vùng trũng 3D có độ sâu lòng nước
    const dipGrad = this.ctx.createRadialGradient(cx, cy, 2, cx, cy, dipW);
    dipGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    dipGrad.addColorStop(0.35, 'rgba(195, 230, 254, 0.35)');
    dipGrad.addColorStop(0.70, 'rgba(160, 210, 248, 0.18)');
    dipGrad.addColorStop(1.0, 'transparent');

    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy, dipW, dipH, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy, dipW, 0, Math.PI * 2);
    }
    this.ctx.fillStyle = dipGrad;
    this.ctx.fill();

    // Viền sáng tròn 3D bao quanh điểm lõm chất lỏng
    const rimRadiusX = 20 + Math.sin(this.waveTime * 2.2) * 2;
    const rimRadiusY = rimRadiusX * 0.28;
    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy, rimRadiusX, rimRadiusY, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy, rimRadiusX, 0, Math.PI * 2);
    }
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    this.ctx.lineWidth = 1.8;
    this.ctx.stroke();

    this.ctx.restore();
  }

  // 4. Các dải sóng ngang dập dềnh khối 3D (3D Volumetric Horizon Wavefronts)
  drawUndulatingWavefronts() {
    const totalWaveRows = 8; // 8 dải sóng ngang có độ dày khối 3D

    for (let i = 0; i < totalWaveRows; i++) {
      const v = (i + 1) / (totalWaveRows + 1);
      const yBase = Math.pow(v, 1.38) * (this.height - 14) + 8;

      const rowAlpha = Math.sin(v * Math.PI) * 0.92;
      if (rowAlpha <= 0.02) continue;

      const points = [];
      const stepX = 16;

      for (let x = 0; x <= this.width + stepX; x += stepX) {
        const dx = x - this.centerX;
        const dy = yBase - this.centerY;
        const normDist = Math.sqrt((dx * dx) / (this.width * this.width * 0.22) + (dy * dy) / (48 * 48));

        // Dao động từ tâm chấn dưới chân máy
        const centerDecay = Math.exp(-normDist * 1.7);
        const centerWave = Math.cos(normDist * 8.0 - this.waveTime * 2.1) * centerDecay * (4.2 + v * 3.5);

        // Dao động dập dềnh tự nhiên
        const swellWave = Math.sin(x * 0.0052 + this.waveTime * 1.1 + i * 0.55) * (1.2 + v * 2.2);

        const py = yBase + centerWave + swellWave;
        points.push({ x, y: py, normDist });
      }

      this.drawWaveRowPath(points, rowAlpha, v);
    }
  }

  // Vẽ dải sóng ngang với khối 3D dày dặn (Thân sóng rộng + Đỉnh sáng phản quang)
  drawWaveRowPath(points, rowAlpha, depthRatio = 0.5) {
    if (!points || points.length < 2) return;

    // A. VÙNG TRŨNG BÓNG ĐỔ DÀY DẶN 3D (Volumetric Trough Shadow - độ dày 16px - 22px)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y + 2.5);
    for (let j = 0; j < points.length - 1; j++) {
      const xc = (points[j].x + points[j + 1].x) / 2;
      const yc = (points[j].y + points[j + 1].y) / 2 + 2.5;
      this.ctx.quadraticCurveTo(points[j].x, points[j].y + 2.5, xc, yc);
    }

    const shadowGrad = this.ctx.createLinearGradient(0, 0, this.width, 0);
    const sAlpha = (rowAlpha * 0.38 * (0.6 + depthRatio * 0.4)).toFixed(3);
    shadowGrad.addColorStop(0, 'rgba(165, 210, 248, 0)');
    shadowGrad.addColorStop(0.2, `rgba(155, 205, 245, ${sAlpha})`);
    shadowGrad.addColorStop(0.5, `rgba(135, 192, 240, ${sAlpha})`);
    shadowGrad.addColorStop(0.8, `rgba(155, 205, 245, ${sAlpha})`);
    shadowGrad.addColorStop(1, 'rgba(165, 210, 248, 0)');

    this.ctx.strokeStyle = shadowGrad;
    this.ctx.lineWidth = 14 + depthRatio * 8; // Độ dày rãnh sóng 14px - 22px
    this.ctx.stroke();
    this.ctx.restore();

    // B. THÂN SÓNG NƯỚC KHÚC XẠ 3D (Volumetric Swell Body - độ dày 8px - 14px)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y + 0.8);
    for (let j = 0; j < points.length - 1; j++) {
      const xc = (points[j].x + points[j + 1].x) / 2;
      const yc = (points[j].y + points[j + 1].y) / 2 + 0.8;
      this.ctx.quadraticCurveTo(points[j].x, points[j].y + 0.8, xc, yc);
    }

    const bodyGrad = this.ctx.createLinearGradient(0, 0, this.width, 0);
    const bAlpha = (rowAlpha * 0.65).toFixed(3);
    bodyGrad.addColorStop(0, 'rgba(215, 238, 255, 0)');
    bodyGrad.addColorStop(0.25, `rgba(205, 235, 254, ${bAlpha})`);
    bodyGrad.addColorStop(0.50, `rgba(235, 248, 255, ${bAlpha})`);
    bodyGrad.addColorStop(0.75, `rgba(205, 235, 254, ${bAlpha})`);
    bodyGrad.addColorStop(1, 'rgba(215, 238, 255, 0)');

    this.ctx.strokeStyle = bodyGrad;
    this.ctx.lineWidth = 8 + depthRatio * 6; // Thân sóng dày 8px - 14px
    this.ctx.stroke();
    this.ctx.restore();

    // C. ĐỈNH GỜ SÓNG PHẢN QUANG SẮC NÉT (Crisp Specular Ridge)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let j = 0; j < points.length - 1; j++) {
      const xc = (points[j].x + points[j + 1].x) / 2;
      const yc = (points[j].y + points[j + 1].y) / 2;
      this.ctx.quadraticCurveTo(points[j].x, points[j].y, xc, yc);
    }

    const crestGrad = this.ctx.createLinearGradient(0, 0, this.width, 0);
    const cAlpha = (rowAlpha * 0.92).toFixed(3);
    crestGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    crestGrad.addColorStop(0.3, `rgba(255, 255, 255, ${(cAlpha * 0.7).toFixed(3)})`);
    crestGrad.addColorStop(0.5, `rgba(255, 255, 255, ${cAlpha})`);
    crestGrad.addColorStop(0.7, `rgba(255, 255, 255, ${(cAlpha * 0.7).toFixed(3)})`);
    crestGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    this.ctx.strokeStyle = crestGrad;
    this.ctx.lineWidth = 2.2 + depthRatio * 0.6;
    this.ctx.stroke();
    this.ctx.restore();
  }

  // 5. Gợn sóng 3D dạng vòng ngang elip dày dặn (Volumetric Perspective 3D Rings)
  drawCircularRipples() {
    const cx = this.centerX;
    const cy = this.centerY;
    const maxRadius = Math.max(this.width * 0.58, 440);
    const numRings = 5;

    // A. Các vòng sóng tự nhiên chuyển động êm ả với độ dày khối 3D
    for (let k = 0; k < numRings; k++) {
      const progress = ((this.waveTime * 0.18 + k / numRings) % 1.0);
      const rx = Math.pow(progress, 0.86) * maxRadius;
      if (rx < 12) continue;

      const fadeIn = Math.min(1.0, rx / 36);
      const fadeOut = Math.pow(1.0 - progress, 1.3);
      const ringAlpha = fadeIn * fadeOut;
      if (ringAlpha <= 0.01) continue;

      this.drawSingleRippleCircle(cx, cy, rx, ringAlpha, false);
    }

    // B. Các vòng sóng sinh ra từ tương tác người dùng
    for (let i = 0; i < this.pulses.length; i++) {
      const p = this.pulses[i];
      const pProg = Math.min(1.0, p.radius / p.maxRadius);
      const pFadeIn = Math.min(1.0, p.radius / 32);
      const pFadeOut = Math.pow(1.0 - pProg, 1.35);
      const pAlpha = pFadeIn * pFadeOut * p.intensity;

      if (pAlpha > 0.01 && p.radius >= 10) {
        // Vòng sóng chính
        this.drawSingleRippleCircle(cx, cy, p.radius, pAlpha * 1.25, true);

        // Vòng sóng thứ cấp đi theo sau
        if (p.radius > 30) {
          this.drawSingleRippleCircle(cx, cy, p.radius - 26, pAlpha * 0.6, false);
        }
      }
    }
  }

  // Vẽ 1 vòng sóng 3D dày dặn (Volumetric 3D Ripple Ring) với 4 lớp chiều sâu chất lỏng
  drawSingleRippleCircle(cx, cy, rx, alpha, isPulse = false) {
    this.ctx.save();
    // Tỷ lệ nén phối cảnh 3D mặt nằm ngang (ry = rx * 0.26)
    const ry = rx * 0.26;
    const pNorm = Math.min(1.0, rx / (this.width * 0.55));

    // LỚP 1: VÙNG TRŨNG BÓNG ĐỔ DÀY DẶN 3D (Volumetric Trough - chiều dày 18px - 28px)
    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy + 2.4, rx, ry, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy + 2.4, rx, 0, Math.PI * 2);
    }
    const shadowOpacity = (alpha * (isPulse ? 0.45 : 0.35)).toFixed(3);
    this.ctx.strokeStyle = `rgba(145, 198, 245, ${shadowOpacity})`;
    this.ctx.lineWidth = (isPulse ? 24 : 18) + pNorm * 10; // Rãnh sóng sâu dày 18px - 28px
    this.ctx.stroke();

    // LỚP 2: THÂN KHỐI NƯỚC PHỒNG LÊN 3D (Volumetric Liquid Swell - chiều dày 12px - 18px)
    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy + 0.6, rx, ry, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy + 0.6, rx, 0, Math.PI * 2);
    }
    const bodyOpacity = (alpha * (isPulse ? 0.65 : 0.52)).toFixed(3);
    this.ctx.strokeStyle = `rgba(215, 238, 255, ${bodyOpacity})`;
    this.ctx.lineWidth = (isPulse ? 16 : 12) + pNorm * 6; // Thân sóng dày 12px - 18px
    this.ctx.stroke();

    // LỚP 3: SƯỜN ĐÓN SÁNG TRẮNG MỜ (Specular Slope Highlight - chiều dày 5px - 8px)
    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy - 0.8, rx, ry, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy - 0.8, rx, 0, Math.PI * 2);
    }
    const slopeOpacity = (alpha * (isPulse ? 0.85 : 0.72)).toFixed(3);
    this.ctx.strokeStyle = `rgba(240, 250, 255, ${slopeOpacity})`;
    this.ctx.lineWidth = (isPulse ? 7.0 : 5.0) + pNorm * 2.5;
    this.ctx.stroke();

    // LỚP 4: GỜ ĐỈNH SÓNG PHẢN XẠ TRẮNG SÁNG CỰC ĐIỂM (Crisp Specular Peak)
    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy - 1.6, rx, ry, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy - 1.6, rx, 0, Math.PI * 2);
    }
    const peakOpacity = (alpha * (isPulse ? 1.0 : 0.92)).toFixed(3);
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${peakOpacity})`;
    this.ctx.lineWidth = isPulse ? 2.8 : 2.2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  destroy() {
    this.running = false;
  }
}
