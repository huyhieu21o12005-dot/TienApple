/**
 * Tien Mobile - iPhone 18 Pro Max 3D Real-Time Engine (Three.js)
 * Accurately models the exact uploaded design:
 * - Color: Deep Crimson Titanium / Wine-Red Burgundy (#38141F)
 * - Wide horizontal camera plateau spanning across the top
 * - Triple pro sapphire camera array on left, True Tone flash & LiDAR on right
 * - Burgundy Apple iOS 18 screen with Dynamic Island & stylized widgets
 * - Scaled to sit naturally cradled in the cupped hand layer
 * - Full Touch & Mouse Swipe / Flick momentum rotation
 */

export class Phone3DStudio {
  constructor(canvasId = 'phone3DCanvas', containerId = 'phone3DCanvasWrap') {
    this.canvas = document.getElementById(canvasId);
    this.container = document.getElementById(containerId);
    if (!this.canvas || !this.container) return;

    this.isDragging = false;
    this.dragStartTime = 0;
    this.previousPointerPos = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.userRotation = { x: 0.08, y: Math.PI - 0.25 };
    this.autoRotate = true;
    this.lastInteractionTime = 0;
    this.contactShadow = document.getElementById('phoneContactShadow');

    this.init();
  }

  init() {
    if (typeof THREE === 'undefined') {
      console.warn('Three.js not loaded, cannot initialize 3D phone.');
      return;
    }

    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || 400;
    this.height = rect.height || 520;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 0.3, 14);

    // 2. High-Performance Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Tăng tương phản và độ rực rỡ sang trọng của Burgundy Titanium
    this.renderer.toneMappingExposure = 1.35;

    // 3. Studio High-Contrast Lighting Setup
    this.setupLighting();

    // 4. Build 18 Pro Max Model (Crimson Burgundy with Wide Plateau)
    this.build18ProMaxModel();

    // 5. Load GLTF 3D Source Model if available
    this.loadGLTFModel();

    // 6. Touch & Mouse Swipe Events
    this.bindEvents();

    // 7. Animation Loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    this.inView = true;
    this.tabVisible = !document.hidden;
    this.rafId = null;
    this.watchVisibility();
    this.startLoop();
  }

  /** Chỉ chạy vòng lặp 3D khi canvas đang hiện trên màn hình và tab đang mở (mượt hơn, đỡ nóng máy). */
  watchVisibility() {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        this.inView = entry.isIntersecting;
        this.startLoop();
      }, { threshold: 0 }).observe(this.container);
    }
    document.addEventListener('visibilitychange', () => {
      this.tabVisible = !document.hidden;
      this.startLoop();
    });
  }

  startLoop() {
    if (this.rafId === null && this.inView && this.tabVisible) {
      this.clock.getDelta();
      this.rafId = requestAnimationFrame(this.animate);
    }
  }

  setupLighting() {
    // 1. Ambient Light - Cân lại mức 0.60 để giữ độ sâu thẳm của bóng đổ (Deep Contrast)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.60);
    this.scene.add(ambientLight);

    // 2. Main Studio Key Light - Cường độ cao chiếu xiên từ trên cao tạo vệt bóng sáng kim loại
    const keyLight = new THREE.DirectionalLight(0xFFF2EB, 2.2);
    keyLight.position.set(6, 8, 7);
    this.scene.add(keyLight);

    // 3. Fill Light - Ánh hồng phớt nhẹ làm nổi khối cạnh sườn
    const fillLight = new THREE.DirectionalLight(0xF6DFE4, 0.85);
    fillLight.position.set(-6, 3, 6);
    this.scene.add(fillLight);

    // 4. Sharp Titanium Rim Light - Viền sáng kim loại sắc nét từ sau
    const rimLight = new THREE.DirectionalLight(0xFFD2DE, 1.9);
    rimLight.position.set(0, 4.5, -9);
    this.scene.add(rimLight);

    // 5. Chùm sáng quét chuyên dụng làm nổi bật cụm Camera (Camera Sweep Light)
    this.cameraSweepLight = new THREE.SpotLight(0xFFFFFF, 0.25, 22, Math.PI / 3.2, 0.35, 1.2);
    this.cameraSweepLight.position.set(-3.0, 3.0, -3.5);
    this.cameraTarget = new THREE.Object3D();
    this.cameraTarget.position.set(0, 2.25, -0.4);
    this.scene.add(this.cameraTarget);
    this.cameraSweepLight.target = this.cameraTarget;
    this.scene.add(this.cameraSweepLight);

    // 6. Điểm sáng phụ lấp lánh thấu kính sapphire
    this.lensSpecularLight = new THREE.PointLight(0xB8E0FF, 0.2, 10);
    this.lensSpecularLight.position.set(-0.6, 2.25, -1.2);
    this.scene.add(this.lensSpecularLight);

    // 7. Bottom Reflection Light (Phản chiếu dịu từ gợn nước phía dưới lên chân máy)
    const bottomLight = new THREE.PointLight(0xDAEEFC, 0.8, 18);
    bottomLight.position.set(0, -5, 3.5);
    this.scene.add(bottomLight);
  }

  createRoundedRect(w, h, r) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }

  // Generate Burgundy iOS 18 Front Screen Texture (matches Image 3)
  createScreenTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 2100;
    const ctx = canvas.getContext('2d');

    // Deep Dark Crimson Base Wallpaper
    ctx.fillStyle = '#18070D';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apple Crimson Wave Flow Wallpaper
    const waveGrad = ctx.createRadialGradient(512, 1100, 80, 512, 1100, 800);
    waveGrad.addColorStop(0, '#541B2B');
    waveGrad.addColorStop(0.4, '#38101C');
    waveGrad.addColorStop(0.8, '#200810');
    waveGrad.addColorStop(1, '#0F0307');
    ctx.fillStyle = waveGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ambient curved wave lines
    ctx.strokeStyle = 'rgba(215, 110, 140, 0.18)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(512, 700, 420, 320, 0.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(512, 1300, 480, 360, -0.2, 0, Math.PI * 2);
    ctx.stroke();

    // Top Status Bar Time "9:41"
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 84px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('9:41', 120, 185);

    // Status Bar Icons (5G, Battery)
    ctx.textAlign = 'right';
    ctx.font = '500 52px -apple-system, sans-serif';
    ctx.fillText('5G  100%', 904, 180);

    // Dynamic Island (Pill Shape)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    const pillW = 340, pillH = 92, pillX = (canvas.width - pillW) / 2, pillY = 120, pillR = pillH / 2;
    ctx.moveTo(pillX + pillR, pillY);
    ctx.lineTo(pillX + pillW - pillR, pillY);
    ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, pillR);
    ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, pillR);
    ctx.arcTo(pillX, pillY + pillH, pillX, pillY, pillR);
    ctx.arcTo(pillX, pillY, pillX + pillW, pillY, pillR);
    ctx.closePath();
    ctx.fill();

    // Dynamic Island Camera Aperture Dot
    ctx.fillStyle = '#091510';
    ctx.beginPath();
    ctx.arc(pillX + 70, pillY + pillH / 2, 22, 0, Math.PI * 2);
    ctx.fill();

    // Clock Widget (Top Left Card)
    ctx.fillStyle = 'rgba(45, 12, 22, 0.75)';
    ctx.strokeStyle = 'rgba(220, 130, 155, 0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(100, 300, 380, 380, 56) : ctx.rect(100, 300, 380, 380);
    ctx.fill();
    ctx.stroke();

    // Analog clock circle inside widget
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(290, 490, 110, 0, Math.PI * 2);
    ctx.stroke();

    // Clock Hands
    ctx.beginPath();
    ctx.moveTo(290, 490);
    ctx.lineTo(290, 420); // Hour hand
    ctx.moveTo(290, 490);
    ctx.lineTo(350, 490); // Minute hand
    ctx.stroke();

    // 2 Small Widgets (Top Right)
    ctx.fillStyle = 'rgba(45, 12, 22, 0.75)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(540, 300, 175, 175, 44) : ctx.rect(540, 300, 175, 175);
    ctx.roundRect ? ctx.roundRect(745, 300, 175, 175, 44) : ctx.rect(745, 300, 175, 175);
    ctx.roundRect ? ctx.roundRect(540, 505, 175, 175, 44) : ctx.rect(540, 505, 175, 175);
    ctx.roundRect ? ctx.roundRect(745, 505, 175, 175, 44) : ctx.rect(745, 505, 175, 175);
    ctx.fill();

    // App Icons Grid (4 columns x 4 rows)
    const iconCols = 4;
    const iconRows = 4;
    const startX = 100;
    const startY = 740;
    const iconGapX = 220;
    const iconGapY = 220;

    for (let r = 0; r < iconRows; r++) {
      for (let c = 0; c < iconCols; c++) {
        const ix = startX + c * iconGapX;
        const iy = startY + r * iconGapY;
        ctx.fillStyle = 'rgba(55, 16, 26, 0.85)';
        ctx.strokeStyle = 'rgba(230, 140, 165, 0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(ix, iy, 160, 160, 42) : ctx.rect(ix, iy, 160, 160);
        ctx.fill();
        ctx.stroke();

        // Icon emblem highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(ix + 80, iy + 80, 28, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bottom Page Dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(480, 1680, 8, 0, Math.PI * 2);
    ctx.arc(540, 1680, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(510, 1680, 10, 0, Math.PI * 2);
    ctx.fill();

    // Bottom Dock Bar (Glassmorphic blur capsule)
    ctx.fillStyle = 'rgba(75, 22, 35, 0.55)';
    ctx.strokeStyle = 'rgba(255, 180, 200, 0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(80, 1760, 864, 210, 68) : ctx.rect(80, 1760, 864, 210);
    ctx.fill();
    ctx.stroke();

    // 4 Dock Icons
    for (let i = 0; i < 4; i++) {
      const dx = 135 + i * 205;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(dx, 1795, 140, 140, 36) : ctx.rect(dx, 1795, 140, 140);
      ctx.fill();
    }

    // Home Indicator Bar
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    const hBarW = 380, hBarH = 14, hBarX = (canvas.width - hBarW) / 2, hBarY = 2030;
    ctx.roundRect ? ctx.roundRect(hBarX, hBarY, hBarW, hBarH, 7) : ctx.rect(hBarX, hBarY, hBarW, hBarH);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }

  // Generate Back Texture with Embossed Apple Logo in Burgundy
  createBackLogoTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Deep Crimson Frosted Matte Glass
    ctx.fillStyle = '#34121A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle brushed glow
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#421622');
    grad.addColorStop(0.5, '#34121A');
    grad.addColorStop(1, '#240A11');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apple Logo (Centered tone-on-tone metallic reflection)
    ctx.save();
    ctx.translate(256, 560);
    ctx.fillStyle = '#5A1E2E';

    // Apple body
    ctx.beginPath();
    ctx.arc(-24, 0, 48, 0, Math.PI * 2);
    ctx.arc(24, 0, 48, 0, Math.PI * 2);
    ctx.fill();

    // Apple bite cutout
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(54, -10, 32, 0, Math.PI * 2);
    ctx.fill();

    // Apple leaf
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#5A1E2E';
    ctx.beginPath();
    ctx.ellipse(12, -66, 16, 26, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  build18ProMaxModel() {
    this.phoneGroup = new THREE.Group();

    // 18 Pro Max Proportions: 3.5w x 7.3h x 0.38d
    const phoneW = 3.5;
    const phoneH = 7.3;
    const cornerR = 0.52;
    const thickness = 0.38;

    // --- 1. Titanium Frame (Crimson Burgundy) ---
    const frameShape = this.createRoundedRect(phoneW, phoneH, cornerR);
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05
    });
    frameGeo.center();

    // Rich Burgundy Brushed Titanium Material (High Contrast, Deep Saturation)
    const frameMat = new THREE.MeshPhysicalMaterial({
      color: 0x3A101C, // Deep Crimson Burgundy Titanium
      metalness: 0.92,
      roughness: 0.16,
      clearcoat: 0.88,
      clearcoatRoughness: 0.10,
      reflectivity: 0.98
    });

    this.frameMesh = new THREE.Mesh(frameGeo, frameMat);
    this.phoneGroup.add(this.frameMesh);

    // --- 2. Frosted Ceramic Shield Back Glass ---
    const backShape = this.createRoundedRect(phoneW - 0.08, phoneH - 0.08, cornerR - 0.04);
    const backGeo = new THREE.ExtrudeGeometry(backShape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.02,
      bevelThickness: 0.02
    });
    backGeo.center();

    const backMat = new THREE.MeshPhysicalMaterial({
      color: 0x2A0B14, // Deep Burgundy Ceramic Shield Glass (Tương phản cao)
      map: this.createBackLogoTexture(),
      roughness: 0.32,
      metalness: 0.30,
      clearcoat: 0.95,
      clearcoatRoughness: 0.12
    });

    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.z = -(thickness / 2 + 0.04);
    this.phoneGroup.add(backMesh);

    // --- 3. Front Display Screen ---
    const frontGeo = new THREE.PlaneGeometry(phoneW - 0.1, phoneH - 0.1);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.createScreenTexture()
    });
    const frontMesh = new THREE.Mesh(frontGeo, screenMat);
    frontMesh.position.z = thickness / 2 + 0.051;
    this.phoneGroup.add(frontMesh);

    // Front Glass Cover with Specular Glint
    const glassCoverGeo = new THREE.PlaneGeometry(phoneW - 0.04, phoneH - 0.04);
    const glassCoverMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.10,
      roughness: 0.04,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    });
    const glassCoverMesh = new THREE.Mesh(glassCoverGeo, glassCoverMat);
    glassCoverMesh.position.z = thickness / 2 + 0.053;
    this.phoneGroup.add(glassCoverMesh);

    // --- 4. WIDE HORIZONTAL CAMERA PLATEAU (iPhone 18 Pro Max Signature) ---
    // Nhìn vào Image 1: Mặt phẳng cụm camera là màu Rose Champagne Metallic sáng bóng, tương phản rõ rệt với mặt lưng Burgundy!
    const plateauW = 3.15;
    const plateauH = 1.75;
    const plateauR = 0.44;
    const plateauShape = this.createRoundedRect(plateauW, plateauH, plateauR);
    const plateauGeo = new THREE.ExtrudeGeometry(plateauShape, {
      depth: 0.13,
      bevelEnabled: true,
      bevelSegments: 5,
      bevelSize: 0.04,
      bevelThickness: 0.04
    });
    plateauGeo.center();

    const plateauMat = new THREE.MeshPhysicalMaterial({
      color: 0xBD5C75, // Rose Champagne Metallic mạ kim loại sáng bóng (Image 1)
      metalness: 0.92,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0
    });

    const plateauMesh = new THREE.Mesh(plateauGeo, plateauMat);
    // Positioned horizontally across upper section of back
    plateauMesh.position.set(0, 2.25, -(thickness / 2 + 0.11));
    this.phoneGroup.add(plateauMesh);

    // --- 5. 3 Large Pro Camera Lenses on the Left of Plateau ---
    const lenses = [
      { x: -0.95, y: 2.62, r: 0.36 }, // Top Left Lens
      { x: -0.95, y: 1.88, r: 0.36 }, // Bottom Left Lens
      { x: -0.32, y: 2.25, r: 0.36 }  // Center Lens
    ];

    lenses.forEach(pos => {
      // Titanium Bezel Outer Ring - Mạ viền sáng bóng lấp lánh
      const ringGeo = new THREE.CylinderGeometry(pos.r, pos.r, 0.10, 32);
      const ringMat = new THREE.MeshPhysicalMaterial({
        color: 0xE08298, // Rose Gold Titanium Bezel
        metalness: 0.98,
        roughness: 0.08,
        clearcoat: 1.0
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(pos.x, pos.y, -(thickness / 2 + 0.22));
      this.phoneGroup.add(ring);

      // Dark Sapphire Stepped Barrel
      const barrelGeo = new THREE.CylinderGeometry(pos.r * 0.85, pos.r * 0.85, 0.11, 32);
      const barrelMat = new THREE.MeshStandardMaterial({
        color: 0x050103, // Đen sâu thẳm
        roughness: 0.20
      });
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(pos.x, pos.y, -(thickness / 2 + 0.225));
      this.phoneGroup.add(barrel);

      // Sapphire Glass Lens Center
      const glassGeo = new THREE.CylinderGeometry(pos.r * 0.65, pos.r * 0.65, 0.115, 32);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x04080B,
        metalness: 0.2,
        roughness: 0.03,
        clearcoat: 1.0
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.rotation.x = Math.PI / 2;
      glass.position.set(pos.x, pos.y, -(thickness / 2 + 0.23));
      this.phoneGroup.add(glass);

      // Iris reflection highlight
      const reflexGeo = new THREE.CircleGeometry(0.05, 16);
      const reflexMat = new THREE.MeshBasicMaterial({
        color: 0x70A0C0,
        transparent: true,
        opacity: 0.7
      });
      const reflex = new THREE.Mesh(reflexGeo, reflexMat);
      reflex.position.set(pos.x + 0.07, pos.y + 0.07, -(thickness / 2 + 0.29));
      this.phoneGroup.add(reflex);
    });

    // --- 6. Right Side of Plateau: Flash, Mic & LiDAR Sensor ---
    // Circular True Tone Flash
    const flashGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24);
    const flashMat = new THREE.MeshStandardMaterial({
      color: 0xFFFBE8,
      emissive: 0x332810,
      roughness: 0.15
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.rotation.x = Math.PI / 2;
    flash.position.set(0.95, 2.62, -(thickness / 2 + 0.16));
    this.phoneGroup.add(flash);

    // Microphone Hole
    const micGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16);
    const micMat = new THREE.MeshBasicMaterial({ color: 0x050102 });
    const mic = new THREE.Mesh(micGeo, micMat);
    mic.rotation.x = Math.PI / 2;
    mic.position.set(0.95, 2.25, -(thickness / 2 + 0.16));
    this.phoneGroup.add(mic);

    // Large Circular LiDAR Scanner Sensor
    const lidarGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24);
    const lidarMat = new THREE.MeshStandardMaterial({
      color: 0x0D0306,
      roughness: 0.18,
      metalness: 0.5
    });
    const lidar = new THREE.Mesh(lidarGeo, lidarMat);
    lidar.rotation.x = Math.PI / 2;
    lidar.position.set(0.95, 1.88, -(thickness / 2 + 0.16));
    this.phoneGroup.add(lidar);

    // --- 7. Buttons (Left & Right Frames matching images) ---
    // Action Button (Left upper)
    this.addButton(-phoneW / 2 - 0.04, 2.15, 0, 0.06, 0.32, 0.12, frameMat);
    // Volume Up & Down (Left)
    this.addButton(-phoneW / 2 - 0.04, 1.45, 0, 0.06, 0.52, 0.12, frameMat);
    this.addButton(-phoneW / 2 - 0.04, 0.75, 0, 0.06, 0.52, 0.12, frameMat);
    // Power / Side Button (Right upper)
    this.addButton(phoneW / 2 + 0.04, 1.35, 0, 0.06, 0.82, 0.12, frameMat);
    // Camera Control Sensor Surface (Right lower)
    this.addButton(phoneW / 2 + 0.03, -1.25, 0, 0.04, 0.72, 0.10, frameMat);

    // --- 8. Hiệu ứng vệt sáng quét qua cụm cam (Camera Plateau Light Sweep Glint) ---
    this.createCameraGlintEffect(this.phoneGroup);

    // --- 9. Scale & Placement: Centered in Chromatic Aura Ring ---
    // Scaled to 0.85 for heroic presence
    this.phoneGroup.scale.set(0.85, 0.85, 0.85);
    this.phoneGroup.position.set(0, 0, 0);
    this.phoneGroup.rotation.set(0.08, Math.PI - 0.22, 0);

    this.scene.add(this.phoneGroup);
  }

  // Tạo texture vệt sáng quang học quét chéo góc 35 độ
  createCameraGlintTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Chùm tia sáng quét hình dải quang học mờ biên
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.25, 'rgba(255, 215, 230, 0.12)');
    grad.addColorStop(0.44, 'rgba(255, 255, 255, 0.75)');
    grad.addColorStop(0.50, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.56, 'rgba(255, 255, 255, 0.75)');
    grad.addColorStop(0.75, 'rgba(225, 175, 200, 0.15)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vệt sáng lóa tâm tròn (specular flare core)
    const flareGrad = ctx.createRadialGradient(256, 256, 4, 256, 256, 120);
    flareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    flareGrad.addColorStop(0.3, 'rgba(255, 230, 240, 0.45)');
    flareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = flareGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  // Khởi tạo mesh vệt sáng quang học chạy qua cụm camera
  createCameraGlintEffect(targetGroup) {
    if (!targetGroup) return;

    const glintGeo = new THREE.PlaneGeometry(1.2, 2.8);
    const glintMat = new THREE.MeshBasicMaterial({
      map: this.createCameraGlintTexture(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.cameraGlintMesh = new THREE.Mesh(glintGeo, glintMat);
    // Góc nghiêng 28 độ tạo vệt sáng chéo điện ảnh
    this.cameraGlintMesh.rotation.z = -Math.PI / 6.5;
    // Đặt ở vị trí cụm camera mặt lưng
    this.cameraGlintMesh.position.set(-2.2, 2.25, -0.42);
    this.cameraGlintMesh.visible = false;
    targetGroup.add(this.cameraGlintMesh);
  }

  loadGLTFModel() {
    if (typeof THREE.GLTFLoader === 'function' || typeof THREE.GLTFLoader === 'object') {
      const loader = new THREE.GLTFLoader();
      loader.load('models/iphone_18_pro_max.glb', (gltf) => {
        if (!gltf || !gltf.scene) return;
        const loadedModel = gltf.scene;

        // Bounding box normalization
        const box = new THREE.Box3().setFromObject(loadedModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        loadedModel.position.x = -center.x;
        loadedModel.position.y = -center.y;
        loadedModel.position.z = -center.z;

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const targetScale = 6.4 / maxDim;

        // Replace procedural model with the official GLB scene
        if (this.phoneGroup) {
          this.scene.remove(this.phoneGroup);
        }

        this.phoneGroup = new THREE.Group();
        this.phoneGroup.add(loadedModel);

        // Gắn hiệu ứng light sweep vào mô hình GLTF
        this.createCameraGlintEffect(this.phoneGroup);

        this.phoneGroup.scale.set(targetScale, targetScale, targetScale);
        this.phoneGroup.position.set(0, 0, 0);
        this.phoneGroup.rotation.set(0.08, Math.PI - 0.22, 0);

        this.scene.add(this.phoneGroup);
        console.log('iPhone 18 Pro Max GLB model loaded successfully into 3D stage!');
      }, undefined, (err) => {
        console.log('Procedural 18 Pro Max model active.');
      });
    }
  }

  addButton(x, y, z, w, h, d, mat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.phoneGroup.add(mesh);
  }

  bindEvents() {
    // Resize Listener
    window.addEventListener('resize', () => {
      if (!this.container) return;
      const rect = this.container.getBoundingClientRect();
      this.width = rect.width || 400;
      this.height = rect.height || 520;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    });

    // Touch & Mouse Swipe / Flick with Momentum
    const startInteraction = (clientX, clientY) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.dragStartTime = performance.now();
      this.previousPointerPos = { x: clientX, y: clientY };
      this.velocity = { x: 0, y: 0 };
    };

    const moveInteraction = (clientX, clientY, horizontalOnly = false) => {
      if (!this.isDragging || !this.phoneGroup) return;

      const deltaX = clientX - this.previousPointerPos.x;
      const deltaY = horizontalOnly ? 0 : clientY - this.previousPointerPos.y;

      // Track velocity for flick momentum
      this.velocity = {
        x: deltaX * 0.015,
        y: deltaY * 0.010
      };

      this.userRotation.y += deltaX * 0.014;
      this.userRotation.x += deltaY * 0.009;

      // Restrict vertical pitch to comfortable viewing range
      this.userRotation.x = Math.max(-0.55, Math.min(0.55, this.userRotation.x));

      this.previousPointerPos = { x: clientX, y: clientY };
      this.lastInteractionTime = performance.now();
    };

    const endInteraction = () => {
      this.isDragging = false;
      this.lastInteractionTime = performance.now();
    };

    // Mouse Listeners
    this.container.addEventListener('mousedown', (e) => startInteraction(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) moveInteraction(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', endInteraction);

    // Touch Swipe Listeners
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startInteraction(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        // Trên cảm ứng chỉ xoay theo chiều ngang, vuốt dọc dành cho cuộn trang
        moveInteraction(e.touches[0].clientX, e.touches[0].clientY, true);
      }
    }, { passive: true });

    window.addEventListener('touchend', endInteraction);
    window.addEventListener('touchcancel', endInteraction);

    // Parallax Tilt when mouse moves over hero section
    const heroSection = document.getElementById('heroSection');
    if (heroSection) {
      heroSection.addEventListener('mousemove', (e) => {
        if (this.isDragging) return;
        const rect = heroSection.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width - 0.5;
        const normY = (e.clientY - rect.top) / rect.height - 0.5;

        this.parallaxX = -normY * 0.14;
        this.parallaxY = normX * 0.18;
      });
    }
  }

  animate() {
    if (!this.inView || !this.tabVisible) {
      this.rafId = null;
      return;
    }
    this.rafId = requestAnimationFrame(this.animate);

    const elapsedTime = this.clock.getElapsedTime();

    if (this.phoneGroup) {
      const now = performance.now();

      // Apply Swipe Flick Inertia & Momentum
      if (!this.isDragging) {
        if (Math.abs(this.velocity.x) > 0.0005) {
          this.userRotation.y += this.velocity.x;
          this.velocity.x *= 0.94; // Smooth friction deceleration
        }
        if (Math.abs(this.velocity.y) > 0.0005) {
          this.userRotation.x += this.velocity.y;
          this.userRotation.x = Math.max(-0.55, Math.min(0.55, this.userRotation.x));
          this.velocity.y *= 0.94;
        }

        // Return to gentle back-and-forth swaying 2.2s after user finishes flicking
        if (now - this.lastInteractionTime > 2200 && Math.abs(this.velocity.x) < 0.001) {
          this.autoRotate = true;
        }
      }

      if (this.autoRotate && !this.isDragging) {
        // Natural gentle swaying: oscillates between ~-28 deg and +28 deg
        const swing = Math.sin(elapsedTime * 0.85) * 0.48;
        const baseFacing = Math.PI - 0.22;
        const targetY = baseFacing + swing + (this.parallaxY || 0);
        const targetX = 0.08 + Math.cos(elapsedTime * 0.65) * 0.05 + (this.parallaxX || 0);

        this.userRotation.y += (targetY - this.userRotation.y) * 0.04;
        this.userRotation.x += (targetX - this.userRotation.x) * 0.04;
      }

      this.phoneGroup.rotation.y = this.userRotation.y;
      this.phoneGroup.rotation.x = this.userRotation.x;

      // Centered gentle levitation floating inside the chromatic organic halo
      const hoverY = Math.sin(elapsedTime * 1.4) * 0.12;
      this.phoneGroup.position.y = hoverY;

      // ======================================================================
      // HIỆU ỨNG VỆT SÁNG QUÉT QUA CỤM CAM (Camera Light Sweep Glint Loop)
      // Mỗi 3.8s, chùm sáng lướt qua cụm 3 camera và đảo camera tạo vệt phản quang
      // ======================================================================
      const sweepCycle = 3.8; // Chu kỳ 3.8 giây lặp lại 1 lần
      const sweepTime = elapsedTime % sweepCycle;
      const sweepDuration = 1.25; // Thời gian chạy qua là 1.25s

      if (sweepTime < sweepDuration) {
        const progress = sweepTime / sweepDuration; // 0.0 -> 1.0
        // Quét ngang từ góc trái sang góc phải của đảo camera (x: -1.8 đến 1.8)
        const currentSweepX = -1.8 + progress * 3.6;
        // Đường cong hình sin êm dịu (0 -> đỉnh 1.0 -> 0)
        const glintAlpha = Math.sin(progress * Math.PI);

        if (this.cameraGlintMesh) {
          this.cameraGlintMesh.visible = true;
          this.cameraGlintMesh.position.x = currentSweepX;
          // Độ nghiêng biến chuyển nhẹ nhàng theo chiều quét
          this.cameraGlintMesh.rotation.z = -Math.PI / 6.5 + (progress - 0.5) * 0.12;
          this.cameraGlintMesh.material.opacity = glintAlpha * 0.94;
        }

        // Đồng bộ nguồn sáng quét chuyên dụng
        if (this.cameraSweepLight) {
          this.cameraSweepLight.position.x = currentSweepX * 1.4;
          this.cameraSweepLight.intensity = 0.25 + glintAlpha * 4.8; // Bừng sáng khi quét qua mắt cam
        }

        if (this.lensSpecularLight) {
          this.lensSpecularLight.intensity = 0.2 + glintAlpha * 3.5;
        }
      } else {
        if (this.cameraGlintMesh) {
          this.cameraGlintMesh.visible = false;
          this.cameraGlintMesh.material.opacity = 0;
        }
        if (this.cameraSweepLight) {
          this.cameraSweepLight.intensity = 0.25; // Ánh sáng nền nhẹ
        }
        if (this.lensSpecularLight) {
          this.lensSpecularLight.intensity = 0.15;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
