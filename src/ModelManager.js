import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';

export class ModelManager {
  constructor(scene) {
    this.scene = scene;
    this.cache = new Map();
    this.currentKey = null;
    this.currentModel = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
  }

  async preloadAll(modelTable) {
    const uniqueUrls = [...new Set(Object.values(modelTable).map(spec => spec.url))];
    const gltfLoader = new GLTFLoader();
    const loadedByUrl = new Map();

    const promises = uniqueUrls.map(url =>
      new Promise((resolve, reject) => {
        gltfLoader.load(
          url,
          (gltf) => { loadedByUrl.set(url, gltf); resolve(); },
          undefined,
          (error) => reject(new Error(`Failed to load ${url}: ${error}`))
        );
      })
    );

    await Promise.all(promises);

    for (const [key, spec] of Object.entries(modelTable)) {
      const gltf = loadedByUrl.get(spec.url);
      if (!gltf) continue;

      const obj = gltf.scene.clone(true);
      obj.animations = gltf.animations;

      // Apply material overrides if provided
      if (spec.materialOverrides) {
        obj.traverse((child) => {
          if (!child.isMesh) return;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((m) => {
            if (!m) return;
            for (const override of spec.materialOverrides) {
              if (m.name && m.name.includes(override.nameIncludes)) {
                Object.assign(m, override.properties);
              }
            }
          });
        });
      }

      // Normalize scale
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const finalScale = spec.scale / Math.max(size.x, size.y, size.z, 0.001);
      obj.scale.set(finalScale, finalScale, finalScale);

      // Enable shadows
      obj.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      obj.position.set(0, 0, 0);
      this.cache.set(key, obj);
    }
  }

  setActive(key, animationKeys = []) {
    const next = this.cache.get(key);
    if (!next) return null;

    if (!next.parent) {
      this.scene.add(next);
    }

    if (this.currentModel && this.currentModel !== next) {
      this.currentModel.visible = false;
    }

    next.visible = true;
    this.currentModel = next;
    this.currentKey = key;

    // Play animation if this key is in animationKeys
    if (animationKeys.includes(key) && next.animations && next.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(next);
      const action = this.mixer.clipAction(next.animations[0]);
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
      action.play();
    }

    return next;
  }

  crossfade(prev, next, dur = 0.2) {
    const outMats = [];
    const inMats = [];

    const collect = (root, bucket, initOpacity) => {
      root.traverse(o => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            if (!m) return;
            m.transparent = true;
            if (typeof initOpacity === 'number') m.opacity = initOpacity;
            bucket.push(m);
          });
        }
      });
    };

    collect(next, inMats, 0);
    collect(prev, outMats);

    next.visible = true;

    gsap.to(inMats, {
      opacity: 1, duration: dur, ease: 'power1.out',
      onComplete: () => { inMats.forEach(m => { m.transparent = false; }); }
    });

    gsap.to(outMats, {
      opacity: 0, duration: dur, ease: 'power1.out',
      onComplete: () => {
        prev.visible = false;
        outMats.forEach(m => { m.opacity = 1; m.transparent = false; });
      }
    });
  }

  updateMixer() {
    if (this.mixer) {
      const delta = this.clock.getDelta();
      this.mixer.update(delta);
    }
  }

  getModel(key) {
    return this.cache.get(key) || null;
  }

  get current() {
    return this.currentModel;
  }
}
