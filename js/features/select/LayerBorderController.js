/**
 * @typedef {Object} LayerBorderDraft
 * @property {number} size - Border size in editor pixels.
 * @property {string} color - Border color in #RRGGBB format.
 */

/**
 * @typedef {Object} BorderPreviewPayload
 * @property {string} layerId - Layer receiving preview border.
 * @property {number} size - Border size in editor pixels.
 * @property {string} color - Border color in #RRGGBB format.
 */

/**
 * @typedef {Object} LayerBorderControllerDeps
 * @property {(id: string|null|undefined) => any} getLayerById - Resolves a layer by ID.
 * @property {(preview: BorderPreviewPayload|null) => void} setLayerBorderPreview - Updates border preview state.
 * @property {(src: string) => Promise<HTMLImageElement>} loadImage - Loads an image element from layer src.
 * @property {(layer: any) => void} ensureLayerCornerRadius - Normalizes layer corner radius payload.
 * @property {(layer: any) => {lt:number,rt:number,rb:number,lb:number}} getLayerCornerRadius - Reads corner radius values.
 * @property {any} state - Global editor state object.
 */

/**
 * Coordinates border preview and border apply behavior for a selected layer.
 */
export class LayerBorderController {
  /**
   * @param {LayerBorderControllerDeps} deps - Layer border controller dependencies.
   */
  constructor({
    getLayerById,
    setLayerBorderPreview,
    loadImage,
    ensureLayerCornerRadius,
    getLayerCornerRadius,
    state,
  }) {
    this.getLayerById = getLayerById;
    this.setLayerBorderPreview = setLayerBorderPreview;
    this.loadImage = loadImage;
    this.ensureLayerCornerRadius = ensureLayerCornerRadius;
    this.getLayerCornerRadius = getLayerCornerRadius;
    this.state = state;

    /** @type {LayerBorderDraft} */
    this.draft = {
      size: 0,
      color: "#FFFFFF",
    };
  }

  /**
   * @return {LayerBorderDraft} - A normalized copy of the current draft.
   */
  getDraft() {
    return {
      size: this.normalizeSize(this.draft.size),
      color: this.normalizeColor(this.draft.color),
    };
  }

  /**
   * @param {number} nextSize - Next border size in editor pixels.
   * @return {LayerBorderDraft} - Updated normalized draft.
   */
  setDraftSize(nextSize) {
    this.draft.size = this.normalizeSize(nextSize);
    return this.getDraft();
  }

  /**
   * @param {string} nextColor - Next border color value.
   * @return {LayerBorderDraft} - Updated normalized draft.
   */
  setDraftColor(nextColor) {
    this.draft.color = this.normalizeColor(nextColor);
    return this.getDraft();
  }

  /**
   * @return {void}
   */
  clearDraftSize() {
    this.draft.size = 0;
  }

  /**
   * @return {boolean} - True when draft is valid for apply.
   */
  canApply() {
    return this.normalizeSize(this.draft.size) > 0;
  }

  /**
   * Syncs preview outline for the currently selected layer.
   * @param {string|null} selectedLayerId - Currently selected layer ID.
   * @return {void}
   */
  syncPreview(selectedLayerId) {
    const selected = this.getLayerById(selectedLayerId);
    const draft = this.getDraft();

    if (!selected || draft.size <= 0) {
      this.setLayerBorderPreview(null);
      return;
    }

    this.setLayerBorderPreview({
      layerId: selected.id,
      size: draft.size,
      color: draft.color,
    });
  }

  /**
   * Applies a baked border by increasing image pixels and layer bounds.
   * @param {any} selectedLayer - Selected layer to mutate.
   * @return {Promise<void>}
   */
  async applyToLayer(selectedLayer) {
    if (!selectedLayer) return;

    const draft = this.getDraft();
    if (draft.size <= 0) return;

    const addSize = draft.size;
    const existingBorderSize = Math.max(
      0,
      Math.round(Number(selectedLayer.appliedBorder?.size) || 0),
    );

    selectedLayer.appliedBorder = {
      size: existingBorderSize + addSize,
      color: this.normalizeColor(draft.color),
    };

    selectedLayer.width += addSize * 2;
    selectedLayer.height += addSize * 2;

    for (const layer of this.state?.layers || []) {
      if (!layer || layer.id === selectedLayer.id) continue;

      let parentId = layer.parentId;
      let isDescendant = false;
      while (parentId) {
        if (parentId === selectedLayer.id) {
          isDescendant = true;
          break;
        }
        const parentLayer = (this.state?.layers || []).find(
          (item) => item.id === parentId,
        );
        parentId = parentLayer?.parentId || null;
      }

      // Keep inner child composition unchanged while parent gets a larger border box.
      if (isDescendant) {
        layer.x += addSize;
        layer.y += addSize;
      }
    }

    if (
      this.state?.cropSelection &&
      this.state.cropSelection.layerId === selectedLayer.id
    ) {
      this.state.cropSelection.width = selectedLayer.width;
      this.state.cropSelection.height = selectedLayer.height;
    }

    const currentRadius = this.getLayerCornerRadius(selectedLayer);
    const radiusDelta = addSize;
    selectedLayer.cornerRadius = {
      lt: currentRadius.lt + radiusDelta,
      rt: currentRadius.rt + radiusDelta,
      rb: currentRadius.rb + radiusDelta,
      lb: currentRadius.lb + radiusDelta,
    };
    this.ensureLayerCornerRadius(selectedLayer);
  }

  /**
   * @param {number} value - Border size candidate.
   * @return {number} - Normalized non-negative integer size.
   */
  normalizeSize(value) {
    return Math.max(0, Math.round(Number(value) || 0));
  }

  /**
   * @param {string} value - Border color candidate.
   * @return {string} - Normalized #RRGGBB color.
   */
  normalizeColor(value) {
    const raw = String(value || "")
      .trim()
      .toUpperCase();
    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9A-F]{6}$/.test(withHash)) {
      return withHash;
    }
    return "#FFFFFF";
  }

  /**
   * @param {string} src - Previous layer src.
   * @return {void}
   */
  revokeBlobUrlIfNeeded(src) {
    if (typeof src === "string" && src.startsWith("blob:")) {
      URL.revokeObjectURL(src);
    }
  }
}
