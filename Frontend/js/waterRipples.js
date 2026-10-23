/**
 * Tien Mobile - Studio Perspective Horizontal Water Ripples Engine
 * Render sóng ngang phối cảnh 3D ở 1/3 màn hình dưới theo đúng ảnh mẫu:
 * - Gradient là phần màu của chính các đường sóng (không phải pha màu nền background)
 * - Nền canvas trong suốt, giữ trọn vẻ tinh khiết của Apple Studio
 * - Tâm sóng dạng vòng ngang elip phối cảnh nằm dưới chân 18 Pro Max
 * - Các dải sóng ngang dập dềnh êm ả với đỉnh sóng ánh sáng trắng và rãnh sóng xanh dương nhạt
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
    this.triggerInteractionRipple(0.85);

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
      // Tâm sóng nằm ở khoảng 25% - 40% chiều cao của stage 1/3 dưới
      const naturalGap = Math.max(28, Math.min(46, this.height * 0.14));
      this.centerY = Math.max(28, Math.min(this.height * 0.45, phoneBottomInStage + naturalGap));
    } else {
      this.centerX = this.width / 2;
      this.centerY = this.height * 0.35;
    }
  }

  // Kích hoạt xung sóng tương tác khi người dùng chạm/vuốt
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

    this.waveTime += 0.020;

    // Background hoàn toàn trong suốt - không vẽ màu nền background
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Phản chiếu chân máy 18 Pro Max dạng cột sáng mềm trên mặt nước
    this.drawPhoneReflection();

    // 2. Chỗ lõm nhẹ ở tâm chấn dưới chân máy
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

    // 4. Các dải sóng ngang dập dềnh phối cảnh 3D (Background Horizon Waves)
    this.drawUndulatingWavefronts();

    // 5. Gợn sóng dạng vòng ngang elip phối cảnh lan tỏa dưới chân 18 Pro Max
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
    const reflW = Math.min(96, this.width * 0.15);
    const reflH = Math.max(38, this.height * 0.35);

    // Cột sáng phản chiếu đứng mềm mại từ chân máy xuống tâm nước
    const reflGrad = this.ctx.createRadialGradient(cx, cy - 8, 2, cx, cy - 8, reflW);
    reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');        // Lõi trắng sáng
    reflGrad.addColorStop(0.35, 'rgba(215, 238, 255, 0.28)');     // Ánh xanh dương nhạt
    reflGrad.addColorStop(0.65, 'rgba(95, 25, 45, 0.05)');        // Phớt nhẹ sắc Burgundy của 18 Pro Max
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

  // 2. Chỗ lõm elip phối cảnh ở tâm chấn dưới chân máy
  drawCenterDepression() {
    this.ctx.save();
    const cx = this.centerX;
    const cy = this.centerY;
    const dipW = 42;
    const dipH = dipW * 0.26;

    // Vầng sáng elip phối cảnh pha gradient trắng và xanh dương nhạt của chính sóng
    const dipGrad = this.ctx.createRadialGradient(cx, cy, 2, cx, cy, dipW);
    dipGrad.addColorStop(0, 'rgba(255, 255, 255, 0.70)');
    dipGrad.addColorStop(0.4, 'rgba(210, 238, 254, 0.30)');
    dipGrad.addColorStop(0.8, 'rgba(185, 222, 250, 0.12)');
    dipGrad.addColorStop(1.0, 'transparent');

    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy, dipW, dipH, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy, dipW, 0, Math.PI * 2);
    }
    this.ctx.fillStyle = dipGrad;
    this.ctx.fill();

    // Viền sáng elip nhẹ quanh tâm
    const rimRadiusX = 18 + Math.sin(this.waveTime * 2.2) * 2;
    const rimRadiusY = rimRadiusX * 0.26;
    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy, rimRadiusX, rimRadiusY, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy, rimRadiusX, 0, Math.PI * 2);
    }
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    this.ctx.lineWidth = 1.4;
    this.ctx.stroke();

    this.ctx.restore();
  }

  // 4. Các dải sóng ngang dập dềnh phối cảnh (Undulating Horizontal Wavefronts)
  // Gradient trắng và xanh dương nhạt được tô trực tiếp lên từng đường sóng
  drawUndulatingWavefronts() {
    const totalWaveRows = 9; // 9 dải sóng ngang trải dọc phối cảnh 3D từ xa tới gần

    for (let i = 0; i < totalWaveRows; i++) {
      const v = (i + 1) / (totalWaveRows + 1);
      // Tỷ lệ khoảng cách phối cảnh (xa khít, gần thưa)
      const yBase = Math.pow(v, 1.38) * (this.height - 12) + 6;

      const rowAlpha = Math.sin(v * Math.PI) * 0.90;
      if (rowAlpha <= 0.02) continue;

      const points = [];
      const stepX = 16;

      for (let x = 0; x <= this.width + stepX; x += stepX) {
        const dx = x - this.centerX;
        const dy = yBase - this.centerY;
        const normDist = Math.sqrt((dx * dx) / (this.width * this.width * 0.22) + (dy * dy) / (45 * 45));

        // Dao động từ tâm chấn dưới chân máy
        const centerDecay = Math.exp(-normDist * 1.8);
        const centerWave = Math.cos(normDist * 8.2 - this.waveTime * 2.1) * centerDecay * (3.8 + v * 3.2);

        // Dao động sóng ngang tự nhiên trải dài
        const swellWave = Math.sin(x * 0.0052 + this.waveTime * 1.1 + i * 0.55) * (1.1 + v * 2.0);

        const py = yBase + centerWave + swellWave;
        points.push({ x, y: py, normDist });
      }

      this.drawWaveRowPath(points, rowAlpha, v);
    }
  }

  // Tô màu Gradient trực tiếp lên dải sóng ngang: Xanh dương nhạt ở sườn -> Trắng sáng phản quang ở đỉnh
  drawWaveRowPath(points, rowAlpha, depthRatio = 0.5) {
    if (!points || points.length < 2) return;

    // A. Rãnh sóng bóng đổ màu xanh dương nhạt (Soft Blue Trough Shadow)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y + 1.6);
    for (let j = 0; j < points.length - 1; j++) {
      const xc = (points[j].x + points[j + 1].x) / 2;
      const yc = (points[j].y + points[j + 1].y) / 2 + 1.6;
      this.ctx.quadraticCurveTo(points[j].x, points[j].y + 1.6, xc, yc);
    }

    const shadowGrad = this.ctx.createLinearGradient(0, 0, this.width, 0);
    const sAlpha = (rowAlpha * 0.32 * (0.6 + depthRatio * 0.4)).toFixed(3);
    shadowGrad.addColorStop(0, 'rgba(175, 215, 248, 0)');
    shadowGrad.addColorStop(0.2, `rgba(165, 208, 245, ${sAlpha})`);
    shadowGrad.addColorStop(0.5, `rgba(145, 198, 242, ${sAlpha})`);
    shadowGrad.addColorStop(0.8, `rgba(165, 208, 245, ${sAlpha})`);
    shadowGrad.addColorStop(1, 'rgba(175, 215, 248, 0)');

    this.ctx.strokeStyle = shadowGrad;
    this.ctx.lineWidth = 2.2;
    this.ctx.stroke();
    this.ctx.restore();

    // B. Đỉnh sóng phản quang màu Trắng pha Xanh dương nhạt (Specular Crest Gradient)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let j = 0; j < points.length - 1; j++) {
      const xc = (points[j].x + points[j + 1].x) / 2;
      const yc = (points[j].y + points[j + 1].y) / 2;
      this.ctx.quadraticCurveTo(points[j].x, points[j].y, xc, yc);
    }

    const crestGrad = this.ctx.createLinearGradient(0, 0, this.width, 0);
    const cAlpha = (rowAlpha * 0.88).toFixed(3);
    const edgeAlpha = (rowAlpha * 0.20).toFixed(3);

    crestGrad.addColorStop(0, `rgba(215, 238, 255, ${edgeAlpha})`);
    crestGrad.addColorStop(0.25, `rgba(195, 230, 254, ${cAlpha})`);
    crestGrad.addColorStop(0.50, `rgba(255, 255, 255, ${cAlpha})`); // Đỉnh trắng tinh khiết ở giữa
    crestGrad.addColorStop(0.75, `rgba(195, 230, 254, ${cAlpha})`);
    crestGrad.addColorStop(1, `rgba(215, 238, 255, ${edgeAlpha})`);

    this.ctx.strokeStyle = crestGrad;
    this.ctx.lineWidth = 1.5 + depthRatio * 0.5;
    this.ctx.stroke();
    this.ctx.restore();
  }

  // 5. Gợn sóng dạng vòng ngang phối cảnh elip (Circular Perspective Ripples) như ảnh mẫu
  drawCircularRipples() {
    const cx = this.centerX;
    const cy = this.centerY;
    const maxRadius = Math.max(this.width * 0.55, 420);
    const numRings = 5; // 5 vòng sóng elip phối cảnh lan tỏa liên tục

    // A. Các vòng sóng tự nhiên chuyển động êm ả
    for (let k = 0; k < numRings; k++) {
      const progress = ((this.waveTime * 0.20 + k / numRings) % 1.0);
      const rx = Math.pow(progress, 0.88) * maxRadius;
      if (rx < 10) continue;

      const fadeIn = Math.min(1.0, rx / 32);
      const fadeOut = Math.pow(1.0 - progress, 1.35);
      const ringAlpha = fadeIn * fadeOut;
      if (ringAlpha <= 0.01) continue;

      this.drawSingleRippleCircle(cx, cy, rx, ringAlpha, false);
    }

    // B. Các vòng sóng sinh ra từ tương tác người dùng
    for (let i = 0; i < this.pulses.length; i++) {
      const p = this.pulses[i];
      const pProg = Math.min(1.0, p.radius / p.maxRadius);
      const pFadeIn = Math.min(1.0, p.radius / 30);
      const pFadeOut = Math.pow(1.0 - pProg, 1.4);
      const pAlpha = pFadeIn * pFadeOut * p.intensity;

      if (pAlpha > 0.01 && p.radius >= 8) {
        // Vòng sóng chính
        this.drawSingleRippleCircle(cx, cy, p.radius, pAlpha * 1.2, true);

        // Vòng sóng thứ cấp đi theo sau
        if (p.radius > 26) {
          this.drawSingleRippleCircle(cx, cy, p.radius - 22, pAlpha * 0.55, false);
        }
      }
    }
  }

  // Vẽ 1 vòng sóng dạng ngang elip phối cảnh với gradient trắng và xanh dương nhạt trên nét sóng
  drawSingleRippleCircle(cx, cy, rx, alpha, isPulse = false) {
    this.ctx.save();
    // Tỷ lệ nén phối cảnh 3D mặt nằm ngang (ry = rx * 0.26) chuẩn xác như ảnh mẫu
    const ry = rx * 0.26;

    // 1. Rãnh sóng màu xanh dương nhạt (Trough Shadow)
    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy + 1.2, rx, ry, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy + 1.2, rx, 0, Math.PI * 2);
    }
    const blueAlpha = (alpha * (isPulse ? 0.45 : 0.35)).toFixed(3);
    this.ctx.strokeStyle = `rgba(160, 210, 248, ${blueAlpha})`;
    this.ctx.lineWidth = isPulse ? 3.0 : 2.2;
    this.ctx.stroke();

    // 2. Đỉnh sóng phản quang màu trắng tinh khiết (Specular White Crest)
    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    }
    const whiteAlpha = (alpha * (isPulse ? 0.95 : 0.85)).toFixed(3);
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${whiteAlpha})`;
    this.ctx.lineWidth = isPulse ? 2.0 : 1.5;
    this.ctx.stroke();

    // 3. Viền ánh sắc lam ngọc nhẹ (Aqua Ambient Glint)
    this.ctx.beginPath();
    if (this.ctx.ellipse) {
      this.ctx.ellipse(cx, cy - 0.8, rx, ry, 0, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy - 0.8, rx, 0, Math.PI * 2);
    }
    const aquaAlpha = (alpha * (isPulse ? 0.60 : 0.45)).toFixed(3);
    this.ctx.strokeStyle = `rgba(205, 236, 255, ${aquaAlpha})`;
    this.ctx.lineWidth = 1.0;
    this.ctx.stroke();

    this.ctx.restore();
  }

  destroy() {
    this.running = false;
  }
}
