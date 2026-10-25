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

    // 4. Tải mô hình 3D thật. Trong lúc chờ (hoặc nếu tải lỗi) giữ ảnh máy thật làm hình tạm,
    //    không dựng bản mô hình thô nữa.
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

        this.phoneGroup = new THREE.Group();
        this.phoneGroup.add(loadedModel);

        // Gắn hiệu ứng light sweep vào mô hình GLTF
        this.createCameraGlintEffect(this.phoneGroup);

        this.phoneGroup.scale.set(targetScale, targetScale, targetScale);
        this.phoneGroup.position.set(0, 0, 0);
        this.phoneGroup.rotation.set(0.08, Math.PI - 0.22, 0);

        this.scene.add(this.phoneGroup);
        this.container.classList.add('is-3d-ready');
      }, undefined, () => {
        console.warn('Không tải được mô hình 3D, giữ ảnh máy.');
      });
    }
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
