import * as THREE from 'three';
import { gsap } from 'gsap';

export class CameraAnimator {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
  }

  /**
   * Move camera to show model on the right (default/home position).
   * @param {Object} options - { width, height, isMobile }
   */
  toDefaultPosition(options = {}) {
    const { width = window.innerWidth, height = window.innerHeight, isMobile = false } = options;

    const targetZoom = isMobile ? 1.0 : 1.5;
    const targetOffsetX = isMobile ? 0 : -width * 0.25;
    const targetOffsetY = isMobile ? -height * 0.1 : -height * 0.17;
    const targetPosition = isMobile
      ? { x: 1.325, y: 1.62, z: 1.35 }
      : { x: 0.625, y: 0.5, z: 1.25 };

    const currentOffset = {
      x: this.camera.view ? this.camera.view.offsetX : 0,
      y: this.camera.view ? this.camera.view.offsetY : 0
    };

    gsap.to(this.camera, {
      duration: 0.5, zoom: targetZoom, ease: 'power2.out',
      onUpdate: () => this.camera.updateProjectionMatrix()
    });

    gsap.to(currentOffset, {
      duration: 0.5, x: targetOffsetX, y: targetOffsetY, ease: 'power2.out',
      onUpdate: () => {
        this.camera.setViewOffset(width, height, currentOffset.x, currentOffset.y, width, height);
        this.camera.updateProjectionMatrix();
      }
    });

    gsap.to(this.camera.position, {
      duration: 0.5, ...targetPosition, ease: 'power2.out',
    });
  }

  /**
   * Move camera to show model on the left (detail panel open).
   * @param {Object} options - { width, height, isMobile, ratio }
   */
  toDetailPosition(options = {}) {
    const { width = window.innerWidth, height = window.innerHeight, isMobile = false, ratio = 1 } = options;

    const targetZoom = isMobile ? 1.0 : 1.1;
    const panelSpace = (888 + 50) * ratio;
    const targetOffsetX = isMobile ? 0 : panelSpace / 2.2;
    const targetOffsetY = isMobile ? height * 0.05 : -height * 0.02;

    const currentOffset = {
      x: this.camera.view ? this.camera.view.offsetX : 0,
      y: this.camera.view ? this.camera.view.offsetY : 0
    };

    gsap.to(this.camera, {
      duration: 0.5, zoom: targetZoom, ease: 'power2.out',
      onUpdate: () => this.camera.updateProjectionMatrix()
    });

    gsap.to(currentOffset, {
      duration: 0.5, x: targetOffsetX, y: targetOffsetY, ease: 'power2.out',
      onUpdate: () => {
        this.camera.setViewOffset(width, height, currentOffset.x, currentOffset.y, width, height);
        this.camera.updateProjectionMatrix();
      }
    });
  }

  /**
   * Move camera to center position.
   */
  toCenter(options = {}) {
    const { width = window.innerWidth, height = window.innerHeight } = options;

    const targetOffsetX = 0;
    const targetOffsetY = -height * 0.17;
    const currentOffset = {
      x: this.camera.view ? this.camera.view.offsetX : 0,
      y: this.camera.view ? this.camera.view.offsetY : 0
    };

    gsap.to(this.camera, {
      duration: 0.5, zoom: 1.5, ease: 'power2.out',
      onUpdate: () => this.camera.updateProjectionMatrix()
    });

    gsap.to(currentOffset, {
      duration: 0.5, x: targetOffsetX, y: targetOffsetY, ease: 'power2.out',
      onUpdate: () => {
        if (Math.abs(currentOffset.x) < 1 && Math.abs(currentOffset.y) < 1) this.camera.clearViewOffset();
        else this.camera.setViewOffset(width, height, currentOffset.x, currentOffset.y, width, height);
        this.camera.updateProjectionMatrix();
      }
    });
  }

  /**
   * Animate camera into interior view.
   * @param {THREE.Object3D} model - current model
   */
  enterInterior(model) {
    if (!this.controls || !this.camera || !model) return;

    this.camera.position.set(1.1, 0.2, 0.1);
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);

    this.controls.enabled = false;

    const cameraFinalPosition = new THREE.Vector3(0, 0.2, -0.12);
    const steeringWheelPosition = new THREE.Vector3(0.0, 0.2, 0);

    const tl = gsap.timeline({
      onUpdate: () => {
        this.camera.lookAt(this.controls.target);
      },
      onComplete: () => {
        this.controls.enabled = true;
        this.controls.update();
      }
    });

    tl.to(this.camera.position, {
      ...cameraFinalPosition,
      duration: 2.2,
      ease: 'power2.inOut',
    }, 0);

    tl.to(this.controls.target, {
      ...steeringWheelPosition,
      duration: 1.2,
      ease: 'power2.inOut',
    }, 0);
  }

  /**
   * Reset camera to exterior view.
   * @param {boolean} isMobile
   */
  exitToExterior(isMobile = false) {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);

    if (isMobile) {
      this.camera.position.set(1.325, 1.62, 1.35);
    } else {
      this.camera.position.set(0.625, 0.5, 1.25);
    }

    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /**
   * Handle window resize - update camera and renderer.
   */
  handleResize(renderer, modeConfig, options = {}) {
    const { isMobile = false, shouldKeepTitlesOut = false, ratio = 1 } = options;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    renderer.setSize(width, height);

    if (isMobile) {
      this.camera.zoom = 1.0;
      this.camera.position.set(1.325, 1.62, 1.35);
    } else {
      this.camera.zoom = 1.5;
      this.camera.position.set(0.625, 0.5, 1.25);
    }

    if (isMobile) {
      const offsetX = 0;
      const offsetY = shouldKeepTitlesOut ? height * 0.1 : -height * 0.1;
      this.camera.setViewOffset(width, height, offsetX, offsetY, width, height);
    } else {
      let offsetX;
      let offsetY = -height * 0.17;

      if (shouldKeepTitlesOut) {
        const panelSpace = (888 + 50) * ratio;
        offsetX = panelSpace / 2;
        offsetY = height * 0.02;
      } else {
        offsetX = -width * 0.25;
      }
      this.camera.setViewOffset(width, height, offsetX, offsetY, width, height);
    }

    this.camera.updateProjectionMatrix();
  }

  /**
   * Get current azimuthal rotation progress (0-100).
   */
  getRotationProgress() {
    if (!this.controls) return 50;
    const azimuthalAngle = this.controls.getAzimuthalAngle();
    const normalizedAngle = (azimuthalAngle + Math.PI) / (2 * Math.PI);
    return normalizedAngle * 100;
  }
}
