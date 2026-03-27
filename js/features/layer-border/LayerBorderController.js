/**
 * @typedef {Object} LayerBorderDraft
 * @property {number} size
 * @property {string} color
 */

/**
 * @typedef {Object} BorderPreviewPayload
 * @property {string} layerId
 * @property {number} size
 * @property {string} color
 */

/**
 * Coordinates border preview and border apply behavior for a selected layer.
 */
export class LayerBorderController {
  /**
   * @param {Object} deps
   * @param {(id: string|null|undefined) => any} deps.getLayerById
   * @param {(preview: BorderPreviewPayload|null) => void} deps.setLayerBorderPreview
   * @param {(src: string) => Promise<HTMLImageElement>} deps.loadImage
   * @param {(layer: any) => void} deps.ensureLayerCornerRadius
   * @param {(layer: any) => {lt:number,rt:number,rb:number,lb:number}} deps.getLayerCornerRadius
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
   * @returns {LayerBorderDraft}
   */
  getDraft() {
    return {
      size: this.normalizeSize(this.draft.size),
      color: this.normalizeColor(this.draft.color),
    };
  }

  /**
   * @param {number} nextSize
   * @returns {LayerBorderDraft}
   */
  setDraftSize(nextSize) {
    this.draft.size = this.normalizeSize(nextSize);
    return this.getDraft();
  }

  /**
   * @param {string} nextColor
   * @returns {LayerBorderDraft}
   */
  setDraftColor(nextColor) {
    this.draft.color = this.normalizeColor(nextColor);
    return this.getDraft();
  }

  /**
   * @returns {void}
   */
  clearDraftSize() {
    this.draft.size = 0;
  }

  /**
   * @returns {boolean}
   */
  canApply() {
    return this.normalizeSize(this.draft.size) > 0;
  }

  /**
   * Syncs preview outline for the currently selected layer.
   * @param {string|null} selectedLayerId
   * @returns {void}
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
   * Applies a real, baked border by increasing image pixels and layer bounds.
   * @param {any} selectedLayer
   * @returns {Promise<void>}
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
    selectedLayer.src = canvas.toDataURL("image/png");
    selectedLayer.x -= draft.size;
    selectedLayer.y -= draft.size;
    selectedLayer.width += draft.size * 2;
    selectedLayer.height += draft.size * 2;

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
    selectedLayer.cornerRadius = {
      lt: currentRadius.lt + draft.size,
      rt: currentRadius.rt + draft.size,
      rb: currentRadius.rb + draft.size,
      lb: currentRadius.lb + draft.size,
    };
    this.ensureLayerCornerRadius(selectedLayer);

    this.revokeBlobUrlIfNeeded(previousSrc);
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  normalizeSize(value) {
    return Math.max(0, Math.round(Number(value) || 0));
  }

  /**
   * @param {string} value
   * @returns {string}
   */
  normalizeColor(value) {
    const raw = String(value || "").trim().toUpperCase();
    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9A-F]{6}$/.test(withHash)) {
      return withHash;
    }
    return "#FFFFFF";
  }

  /**
   * @param {string} src
   * @returns {void}
   */
  revokeBlobUrlIfNeeded(src) {
    if (typeof src === "string" && src.startsWith("blob:")) {
      URL.revokeObjectURL(src);
    }
  }
}
