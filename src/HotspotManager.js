import * as THREE from 'three';

export class HotspotManager {
  constructor() {
    this.hotspotsL2 = [];
    this.hotspotsL3 = [];
    this.allHotspots = [];
  }

  get all() {
    return this.allHotspots;
  }

  /**
   * Initialize L2 hotspots from data.
   * @param {Array} hotspotsData - Array of { id, level2Id, position: THREE.Vector3 }
   * @param {Object} options - { containerEl, level2Data, lang, onL2Click, getLangLabel }
   * @returns {Array} hotspotsL2
   */
  initL2(hotspotsData, options = {}) {
    const { containerEl, level2Data = [], lang = 'ko', onL2Click, getLangLabel } = options;

    this.hotspotsL2 = hotspotsData.map(data => {
      const hotspotElement = document.querySelector(`#${data.id}`);
      if (!hotspotElement) return { ...data, element: null, type: 'L2' };

      // Remove existing handler if any
      if (hotspotElement.__l2_onClick) {
        hotspotElement.removeEventListener('click', hotspotElement.__l2_onClick);
      }

      const handler = () => {
        if (onL2Click) onL2Click(data.level2Id);
      };

      hotspotElement.__l2_onClick = handler;
      hotspotElement.addEventListener('click', handler);

      // Create label
      const level2Item = level2Data.find(l2 => l2.id === data.level2Id);
      if (level2Item) {
        let labelElement = hotspotElement.querySelector('.hotspot-label');
        if (!labelElement) {
          labelElement = document.createElement('div');
          labelElement.className = 'hotspot-label';
          const labelText = getLangLabel ? getLangLabel(level2Item, lang) : level2Item.name;
          labelElement.innerHTML = `<div class="hotspot-label-text">${labelText}</div>`;
          labelElement.dataset.level2Id = level2Item.id;
          hotspotElement.appendChild(labelElement);
        }

        labelElement.onclick = (event) => {
          handler();
          event.stopPropagation();
          event.stopImmediatePropagation();
        };
      }

      return { ...data, element: hotspotElement, type: 'L2' };
    });

    this._rebuildAll();
    return this.hotspotsL2;
  }

  /**
   * Initialize L3 hotspots from data.
   * @param {Array} hotspots3Data - Array of { id, level3Id, position: THREE.Vector3 }
   * @param {Object} options - { containerEl, level3Data, lang, onL3Click, getLangLabel }
   * @returns {Array} hotspotsL3
   */
  initL3(hotspots3Data, options = {}) {
    const { containerEl, level3Data = [], lang = 'ko', onL3Click, getLangLabel } = options;
    const container = containerEl || document.querySelector('.container') || document.body;

    // Remove existing L3 hotspots
    container.querySelectorAll('.hotspot--l3').forEach(n => n.remove());

    this.hotspotsL3 = hotspots3Data.map(data => {
      const l3Item = level3Data.find(x => x.id === data.level3Id);
      if (!l3Item) return { ...data, element: null, type: 'L3' };

      const name = getLangLabel ? getLangLabel(l3Item, lang) : l3Item.name;
      const el = document.createElement('div');
      el.id = data.id;
      el.className = 'hotspot hotspot--l3';
      el.dataset.level3Id = data.level3Id;
      el.innerHTML = `<span></span>`;
      el.addEventListener('click', () => {
        if (onL3Click) onL3Click(data.level3Id);
      });
      container.appendChild(el);

      // Add label
      const label = document.createElement('div');
      label.className = 'hotspot-label';
      label.dataset.level3Id = l3Item.id;
      label.innerHTML = `<div class="hotspot-label-text">${name}</div>`;
      el.appendChild(label);

      return { ...data, element: el, type: 'L3' };
    });

    this._rebuildAll();
    return this.hotspotsL3;
  }

  _rebuildAll() {
    this.allHotspots = [...this.hotspotsL2, ...this.hotspotsL3];
  }

  /**
   * Update hotspot screen positions based on camera and model.
   */
  updatePositions(camera, model) {
    if (!model || !this.allHotspots.length || !camera) return;

    camera.updateMatrixWorld();
    const tempVector = new THREE.Vector3();

    this.allHotspots.forEach(hotspot => {
      if (hotspot.element && hotspot.element.classList.contains('visible')) {
        model.updateWorldMatrix(true, false);
        tempVector.copy(hotspot.position).applyMatrix4(model.matrixWorld);
        tempVector.project(camera);

        const x = (tempVector.x * 0.5 + 0.5) * 100;
        const y = (tempVector.y * -0.5 + 0.5) * 100;

        hotspot.element.style.left = `${x}%`;
        hotspot.element.style.top = `${y}%`;
      }
    });
  }

  updateVisibleL2(activeLevel2Ids = []) {
    this.hotspotsL2.forEach(h => {
      if (h.element) h.element.classList.toggle('visible', activeLevel2Ids.includes(h.level2Id));
    });
  }

  updateVisibleL3(activeLevel3Ids = []) {
    this.hotspotsL3.forEach(h => {
      if (h.element) h.element.classList.toggle('visible', activeLevel3Ids.includes(h.level3Id));
    });
  }

  hideAll() {
    this.updateVisibleL2([]);
    this.updateVisibleL3([]);
  }

  setActiveL2(level2IdOrNull) {
    this.hotspotsL2.forEach(h => {
      if (h.element) {
        h.element.classList.toggle('active', !!level2IdOrNull && h.level2Id === level2IdOrNull);
      }
    });
  }

  setActiveL3(level3IdOrNull) {
    this.hotspotsL3.forEach(h => {
      if (h.element) {
        h.element.classList.toggle('active', !!level3IdOrNull && h.level3Id === level3IdOrNull);
      }
    });
  }

  /**
   * Update label text for language change
   */
  updateLabels(lang, level2Data, level3Data, getLangLabel) {
    document.querySelectorAll('.hotspot-label[data-level2-id]').forEach(label => {
      const level2Id = label.dataset.level2Id;
      const item = level2Data.find(l2 => l2.id === level2Id);
      if (item) {
        const text = getLangLabel ? getLangLabel(item, lang) : item.name;
        label.innerHTML = `<div class="hotspot-label-text">${text}</div>`;
      }
    });

    document.querySelectorAll('.hotspot-label[data-level3-id]').forEach(label => {
      const level3Id = label.dataset.level3Id;
      const item = level3Data.find(l3 => l3.id === level3Id);
      if (item) {
        const text = getLangLabel ? getLangLabel(item, lang) : item.name;
        label.innerHTML = `<div class="hotspot-label-text">${text}</div>`;
      }
    });
  }
}
