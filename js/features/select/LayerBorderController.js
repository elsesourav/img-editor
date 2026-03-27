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

    const sourceImage = await this.loadImage(selectedLayer.src);
    const sourceWidth = Math.max(
      1,
      sourceImage.naturalWidth || sourceImage.width || 1,
    );
    const sourceHeight = Math.max(
      1,
      sourceImage.naturalHeight || sourceImage.height || 1,
    );
    const scaleX = sourceWidth / Math.max(1, selectedLayer.width);
    const scaleY = sourceHeight / Math.max(1, selectedLayer.height);
    const borderX = Math.max(1, Math.round(draft.size * scaleX));
    const borderY = Math.max(1, Math.round(draft.size * scaleY));
    const expandX = borderX / Math.max(0.0001, scaleX);
    const expandY = borderY / Math.max(0.0001, scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth + borderX * 2;
    canvas.height = sourceHeight + borderY * 2;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = draft.color;
    ctx.fillRect(0, 0, canvas.width, borderY);
    ctx.fillRect(0, canvas.height - borderY, canvas.width, borderY);
    ctx.fillRect(0, borderY, borderX, canvas.height - borderY * 2);
    ctx.fillRect(
      canvas.width - borderX,
      borderY,
      borderX,
      canvas.height - borderY * 2,
    );
    ctx.drawImage(sourceImage, borderX, borderY, sourceWidth, sourceHeight);

    const previousSrc = selectedLayer.src;
    const previousX = selectedLayer.x;
    const previousY = selectedLayer.y;
    selectedLayer.src = canvas.toDataURL("image/png");
    selectedLayer.x -= expandX;
    selectedLayer.y -= expandY;
    selectedLayer.width += expandX * 2;
    selectedLayer.height += expandY * 2;

    const deltaX = selectedLayer.x - previousX;
    const deltaY = selectedLayer.y - previousY;
    if (deltaX !== 0 || deltaY !== 0) {
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

        if (isDescendant) {
          layer.x += deltaX;
          layer.y += deltaY;
        }
      }
    }

    if (
      this.state?.cropSelection &&
      this.state.cropSelection.layerId === selectedLayer.id
    ) {
      this.state.cropSelection.x = selectedLayer.x;
      this.state.cropSelection.y = selectedLayer.y;
      this.state.cropSelection.width = selectedLayer.width;
      this.state.cropSelection.height = selectedLayer.height;
    }

    const currentRadius = this.getLayerCornerRadius(selectedLayer);
    const radiusDelta = Math.round((expandX + expandY) / 2);
    selectedLayer.cornerRadius = {
      lt: currentRadius.lt + radiusDelta,
      rt: currentRadius.rt + radiusDelta,
      rb: currentRadius.rb + radiusDelta,
      lb: currentRadius.lb + radiusDelta,
    };
    this.ensureLayerCornerRadius(selectedLayer);

    this.revokeBlobUrlIfNeeded(previousSrc);
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
