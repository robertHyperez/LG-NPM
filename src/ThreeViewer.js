import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModelManager } from './ModelManager.js';
import { HotspotManager } from './HotspotManager.js';
import { CameraAnimator } from './CameraAnimator.js';

export class ThreeViewer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} config
   * @param {Object} config.renderer - Renderer options { toneMapping, toneMappingExposure, pixelRatio }
   * @param {Object} config.camera - Camera options { fov, near, far, position, zoom }
   * @param {Object} config.controls - OrbitControls options { enableDamping, dampingFactor, enablePan, rotateSpeed }
   * @param {Array} config.lights - Array of light configs [{ type, color, intensity, position, castShadow, shadowBias, shadowNormalBias }]
   * @param {string} config.environmentMap - Path to environment map (equirectangular PNG)
   * @param {number} config.environmentIntensity - Environment intensity
   * @param {Function} config.onCameraChange - Callback when camera rotates
   * @param {Function} config.onReady - Callback when initialization is complete
   */
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.config = config;
    this.animationFrameId = null;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;

    this.modelManager = null;
    this.hotspotManager = new HotspotManager();
    this.cameraAnimator = null;
  }

  /**
   * Initialize the 3D scene.
   */
  init() {
    const {
      renderer: rendererOpts = {},
      camera: cameraOpts = {},
      controls: controlsOpts = {},
      lights = [],
      environmentMap,
      environmentIntensity = 0.8,
      onCameraChange,
    } = this.config;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.toneMapping = rendererOpts.toneMapping ?? THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = rendererOpts.toneMappingExposure ?? 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, rendererOpts.pixelRatio ?? 1.5));

    // Scene
    this.scene = new THREE.Scene();

    // Environment map
    if (environmentMap) {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(environmentMap, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = null;
        this.scene.environment = texture;
        this.scene.environmentIntensity = environmentIntensity;
      });
    }

    // Camera
    const fov = cameraOpts.fov ?? 50;
    const near = cameraOpts.near ?? 0.001;
    const far = cameraOpts.far ?? 2000;
    this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);
    const pos = cameraOpts.position ?? { x: 0.625, y: 0.5, z: 1.25 };
    this.camera.position.set(pos.x, pos.y, pos.z);
    if (cameraOpts.zoom) this.camera.zoom = cameraOpts.zoom;

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = controlsOpts.enableDamping ?? true;
    this.controls.dampingFactor = controlsOpts.dampingFactor ?? 0.25;
    this.controls.enablePan = controlsOpts.enablePan ?? false;
    this.controls.autoRotate = controlsOpts.autoRotate ?? false;
    this.controls.rotateSpeed = controlsOpts.rotateSpeed ?? 0.65;
    this.controls.target.set(0, 0, 0);

    if (onCameraChange) {
      this.controls.addEventListener('change', () => {
        const progress = this.cameraAnimator.getRotationProgress();
        onCameraChange(progress);
      });
    }

    // Lights
    for (const lightConfig of lights) {
      const light = this._createLight(lightConfig);
      if (light) this.scene.add(light);
    }

    // Managers
    this.modelManager = new ModelManager(this.scene);
    this.cameraAnimator = new CameraAnimator(this.camera, this.controls);
  }

  _createLight(config) {
    let light;
    switch (config.type) {
      case 'directional':
        light = new THREE.DirectionalLight(config.color ?? 0xffffff, config.intensity ?? 1);
        if (config.castShadow) {
          light.castShadow = true;
          if (config.shadowBias != null) light.shadow.bias = config.shadowBias;
          if (config.shadowNormalBias != null) light.shadow.normalBias = config.shadowNormalBias;
        }
        break;
      case 'hemisphere':
        light = new THREE.HemisphereLight(config.color ?? 0xffffff, config.groundColor ?? 0x444444, config.intensity ?? 1);
        break;
      case 'ambient':
        light = new THREE.AmbientLight(config.color ?? 0xffffff, config.intensity ?? 1);
        break;
      case 'point':
        light = new THREE.PointLight(config.color ?? 0xffffff, config.intensity ?? 1);
        break;
      case 'spot':
        light = new THREE.SpotLight(config.color ?? 0xffffff, config.intensity ?? 1);
        if (config.angle != null) light.angle = config.angle;
        if (config.penumbra != null) light.penumbra = config.penumbra;
        if (config.castShadow) light.castShadow = true;
        break;
      default:
        return null;
    }

    if (config.position) {
      light.position.set(config.position.x, config.position.y, config.position.z);
    }

    return light;
  }

  /**
   * Load all models from model table.
   * @param {Object} modelTable - { key: { url, scale, materialOverrides? } }
   */
  async loadModels(modelTable) {
    return this.modelManager.preloadAll(modelTable);
  }

  /**
   * Start the render loop.
   */
  startLoop() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.modelManager.updateMixer();
      if (this.controls) this.controls.update();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.hotspotManager.updatePositions(this.camera, this.modelManager.current);
    };
    animate();
  }

  /**
   * Stop the render loop.
   */
  stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Set the viewport size units as CSS variables.
   */
  setViewportUnits() {
    const vh = window.innerHeight * 0.01;
    const vw = window.innerWidth * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--vw', `${vw}px`);
  }

  /**
   * Clean up all resources.
   */
  dispose() {
    this.stopLoop();
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
