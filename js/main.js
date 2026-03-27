import { createAddLayerFlowController } from "./add-layer-flow.js";
import { openAddLayerPopup } from "./add-layer-popup.js";
import { createBackgroundRemovalController } from "./background-removal.js";
import { attachCropSelection } from "./crop-select.js";
import { attachDragSelection } from "./drag-select.js";
import { createEditorViewportController } from "./editor-viewport.js";
import { openExportPopup } from "./export-popup.js";
import {
  BUTTON_ZOOM_STEP,
  FILTER_PRESETS,
  KEYBOARD_ZOOM_STEP,
  MIN_LAYER_SIZE,
  PRESET_COLORS,
  TOOLBAR_HINTS,
  WHEEL_ZOOM_STEP,
} from "./constants/editor-constants.js";
import { LayerBorderController } from "./features/border/LayerBorderController.js";
import { createHistoryManager } from "./history-manager.js";
import { setupKeyboardShortcuts } from "./keyboard-shortcuts.js";
import { attachLayersPanelDragAndDrop } from "./layers-panel-dnd.js";
import {
  bringLayerToFront,
  buildLayerFilterString,
  createLayer,
  deleteLayerWithDescendants,
  duplicateLayerWithDescendants,
  ensureLayerCornerRadius,
  ensureLayerFilterDefaults,
  getDefaultLayerFilters,
  getDescendantLayerIds,
  getLayerById,
  getLayerChildren,
  getLayerCornerRadius,
  getLayerInsetShadow,
  getLayerShadowStyle,
  getLayersByZOrderDesc,
  getRootLayers,
  moveLayerWithChildren,
  renderLayers,
  setLayerBorderPreview,
  setLayerName,
  setSelectedLayer,
  syncLayerParentingForLayer,
} from "./layers.js";
import {
  createMetricsGrid,
  createNumberInput,
  createOptionRow,
  createSelectInput,
  createTextInput,
} from "./options-ui-helpers.js";
import { createRotateController } from "./rotate-controller.js";
import {
  getRotatedBoundingRect,
  mapPointToLayerLocal,
} from "./rotation-geometry.js";
import { createShadowTools } from "./shadow-tools.js";
import { state } from "./state.js";
import { createTextTools } from "./text-tools.js";

/**
 * Main runtime bootstrap for the image editor application.
 */
class EditorApplication {
  /**
   * Boots the editor app and wires DOM, state, tools, and handlers.
   * @return {void}
   */
  start() {
const stage = document.getElementById("editorStage");
const layerRoot = document.getElementById("layerRoot");
const addAction = document.getElementById("addAction");
const textAction = document.getElementById("textAction");
const optionsTitle = document.getElementById("optionsTitle");
const selectionBox = document.getElementById("selectionBox");
const rotateHandle = document.getElementById("rotateHandle");
const cropBox = document.getElementById("cropBox");
const marquee = document.getElementById("marquee");
const layersList = document.getElementById("layersList");
const optionsPanel = document.getElementById("optionsPanel");
const layersPanel = document.querySelector(".layers-panel");
const optionsSection = document.getElementById("optionsSection");
const layersSection = document.getElementById("layersSection");
const sidePanelResizeHandle = document.getElementById("sidePanelResizeHandle");
const modeSelect = document.getElementById("modeSelect");
const modeCrop = document.getElementById("modeCrop");
const modeRotate = document.getElementById("modeRotate");
const modeFilter = document.getElementById("modeFilter");
const modeShadow = document.getElementById("modeShadow");
const undoAction = document.getElementById("undoAction");
const redoAction = document.getElementById("redoAction");
const duplicateAction = document.getElementById("duplicateAction");
const removeBgAction = document.getElementById("removeBgAction");
const upscaleAction = document.getElementById("upscaleAction");
const deleteAction = document.getElementById("deleteAction");
const exportSelected = document.getElementById("exportSelected");
const zoomOut = document.getElementById("zoomOut");
const zoomReset = document.getElementById("zoomReset");
const zoomIn = document.getElementById("zoomIn");
let isApplyingCrop = false;
let isApplyingFilter = false;
let isApplyingBackgroundBlur = false;
let isExporting = false;
let isRemovingBackground = false;
let isUpscaling = false;
let isApplyingLayerBorder = false;
let upscaleAiInitPromise = null;
let isEyedropperActive = false;
let eyedropperPreview = null;
const eyedropperImageCache = new Map();
let layerBorderController = null;
let historyManager = null;
const backgroundRemovalController = createBackgroundRemovalController();
let addLayerFlowController = null;

const viewportController = createEditorViewportController({
  state,
  stage,
  zoomOut,
  zoomIn,
  zoomReset,
  buttonZoomStep: BUTTON_ZOOM_STEP,
  wheelZoomStep: WHEEL_ZOOM_STEP,
  onViewportUpdated: () => {
    refresh();
  },
});

const rotateController = createRotateController({
  state,
  stage,
  rotateHandle,
  setSelectedLayer,
  bringLayerToFront,
  getLayersByZOrderDesc,
  getLayerById,
  getDescendantLayerIds,
  loadImage,
  refresh,
  commitHistory,
  getWorldPointFromClient: (clientX, clientY) =>
    viewportController.getWorldPointFromClient(clientX, clientY),
});

function updateHistoryButtons() {
  if (!historyManager) {
    undoAction.disabled = true;
    redoAction.disabled = true;
    return;
  }

  undoAction.disabled = !historyManager.canUndo();
  redoAction.disabled = !historyManager.canRedo();
}

function commitHistory() {
  if (!historyManager) return;
  historyManager.commit();
  updateHistoryButtons();
}

const textTools = createTextTools({
  createLayer,
  state,
  setSelectedLayer,
  bringLayerToFront,
  refresh,
  commitHistory,
  createOptionRow,
  createSelectInput,
  appendOptionDivider,
});

const shadowTools = createShadowTools({
  getLayerById,
  getLayerShadowStyle,
  refresh,
  commitHistory,
  createOptionRow,
  createFilterControl,
  appendOptionDivider,
  createInlineNameEditor,
});

function applyEditorZoom() {
  viewportController.applyViewportTransform();
}

function setEditorZoom(nextZoom, anchorPoint = null) {
  viewportController.setZoom(nextZoom, anchorPoint);
}

function getStagePointFromClient(clientX, clientY) {
  return viewportController.getWorldPointFromClient(clientX, clientY);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image for crop."));
    img.src = src;
  });
}

layerBorderController = new LayerBorderController({
  getLayerById,
  setLayerBorderPreview,
  loadImage,
  ensureLayerCornerRadius,
  getLayerCornerRadius,
  state,
});

function loadImageForSampling(src) {
  if (!eyedropperImageCache.has(src)) {
    eyedropperImageCache.set(src, loadImage(src));
  }

  return eyedropperImageCache.get(src);
}

function getEyedropperPreviewEl() {
  if (eyedropperPreview) return eyedropperPreview;

  const preview = document.createElement("div");
  preview.className = "eyedropper-preview";
  preview.innerHTML =
    '<span class="eyedropper-preview-swatch"></span><span class="eyedropper-preview-code">#------</span>';
  preview.style.display = "none";
  stage.appendChild(preview);
  eyedropperPreview = preview;

  return eyedropperPreview;
}

function updateEyedropperPreview(point, color) {
  const preview = getEyedropperPreviewEl();
  const swatch = preview.querySelector(".eyedropper-preview-swatch");
  const code = preview.querySelector(".eyedropper-preview-code");

  if (swatch) {
    swatch.style.background = color || "transparent";
  }
  if (code) {
    code.textContent = color || "No pixel";
  }

  const zoom = Math.max(0.001, state.editorZoom || 1);
  const offsetX = state.editorOffsetX || 0;
  const offsetY = state.editorOffsetY || 0;
  const screenX = point.x * zoom + offsetX;
  const screenY = point.y * zoom + offsetY;

  preview.style.left = `${screenX + 14}px`;
  preview.style.top = `${screenY + 14}px`;
  preview.style.display = "inline-flex";
}

function hideEyedropperPreview() {
  if (!eyedropperPreview) return;
  eyedropperPreview.style.display = "none";
}

function getRectFromLayer(layer) {
  return {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
  };
}

function getBoundingRectForLayers(layers) {
  if (!Array.isArray(layers) || layers.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const layer of layers) {
    const rect = getRectFromLayer(layer);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function isRotatePreviewFillActive(layer) {
  return (
    state.mode === "rotate-select" &&
    Boolean(layer?.showOutsideBackground) &&
    Math.abs(Number(layer?.rotation) || 0) > 0.001
  );
}

function getSamplingRectForLayer(layer) {
  return isRotatePreviewFillActive(layer)
    ? getRotatedBoundingRect(layer)
    : getRectFromLayer(layer);
}

function intersectRect(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= x || bottom <= y) return null;

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function getAncestorVisibleRectForRegion(layer, regionRect) {
  let visibleRect = { ...regionRect };
  let ancestor = layer.parentId ? getLayerById(layer.parentId) : null;

  while (ancestor) {
    const hasActiveCrop =
      state.mode === "crop-select" &&
      state.cropSelection?.layerId === ancestor.id;

    const ancestorRect = hasActiveCrop
      ? {
          x: state.cropSelection.x,
          y: state.cropSelection.y,
          width: state.cropSelection.width,
          height: state.cropSelection.height,
        }
      : getRectFromLayer(ancestor);

    const nextVisible = intersectRect(visibleRect, ancestorRect);
    if (!nextVisible) return null;

    visibleRect = nextVisible;
    ancestor = ancestor.parentId ? getLayerById(ancestor.parentId) : null;
  }

  return visibleRect;
}

function isPointVisibleInLayer(layer, point) {
  if (!pointInRect(point, getSamplingRectForLayer(layer))) {
    return false;
  }

  let ancestor = layer.parentId ? getLayerById(layer.parentId) : null;
  while (ancestor) {
    const hasActiveCrop =
      state.mode === "crop-select" &&
      state.cropSelection?.layerId === ancestor.id;

    const ancestorRect = hasActiveCrop
      ? {
          x: state.cropSelection.x,
          y: state.cropSelection.y,
          width: state.cropSelection.width,
          height: state.cropSelection.height,
        }
      : getRectFromLayer(ancestor);

    if (!pointInRect(point, ancestorRect)) {
      return false;
    }

    ancestor = ancestor.parentId ? getLayerById(ancestor.parentId) : null;
  }

  return true;
}

function rgbToHex(r, g, b) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

async function sampleColorAtStagePoint(point) {
  const hitLayer = getLayersByZOrderDesc().find((layer) =>
    isPointVisibleInLayer(layer, point),
  );
  if (!hitLayer) return null;

  const img = await loadImageForSampling(hitLayer.src);

  const localPoint = mapPointToLayerLocal(point, hitLayer, {
    respectRotation: isRotatePreviewFillActive(hitLayer),
  });
  const localX = localPoint.x;
  const localY = localPoint.y;

  const isOutsideImage =
    localX < 0 ||
    localY < 0 ||
    localX > hitLayer.width ||
    localY > hitLayer.height;

  if (isOutsideImage) {
    if (
      isRotatePreviewFillActive(hitLayer) &&
      hitLayer.cropBackgroundMode !== "transparent"
    ) {
      return (hitLayer.cropBackgroundColor || "#ffffff").toUpperCase();
    }
    return null;
  }

  if (
    localX < 0 ||
    localY < 0 ||
    localX > hitLayer.width ||
    localY > hitLayer.height
  ) {
    return null;
  }

  const sourceX = Math.min(
    img.naturalWidth - 1,
    Math.max(
      0,
      Math.floor((localX / Math.max(1, hitLayer.width)) * img.naturalWidth),
    ),
  );
  const sourceY = Math.min(
    img.naturalHeight - 1,
    Math.max(
      0,
      Math.floor((localY / Math.max(1, hitLayer.height)) * img.naturalHeight),
    ),
  );

  const swatch = document.createElement("canvas");
  swatch.width = 1;
  swatch.height = 1;
  const swatchCtx = swatch.getContext("2d", { willReadFrequently: true });
  if (!swatchCtx) return null;

  swatchCtx.drawImage(img, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
  const pixel = swatchCtx.getImageData(0, 0, 1, 1).data;
  return rgbToHex(pixel[0], pixel[1], pixel[2]);
}

function setEyedropperActive(active) {
  isEyedropperActive = active;
  stage.classList.toggle("eyedropper-active", active);

  if (!active) {
    hideEyedropperPreview();
  }
}

function setupEyedropperSampling() {
  stage.addEventListener(
    "pointermove",
    async (event) => {
      if (!isEyedropperActive) return;

      const point = getStagePointFromClient(event.clientX, event.clientY);
      const sampledColor = await sampleColorAtStagePoint(point);
      updateEyedropperPreview(point, sampledColor);
    },
    true,
  );

  stage.addEventListener(
    "pointerleave",
    () => {
      if (!isEyedropperActive) return;
      hideEyedropperPreview();
    },
    true,
  );

  stage.addEventListener(
    "pointerdown",
    async (event) => {
      if (!isEyedropperActive) return;
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      try {
        const point = getStagePointFromClient(event.clientX, event.clientY);
        const sampledColor = await sampleColorAtStagePoint(point);
        const selected = getLayerById(state.selectedLayerId);
        if (selected && sampledColor) {
          ensureLayerDefaults(selected);
          selected.cropBackgroundMode = "solid";
          selected.cropBackgroundColor = sampledColor;
          setEyedropperActive(false);
          refresh({ rerenderOptions: true, rerenderLayersPanel: false });
          commitHistory();
          return;
        }
      } catch (error) {
        console.error(error);
      }
    },
    true,
  );
}

async function renderLayerRegionToCanvas(
  selected,
  regionRect,
  { fillBackground = true, clipRect = null, backgroundColor = "#ffffff" } = {},
) {
  const img = await loadImage(selected.src);

  const scaleX = img.naturalWidth / Math.max(1, selected.width);
  const scaleY = img.naturalHeight / Math.max(1, selected.height);

  const outWidth = Math.max(1, Math.round(regionRect.width * scaleX));
  const outHeight = Math.max(1, Math.round(regionRect.height * scaleY));

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  if (fillBackground) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, outWidth, outHeight);
  } else {
    ctx.clearRect(0, 0, outWidth, outHeight);
  }

  const drawX = (selected.x - regionRect.x) * scaleX;
  const drawY = (selected.y - regionRect.y) * scaleY;
  const drawWidth = selected.width * scaleX;
  const drawHeight = selected.height * scaleY;
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

  if (clipRect) {
    const clipX = (clipRect.x - regionRect.x) * scaleX;
    const clipY = (clipRect.y - regionRect.y) * scaleY;
    const clipWidth = clipRect.width * scaleX;
    const clipHeight = clipRect.height * scaleY;

    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "#000000";
    ctx.fillRect(clipX, clipY, clipWidth, clipHeight);
    ctx.globalCompositeOperation = "source-over";
  }

  return { canvas, scaleX, scaleY };
}

async function renderFilteredLayerToCanvas(layer) {
  ensureLayerDefaults(layer);
  const img = await loadImage(layer.src);
  const filterString = buildLayerFilterString(layer);

  const outWidth = Math.max(1, img.naturalWidth || img.width || 1);
  const outHeight = Math.max(1, img.naturalHeight || img.height || 1);

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.clearRect(0, 0, outWidth, outHeight);
  ctx.filter = filterString;
  ctx.drawImage(img, 0, 0, outWidth, outHeight);

  const insetShadow = getLayerInsetShadow(layer);
  if (
    insetShadow.opacity > 0 &&
    (insetShadow.blur > 0 || insetShadow.x !== 0 || insetShadow.y !== 0)
  ) {
    const shadowCanvas = buildInsetShadowCanvas(
      img,
      outWidth,
      outHeight,
      filterString,
      insetShadow,
    );
    ctx.drawImage(shadowCanvas, 0, 0);
  }

  return canvas;
}

function buildInsetShadowCanvas(
  image,
  width,
  height,
  filterString,
  insetShadow,
) {
  const outWidth = Math.max(1, Math.round(width));
  const outHeight = Math.max(1, Math.round(height));

  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = outWidth;
  alphaCanvas.height = outHeight;
  const alphaCtx = alphaCanvas.getContext("2d");
  if (!alphaCtx) {
    throw new Error("Canvas is not available.");
  }
  alphaCtx.imageSmoothingEnabled = true;
  alphaCtx.imageSmoothingQuality = "high";
  alphaCtx.filter = filterString;
  alphaCtx.drawImage(image, 0, 0, outWidth, outHeight);

  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = outWidth;
  shadowCanvas.height = outHeight;
  const shadowCtx = shadowCanvas.getContext("2d");
  if (!shadowCtx) {
    throw new Error("Canvas is not available.");
  }

  // Build a color layer clipped to image alpha, then subtract a shifted/blurred
  // alpha mask to keep only inner-edge shadow (prevents full-frame dark fill).
  shadowCtx.clearRect(0, 0, outWidth, outHeight);
  shadowCtx.fillStyle = insetShadow.cssColor;
  shadowCtx.fillRect(0, 0, outWidth, outHeight);
  shadowCtx.globalCompositeOperation = "destination-in";
  shadowCtx.drawImage(alphaCanvas, 0, 0);

  const eraseCanvas = document.createElement("canvas");
  eraseCanvas.width = outWidth;
  eraseCanvas.height = outHeight;
  const eraseCtx = eraseCanvas.getContext("2d");
  if (!eraseCtx) {
    throw new Error("Canvas is not available.");
  }
  eraseCtx.clearRect(0, 0, outWidth, outHeight);
  const blurValue = Math.max(0, Number(insetShadow.blur) || 0);
  eraseCtx.filter = blurValue > 0 ? `blur(${blurValue}px)` : "none";
  eraseCtx.drawImage(
    alphaCanvas,
    -(Number(insetShadow.x) || 0),
    -(Number(insetShadow.y) || 0),
  );
  eraseCtx.filter = "none";

  shadowCtx.globalCompositeOperation = "destination-out";
  shadowCtx.drawImage(eraseCanvas, 0, 0);
  shadowCtx.globalCompositeOperation = "source-over";

  return shadowCanvas;
}

function buildObjectStrokeFilterChain(strokeSize, strokeColor) {
  const size = Math.max(0, Number(strokeSize) || 0);
  if (size <= 0) return "";
  const color = String(strokeColor || "#000000");
  return [
    `drop-shadow(${size}px 0 0 ${color})`,
    `drop-shadow(${-size}px 0 0 ${color})`,
    `drop-shadow(0 ${size}px 0 ${color})`,
    `drop-shadow(0 ${-size}px 0 ${color})`,
    `drop-shadow(${size}px ${size}px 0 ${color})`,
    `drop-shadow(${-size}px ${size}px 0 ${color})`,
    `drop-shadow(${size}px ${-size}px 0 ${color})`,
    `drop-shadow(${-size}px ${-size}px 0 ${color})`,
  ].join(" ");
}

function bakeObjectStrokeIntoCanvas(sourceCanvas, strokeSize, strokeColor) {
  const filterChain = buildObjectStrokeFilterChain(strokeSize, strokeColor);
  if (!filterChain) return sourceCanvas;

  const output = document.createElement("canvas");
  output.width = sourceCanvas.width;
  output.height = sourceCanvas.height;
  const outputCtx = output.getContext("2d");
  if (!outputCtx) {
    throw new Error("Canvas is not available.");
  }

  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = "high";
  outputCtx.filter = filterChain;
  outputCtx.drawImage(sourceCanvas, 0, 0, output.width, output.height);
  outputCtx.filter = "none";

  return output;
}

async function buildUpscaleSourceDrawable(layer) {
  const sourceImage = await loadImage(layer.src);
  const width = Math.max(1, sourceImage.naturalWidth || sourceImage.width || 1);
  const height = Math.max(
    1,
    sourceImage.naturalHeight || sourceImage.height || 1,
  );

  const base = document.createElement("canvas");
  base.width = width;
  base.height = height;
  const baseCtx = base.getContext("2d");
  if (!baseCtx) {
    throw new Error("Canvas is not available.");
  }
  baseCtx.imageSmoothingEnabled = true;
  baseCtx.imageSmoothingQuality = "high";
  baseCtx.drawImage(sourceImage, 0, 0, width, height);

  const shadowStyle = getLayerShadowStyle(layer);
  const shouldBakeStroke =
    shadowStyle.enabled &&
    shadowStyle.resolvedMode === "object" &&
    shadowStyle.strokeSize > 0;

  if (!shouldBakeStroke) {
    return { drawable: base, bakedStroke: false };
  }

  return {
    drawable: bakeObjectStrokeIntoCanvas(
      base,
      shadowStyle.strokeSize,
      shadowStyle.strokeColor,
    ),
    bakedStroke: true,
  };
}

function getExportLayersForSelection(selectedLayer) {
  const targetIds = new Set([
    selectedLayer.id,
    ...getDescendantLayerIds(selectedLayer.id),
  ]);

  // Draw from back to front using editor paint order.
  return getLayersByZOrderDesc()
    .reverse()
    .filter((layer) => targetIds.has(layer.id));
}

function getApplyFilterTargetLayers(selectedLayer) {
  const targetIds = new Set([selectedLayer.id]);
  const visitQueue = [
    selectedLayer.id,
    ...getDescendantLayerIds(selectedLayer.id),
  ];

  while (visitQueue.length > 0) {
    const layerId = visitQueue.shift();
    if (!layerId || targetIds.has(layerId)) continue;
    targetIds.add(layerId);

    const layer = getLayerById(layerId);
    if (!layer) continue;

    if (
      layer.linkedBackgroundLayerId &&
      !targetIds.has(layer.linkedBackgroundLayerId)
    ) {
      visitQueue.push(layer.linkedBackgroundLayerId);
    }
    if (
      layer.linkedSubjectLayerId &&
      !targetIds.has(layer.linkedSubjectLayerId)
    ) {
      visitQueue.push(layer.linkedSubjectLayerId);
    }
  }

  return state.layers.filter((layer) => targetIds.has(layer.id));
}

async function renderCompositeLayersToCanvas(
  baseLayer,
  layers,
  regionRect,
  { fillBackground = false } = {},
) {
  const loadedEntries = await Promise.all(
    layers.map(async (layer) => {
      const img = await loadImage(layer.src);
      return {
        layer,
        img,
        layerScaleX: img.naturalWidth / Math.max(1, layer.width),
        layerScaleY: img.naturalHeight / Math.max(1, layer.height),
      };
    }),
  );

  const fallbackScaleX =
    loadedEntries.find((entry) => entry.layer.id === baseLayer.id)
      ?.layerScaleX || 1;
  const fallbackScaleY =
    loadedEntries.find((entry) => entry.layer.id === baseLayer.id)
      ?.layerScaleY || 1;

  // Use the highest pixel density found in the exported stack to reduce quality loss.
  const scaleX = Math.max(
    fallbackScaleX,
    ...loadedEntries.map((entry) => entry.layerScaleX),
  );
  const scaleY = Math.max(
    fallbackScaleY,
    ...loadedEntries.map((entry) => entry.layerScaleY),
  );

  const outWidth = Math.max(1, Math.round(regionRect.width * scaleX));
  const outHeight = Math.max(1, Math.round(regionRect.height * scaleY));

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (fillBackground) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outWidth, outHeight);
  } else {
    ctx.clearRect(0, 0, outWidth, outHeight);
  }

  for (const entry of loadedEntries) {
    const layer = entry.layer;
    const img = entry.img;
    const filterString = buildLayerFilterString(layer);

    const layerRect = getRectFromLayer(layer);
    const clippedByRegion = intersectRect(layerRect, regionRect);
    if (!clippedByRegion) continue;

    const visibleByAncestors = getAncestorVisibleRectForRegion(
      layer,
      layerRect,
    );
    if (!visibleByAncestors) continue;

    const visibleRect = intersectRect(clippedByRegion, visibleByAncestors);
    if (!visibleRect) continue;

    const clipX = (visibleRect.x - regionRect.x) * scaleX;
    const clipY = (visibleRect.y - regionRect.y) * scaleY;
    const clipWidth = visibleRect.width * scaleX;
    const clipHeight = visibleRect.height * scaleY;

    const drawX = (layer.x - regionRect.x) * scaleX;
    const drawY = (layer.y - regionRect.y) * scaleY;
    const drawWidth = layer.width * scaleX;
    const drawHeight = layer.height * scaleY;

    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, clipY, clipWidth, clipHeight);
    ctx.clip();
    const layerOpacity = Number.isFinite(Number(layer.opacity))
      ? Math.max(0, Math.min(1, Number(layer.opacity)))
      : 1;
    ctx.globalAlpha = layerOpacity;
    ctx.filter = filterString;
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    const insetShadow = getLayerInsetShadow(layer);
    if (
      insetShadow.opacity > 0 &&
      (insetShadow.blur > 0 || insetShadow.x !== 0 || insetShadow.y !== 0)
    ) {
      const shadowCanvas = buildInsetShadowCanvas(
        img,
        drawWidth,
        drawHeight,
        filterString,
        insetShadow,
      );
      ctx.drawImage(shadowCanvas, drawX, drawY, drawWidth, drawHeight);
    }
    ctx.restore();
  }

  return { canvas, scaleX, scaleY };
}

function downloadCanvas(canvas, filenameBase) {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${filenameBase}.png`;
  link.click();
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to encode exported image."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function resizeCanvasWithQuality(sourceCanvas, width, height) {
  if (sourceCanvas.width === width && sourceCanvas.height === height) {
    return sourceCanvas;
  }

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;

  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  return out;
}

function quantizeCanvasColors(sourceCanvas, levels) {
  const clampedLevels = Math.max(2, Math.floor(levels));
  const out = document.createElement("canvas");
  out.width = sourceCanvas.width;
  out.height = sourceCanvas.height;

  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available.");

  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;
  const scale = (clampedLevels - 1) / 255;
  const unscale = 255 / (clampedLevels - 1);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(Math.round(data[i] * scale) * unscale);
    data[i + 1] = Math.round(Math.round(data[i + 1] * scale) * unscale);
    data[i + 2] = Math.round(Math.round(data[i + 2] * scale) * unscale);
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

function applySharpenToCanvas(sourceCanvas, amount = 0.28) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available.");

  ctx.drawImage(sourceCanvas, 0, 0);
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const srcData = src.data;
  const out = ctx.createImageData(canvas.width, canvas.height);
  const outData = out.data;

  const width = canvas.width;
  const height = canvas.height;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        let accum = 0;
        let kernelIndex = 0;

        for (let ky = -1; ky <= 1; ky += 1) {
          const py = Math.min(height - 1, Math.max(0, y + ky));
          for (let kx = -1; kx <= 1; kx += 1) {
            const px = Math.min(width - 1, Math.max(0, x + kx));
            const pidx = (py * width + px) * 4;
            accum += srcData[pidx + channel] * kernel[kernelIndex];
            kernelIndex += 1;
          }
        }

        const original = srcData[idx + channel];
        const sharpened = Math.min(255, Math.max(0, accum));
        outData[idx + channel] = Math.round(
          original * (1 - amount) + sharpened * amount,
        );
      }

      outData[idx + 3] = srcData[idx + 3];
    }
  }

  ctx.putImageData(out, 0, 0);
  const shadowStyle = getLayerShadowStyle(layer);
  if (
    shadowStyle.enabled &&
    shadowStyle.resolvedMode === "object" &&
    shadowStyle.strokeSize > 0
  ) {
    return bakeObjectStrokeIntoCanvas(
      canvas,
      shadowStyle.strokeSize,
      shadowStyle.strokeColor,
    );
  }

  return canvas;
}

function upscaleImageEnhanced(image, targetWidth, targetHeight) {
  const srcW = Math.max(1, image.naturalWidth || image.width || targetWidth);
  const srcH = Math.max(1, image.naturalHeight || image.height || targetHeight);

  const base = document.createElement("canvas");
  base.width = srcW;
  base.height = srcH;
  const baseCtx = base.getContext("2d");
  if (!baseCtx) throw new Error("Canvas is not available.");
  baseCtx.imageSmoothingEnabled = true;
  baseCtx.imageSmoothingQuality = "high";
  baseCtx.drawImage(image, 0, 0, srcW, srcH);

  let working = base;
  const growthStep = 1.45;

  while (working.width < targetWidth || working.height < targetHeight) {
    const nextW = Math.min(targetWidth, Math.round(working.width * growthStep));
    const nextH = Math.min(
      targetHeight,
      Math.round(working.height * growthStep),
    );

    const staged = document.createElement("canvas");
    staged.width = Math.max(1, nextW);
    staged.height = Math.max(1, nextH);
    const stagedCtx = staged.getContext("2d");
    if (!stagedCtx) throw new Error("Canvas is not available.");
    stagedCtx.imageSmoothingEnabled = true;
    stagedCtx.imageSmoothingQuality = "high";
    stagedCtx.drawImage(working, 0, 0, staged.width, staged.height);

    working = staged;
  }

  return applySharpenToCanvas(working, 0.24);
}

async function getUpscaleAi() {
  if (upscaleAiInitPromise) {
    return upscaleAiInitPromise;
  }

  upscaleAiInitPromise = (async () => {
    try {
      const module =
        await import("https://cdn.jsdelivr.net/npm/upscaler@1.0.0-beta.16/+esm");
      const UpscalerCtor = module?.default || module?.Upscaler || module;
      if (typeof UpscalerCtor !== "function") {
        throw new Error("Upscaler constructor not found");
      }

      const instance = new UpscalerCtor();
      if (typeof instance?.upscale !== "function") {
        throw new Error("Upscaler method unavailable");
      }

      return instance;
    } catch (error) {
      console.warn("AI upscaler unavailable, using local fallback.", error);
      return null;
    }
  })();

  return upscaleAiInitPromise;
}

async function normalizeUpscaleOutputToCanvas(
  output,
  targetWidth,
  targetHeight,
) {
  const drawToSizedCanvas = (drawable, width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(drawable, 0, 0, width, height);
    return canvas;
  };

  if (output instanceof HTMLCanvasElement) {
    if (output.width === targetWidth && output.height === targetHeight) {
      return output;
    }

    return drawToSizedCanvas(output, targetWidth, targetHeight);
  }

  if (output instanceof ImageData) {
    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    ctx.putImageData(output, 0, 0);
    return normalizeUpscaleOutputToCanvas(canvas, targetWidth, targetHeight);
  }

  if (
    output instanceof HTMLImageElement ||
    output instanceof SVGImageElement ||
    output instanceof ImageBitmap
  ) {
    return drawToSizedCanvas(output, targetWidth, targetHeight);
  }

  if (typeof output === "string" && output.length > 0) {
    const img = await loadImage(output);
    return drawToSizedCanvas(img, targetWidth, targetHeight);
  }

  if (output && typeof output === "object") {
    if (typeof output.src === "string") {
      const img = await loadImage(output.src);
      return drawToSizedCanvas(img, targetWidth, targetHeight);
    }

    const tensorLikeShape = Array.isArray(output.shape) ? output.shape : null;
    if (tensorLikeShape && typeof output.dataSync === "function") {
      const tensorData = output.dataSync();
      const outH = Number(tensorLikeShape[0]) || targetHeight;
      const outW = Number(tensorLikeShape[1]) || targetWidth;
      const channels = Number(tensorLikeShape[2]) || 3;
      if (channels >= 3 && tensorData?.length >= outW * outH * channels) {
        const imageData = new ImageData(outW, outH);
        for (let i = 0, p = 0; i < outW * outH; i += 1, p += 4) {
          const base = i * channels;
          imageData.data[p] = Math.max(
            0,
            Math.min(255, Math.round(tensorData[base] * 255)),
          );
          imageData.data[p + 1] = Math.max(
            0,
            Math.min(255, Math.round(tensorData[base + 1] * 255)),
          );
          imageData.data[p + 2] = Math.max(
            0,
            Math.min(255, Math.round(tensorData[base + 2] * 255)),
          );
          imageData.data[p + 3] = 255;
        }

        const tensorCanvas = document.createElement("canvas");
        tensorCanvas.width = outW;
        tensorCanvas.height = outH;
        const tensorCtx = tensorCanvas.getContext("2d");
        if (!tensorCtx) throw new Error("Canvas is not available.");
        tensorCtx.putImageData(imageData, 0, 0);
        return drawToSizedCanvas(tensorCanvas, targetWidth, targetHeight);
      }
    }

    if (
      output.data &&
      Number.isFinite(Number(output.width)) &&
      Number.isFinite(Number(output.height))
    ) {
      const outW = Math.max(1, Math.round(Number(output.width)));
      const outH = Math.max(1, Math.round(Number(output.height)));
      const raw = output.data;
      const arr =
        raw instanceof Uint8ClampedArray
          ? raw
          : raw instanceof Uint8Array
            ? new Uint8ClampedArray(raw)
            : null;
      if (arr && arr.length >= outW * outH * 4) {
        const imageData = new ImageData(arr, outW, outH);
        const rawCanvas = document.createElement("canvas");
        rawCanvas.width = outW;
        rawCanvas.height = outH;
        const rawCtx = rawCanvas.getContext("2d");
        if (!rawCtx) throw new Error("Canvas is not available.");
        rawCtx.putImageData(imageData, 0, 0);
        return drawToSizedCanvas(rawCanvas, targetWidth, targetHeight);
      }
    }
  }

  throw new Error("Unsupported AI upscale output type");
}

async function upscaleImageAiFirst(image, targetWidth, targetHeight) {
  const aiUpscaler = await getUpscaleAi();
  if (aiUpscaler) {
    try {
      const aiResult = await aiUpscaler.upscale(image, {
        output: "base64",
        patchSize: 96,
        padding: 8,
      });

      const canvas = await normalizeUpscaleOutputToCanvas(
        aiResult,
        targetWidth,
        targetHeight,
      );
      return { canvas, usedAi: true };
    } catch (error) {
      console.warn("AI upscale failed, falling back to local upscale.", error);
    }
  }

  return {
    canvas: upscaleImageEnhanced(image, targetWidth, targetHeight),
    usedAi: false,
  };
}

function getFormatInfo(format) {
  if (format === "jpg") {
    return { mimeType: "image/jpeg", extension: "jpg", isLossy: true };
  }

  if (format === "jpeg") {
    return { mimeType: "image/jpeg", extension: "jpeg", isLossy: true };
  }

  if (format === "webp") {
    return { mimeType: "image/webp", extension: "webp", isLossy: true };
  }

  return { mimeType: "image/png", extension: "png", isLossy: false };
}

async function encodeByQualityPreset(canvas, preset, format) {
  const formatInfo = getFormatInfo(format);
  if (!formatInfo.isLossy) {
    if (preset === "original") {
      const blob = await canvasToBlob(canvas, "image/png");
      return { blob, extension: "png" };
    }

    const pngLevelsByPreset = {
      high: 128,
      medium: 64,
      low: 32,
    };
    const quantizedCanvas = quantizeCanvasColors(
      canvas,
      pngLevelsByPreset[preset] ?? pngLevelsByPreset.high,
    );
    const blob = await canvasToBlob(quantizedCanvas, "image/png");
    return { blob, extension: "png" };
  }

  if (preset === "original") {
    const blob = await canvasToBlob(canvas, formatInfo.mimeType);
    return { blob, extension: formatInfo.extension };
  }

  const qualityMap = {
    high: 0.92,
    medium: 0.75,
    low: 0.55,
  };

  const quality = qualityMap[preset] ?? qualityMap.high;
  const blob = await canvasToBlob(canvas, formatInfo.mimeType, quality);
  return { blob, extension: formatInfo.extension };
}

async function encodeByTargetSize(canvas, targetBytes, format) {
  const formatInfo = getFormatInfo(format);
  if (!formatInfo.isLossy) {
    const originalBlob = await canvasToBlob(canvas, "image/png");
    if (originalBlob.size <= targetBytes) {
      return { blob: originalBlob, extension: "png" };
    }

    let bestBlob = null;
    let smallestBlob = originalBlob;
    let low = 0.1;
    let high = 1;

    for (let i = 0; i < 10; i += 1) {
      const scale = (low + high) / 2;
      const scaledWidth = Math.max(1, Math.round(canvas.width * scale));
      const scaledHeight = Math.max(1, Math.round(canvas.height * scale));
      const resizedCanvas = resizeCanvasWithQuality(
        canvas,
        scaledWidth,
        scaledHeight,
      );
      const blob = await canvasToBlob(resizedCanvas, "image/png");

      if (blob.size < smallestBlob.size) {
        smallestBlob = blob;
      }

      if (blob.size <= targetBytes) {
        bestBlob = blob;
        low = scale;
      } else {
        high = scale;
      }
    }

    return { blob: bestBlob || smallestBlob, extension: "png" };
  }

  let low = 0.1;
  let high = 0.98;
  let bestBlob = null;
  let smallestBlob = null;

  for (let i = 0; i < 9; i += 1) {
    const mid = (low + high) / 2;
    const blob = await canvasToBlob(canvas, formatInfo.mimeType, mid);

    if (!smallestBlob || blob.size < smallestBlob.size) {
      smallestBlob = blob;
    }

    if (blob.size <= targetBytes) {
      bestBlob = blob;
      low = mid;
    } else {
      high = mid;
    }
  }

  return {
    blob: bestBlob || smallestBlob,
    extension: formatInfo.extension,
  };
}

async function applyCropSelection() {
  if (isApplyingCrop) return;

  const selected = getLayerById(state.selectedLayerId);
  if (!selected || !state.cropSelection) return;
  if (state.cropSelection.layerId !== selected.id) return;

  isApplyingCrop = true;

  try {
    const crop = state.cropSelection;
    const isTransparentBackground =
      selected.cropBackgroundMode === "transparent";

    const { canvas } = await renderLayerRegionToCanvas(selected, crop, {
      fillBackground: !isTransparentBackground,
      clipRect: null,
      backgroundColor: selected.cropBackgroundColor || "#ffffff",
    });

    selected.src = canvas.toDataURL("image/png");
    selected.x = crop.x;
    selected.y = crop.y;
    selected.width = crop.width;
    selected.height = crop.height;

    state.cropSelection = {
      layerId: selected.id,
      x: selected.x,
      y: selected.y,
      width: selected.width,
      height: selected.height,
    };

    refresh();
    commitHistory();
  } catch (error) {
    console.error(error);
  } finally {
    isApplyingCrop = false;
  }
}

function getDefaultFiltersForLayerSize(layer) {
  return {
    ...getDefaultLayerFilters(),
    backgroundBlurAmount: Number(layer?.filters?.backgroundBlurAmount) || 14,
  };
}

function getLinkedBackgroundLayer(selectedLayer) {
  if (!selectedLayer?.linkedBackgroundLayerId) return null;
  const linked = getLayerById(selectedLayer.linkedBackgroundLayerId);
  if (!linked) return null;
  if (linked.linkedSubjectLayerId !== selectedLayer.id) return null;
  return linked;
}

function syncLinkedBackgroundFilters(selectedLayer) {
  const linkedBackgroundLayer = getLinkedBackgroundLayer(selectedLayer);
  if (!linkedBackgroundLayer) return;

  ensureLayerDefaults(selectedLayer);
  ensureLayerDefaults(linkedBackgroundLayer);

  const amount = Math.max(
    0,
    Math.min(15, Number(selectedLayer.filters.backgroundBlurAmount) || 0),
  );
  const {
    shadowX: _ignoredShadowX,
    shadowY: _ignoredShadowY,
    shadowBlur: _ignoredShadowBlur,
    shadowOpacity: _ignoredShadowOpacity,
    shadowColor: _ignoredShadowColor,
    ...sharedWithoutShadow
  } = selectedLayer.filters;

  linkedBackgroundLayer.filters = {
    ...sharedWithoutShadow,
    blur: amount,
    shadowX: 0,
    shadowY: 0,
    shadowBlur: 0,
    shadowOpacity: 0,
    backgroundBlurAmount: amount,
  };
}

function syncSelectedFiltersToChildren(selectedLayer) {
  ensureLayerDefaults(selectedLayer);
  const {
    backgroundBlurAmount: _ignoredBackgroundBlurAmount,
    shadowX: _ignoredShadowX,
    shadowY: _ignoredShadowY,
    shadowBlur: _ignoredShadowBlur,
    shadowOpacity: _ignoredShadowOpacity,
    shadowColor: _ignoredShadowColor,
    ...sharedFilters
  } = selectedLayer.filters;
  const amount = Math.max(
    0,
    Math.min(15, Number(selectedLayer.filters.backgroundBlurAmount) || 0),
  );

  const targets = getApplyFilterTargetLayers(selectedLayer).filter(
    (layer) => layer.id !== selectedLayer.id,
  );

  for (const target of targets) {
    ensureLayerDefaults(target);
    const targetBackgroundBlurAmount = Math.max(
      0,
      Math.min(15, Number(target.filters.backgroundBlurAmount) || 0),
    );

    target.filters = {
      ...target.filters,
      ...sharedFilters,
      backgroundBlurAmount: targetBackgroundBlurAmount,
    };
  }

  syncLinkedBackgroundFilters(selectedLayer);
}

function revokeBlobUrlIfNeeded(src) {
  if (typeof src === "string" && src.startsWith("blob:")) {
    URL.revokeObjectURL(src);
  }
}

async function applyFilterSelection() {
  if (isApplyingFilter) return;

  const selected = getLayerById(state.selectedLayerId);
  if (!selected) return;

  isApplyingFilter = true;
  refresh({ rerenderOptions: true, rerenderLayersPanel: false });

  try {
    // Keep parent and descendants in lockstep before baking filter pixels.
    syncSelectedFiltersToChildren(selected);
    const targets = getApplyFilterTargetLayers(selected);

    for (const target of targets) {
      ensureLayerDefaults(target);
      const shadowStyle = getLayerShadowStyle(target);
      const shouldBakeStroke =
        shadowStyle.enabled &&
        shadowStyle.resolvedMode === "object" &&
        shadowStyle.strokeSize > 0;

      const previousSrc = target.src;
      const canvas = await renderFilteredLayerToCanvas(target);
      target.src = canvas.toDataURL("image/png");
      target.filters = getDefaultFiltersForLayerSize(target);
      if (shouldBakeStroke && target.shadowStyle) {
        target.shadowStyle.strokeSize = 0;
      }

      revokeBlobUrlIfNeeded(previousSrc);
    }

    syncLinkedBackgroundFilters(selected);
    refresh();
    commitHistory();
  } catch (error) {
    console.error("Failed to apply filter", error);
    window.alert(`Filter apply failed: ${error?.message || "Unknown error"}`);
  } finally {
    isApplyingFilter = false;
    refresh({ rerenderOptions: true, rerenderLayersPanel: false });
  }
}

function isMergeCandidateLayer(layer) {
  if (!layer) return false;
  if (layer.backgroundBlurRole === "background") return false;

  const visibleChildren = getLayerChildren(layer.id).filter(
    (child) => child.backgroundBlurRole !== "background",
  );
  return visibleChildren.length > 0;
}

async function mergeSelectedLayerTree() {
  const selected = getLayerById(state.selectedLayerId);
  if (!selected) return;
  if (!isMergeCandidateLayer(selected)) return;

  const targets = getApplyFilterTargetLayers(selected);
  if (targets.length < 2) return;

  const targetIds = new Set(targets.map((layer) => layer.id));
  const orderedTargets = getLayersByZOrderDesc()
    .reverse()
    .filter((layer) => targetIds.has(layer.id));

  const mergeRect = getBoundingRectForLayers(orderedTargets);
  if (!mergeRect) return;

  try {
    const previousSelectedSrc = selected.src;
    const { canvas } = await renderCompositeLayersToCanvas(
      selected,
      orderedTargets,
      mergeRect,
      { fillBackground: false },
    );

    const removedIds = new Set(
      orderedTargets
        .filter((layer) => layer.id !== selected.id)
        .map((layer) => layer.id),
    );

    for (const layer of orderedTargets) {
      if (layer.id === selected.id) continue;
      revokeBlobUrlIfNeeded(layer.src);
    }

    selected.src = canvas.toDataURL("image/png");
    selected.x = mergeRect.x;
    selected.y = mergeRect.y;
    selected.width = mergeRect.width;
    selected.height = mergeRect.height;
    selected.filters = getDefaultFiltersForLayerSize(selected);
    delete selected.linkedBackgroundLayerId;
    delete selected.linkedSubjectLayerId;
    delete selected.backgroundBlurRole;

    state.layers = state.layers.filter((layer) => !removedIds.has(layer.id));

    for (const layer of state.layers) {
      if (
        layer.linkedBackgroundLayerId &&
        removedIds.has(layer.linkedBackgroundLayerId)
      ) {
        delete layer.linkedBackgroundLayerId;
      }
      if (
        layer.linkedSubjectLayerId &&
        removedIds.has(layer.linkedSubjectLayerId)
      ) {
        delete layer.linkedSubjectLayerId;
      }
      if (layer.parentId && removedIds.has(layer.parentId)) {
        layer.parentId = null;
      }
    }

    if (state.cropSelection && removedIds.has(state.cropSelection.layerId)) {
      state.cropSelection = null;
    }

    revokeBlobUrlIfNeeded(previousSelectedSrc);

    refresh();
    commitHistory();
  } catch (error) {
    console.error("Failed to merge selected layer tree", error);
    window.alert(`Merge failed: ${error?.message || "Unknown error"}`);
  }
}

async function applyBackgroundBlurSelection() {
  if (isApplyingBackgroundBlur || isRemovingBackground) return;

  const selected = getLayerById(state.selectedLayerId);
  if (!selected) return;

  const selectedId = selected.id;
  const originalSrc = selected.src;

  ensureLayerDefaults(selected);
  const blurAmount = Math.max(
    0,
    Math.min(
      15,
      Math.round((Number(selected.filters.backgroundBlurAmount) || 14) * 5) / 5,
    ),
  );

  isApplyingBackgroundBlur = true;
  selected.isRemovingBackground = true;
  refresh({ rerenderOptions: true, rerenderLayersPanel: false });
  updateModeButtons();

  try {
    const outputBlob =
      await backgroundRemovalController.removeBackground(originalSrc);
    const subjectSrc = URL.createObjectURL(outputBlob);
    const layer = getLayerById(selectedId);
    if (!layer) {
      URL.revokeObjectURL(subjectSrc);
      return;
    }

    ensureLayerDefaults(layer);
    const baseFilters = {
      ...getDefaultFiltersForLayerSize(layer),
      ...layer.filters,
      backgroundBlurAmount: blurAmount,
    };

    const originalZ = Number(layer.zOrder) || 0;
    const baseName = layer.name || layer.id;
    const parentId = layer.parentId || null;

    const existingBackgroundLayer = getLinkedBackgroundLayer(layer);
    if (existingBackgroundLayer) {
      state.layers = state.layers.filter(
        (entry) => entry.id !== existingBackgroundLayer.id,
      );
    }
    delete layer.linkedBackgroundLayerId;

    const backgroundLayer = createLayer(originalSrc, layer.width, layer.height);
    backgroundLayer.name = `${baseName} background`;
    backgroundLayer.x = layer.x;
    backgroundLayer.y = layer.y;
    backgroundLayer.parentId = parentId;
    backgroundLayer.zOrder = originalZ - 0.001;
    backgroundLayer.backgroundBlurRole = "background";
    backgroundLayer.linkedSubjectLayerId = layer.id;
    backgroundLayer.opacity = 1;
    ensureLayerDefaults(backgroundLayer);
    backgroundLayer.filters = {
      ...baseFilters,
      blur: blurAmount,
      shadowOpacity: 0,
      backgroundBlurAmount: blurAmount,
    };

    layer.src = subjectSrc;
    layer.zOrder = originalZ + 0.001;
    layer.backgroundBlurRole = "subject";
    layer.linkedBackgroundLayerId = backgroundLayer.id;
    layer.filters = {
      ...baseFilters,
      blur: 0,
      backgroundBlurAmount: blurAmount,
    };
    layer.isRemovingBackground = false;

    state.layers.push(backgroundLayer);

    const flashToken = Date.now();
    layer.bgRemovalFlashToken = flashToken;
    refresh();
    commitHistory();

    window.setTimeout(() => {
      const current = getLayerById(selectedId);
      if (!current || current.bgRemovalFlashToken !== flashToken) {
        return;
      }
      delete current.bgRemovalFlashToken;
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    }, 1100);
  } catch (error) {
    console.error("Failed to blur background", error);
    window.alert(
      `Background blur failed: ${error?.message || "Unknown error"}`,
    );
  } finally {
    isApplyingBackgroundBlur = false;
    const layer = getLayerById(selectedId);
    if (layer) {
      layer.isRemovingBackground = false;
    }
    updateModeButtons();
    refresh({ rerenderOptions: true, rerenderLayersPanel: false });
  }
}

async function exportSelectedImage() {
  if (isExporting) return;

  const selected = getLayerById(state.selectedLayerId);
  if (!selected) return;

  const cropToExport =
    state.mode === "crop-select" && state.cropSelection?.layerId === selected.id
      ? state.cropSelection
      : {
          x: selected.x,
          y: selected.y,
          width: selected.width,
          height: selected.height,
        };

  isExporting = true;
  exportSelected.disabled = true;

  try {
    const exportLayers = getExportLayersForSelection(selected);
    const { canvas } = await renderCompositeLayersToCanvas(
      selected,
      exportLayers,
      cropToExport,
      {
        fillBackground: false,
      },
    );

    const exportOptions = await openExportPopup({
      width: canvas.width,
      height: canvas.height,
    });

    if (!exportOptions) return;

    const finalCanvas = resizeCanvasWithQuality(
      canvas,
      exportOptions.width,
      exportOptions.height,
    );

    const exportResult =
      exportOptions.mode === "target"
        ? await encodeByTargetSize(
            finalCanvas,
            exportOptions.targetBytes,
            exportOptions.format,
          )
        : await encodeByQualityPreset(
            finalCanvas,
            exportOptions.qualityPreset,
            exportOptions.format,
          );

    downloadBlob(
      exportResult.blob,
      `selected-${selected.id}.${exportResult.extension}`,
    );
  } catch (error) {
    console.error(error);
  } finally {
    isExporting = false;
    exportSelected.disabled = false;
  }
}

function setupZoomControls() {
  viewportController.setupZoomControls();
}

function setEditorMode(nextMode) {
  shadowTools.handleModeChange(state.mode, nextMode);

  if (nextMode === "shadow-adjust") {
    shadowTools.beginShadowPreview(state.selectedLayerId);
  }

  if (
    nextMode !== "crop-select" &&
    nextMode !== "rotate-select" &&
    isEyedropperActive
  ) {
    setEyedropperActive(false);
  }

  if (state.mode === "rotate-select" && nextMode !== "rotate-select") {
    revertRotateSession();
  }

  state.mode = nextMode;

  if (nextMode === "crop-select") {
    syncCropSelectionWithSelectedLayer(true);
  }

  if (nextMode === "rotate-select") {
    ensureRotateSession();
  }

  updateModeButtons();
  refresh();
}

function setupRotateControls() {
  rotateController.setupRotateHandleControls();
}

function nudgeSelectedLayer(stepX, stepY) {
  const selected = getLayerById(state.selectedLayerId);
  if (!selected) return;

  moveLayerWithChildren(selected.id, stepX, stepY);
  syncLayerParentingForLayer(selected.id);
  refresh();
  commitHistory();
}

function blockBrowserPinchZoom() {
  viewportController.preventBrowserPinchZoom();
}

function syncCropSelectionWithSelectedLayer(forceReset = false) {
  const selected = getLayerById(state.selectedLayerId);
  if (!selected) {
    state.cropSelection = null;
    return;
  }

  if (!forceReset && state.cropSelection?.layerId === selected.id) {
    return;
  }

  state.cropSelection = {
    layerId: selected.id,
    x: selected.x,
    y: selected.y,
    width: selected.width,
    height: selected.height,
  };
}

function ensureLayerDefaults(layer) {
  if (!layer) return;
  if (!layer.cropBackgroundColor) {
    layer.cropBackgroundColor = "#ffffff";
  }
  if (!layer.cropBackgroundMode) {
    layer.cropBackgroundMode = "solid";
  }
  if (!Number.isFinite(layer.rotation)) {
    layer.rotation = 0;
  }
  ensureLayerCornerRadius(layer);
  shadowTools.ensureLayerShadowDefaults(layer);
  textTools.ensureLayerTextDefaults(layer);
  ensureLayerFilterDefaults(layer);
}

function copyPresetFilters(presetKey) {
  const preset = FILTER_PRESETS[presetKey] || FILTER_PRESETS.original;
  return { ...preset };
}

function getMatchingFilterPresetKey(filters) {
  for (const [presetKey, presetValues] of Object.entries(FILTER_PRESETS)) {
    const isMatch =
      Math.abs(filters.brightness - presetValues.brightness) < 0.001 &&
      Math.abs(filters.contrast - presetValues.contrast) < 0.001 &&
      Math.abs(filters.saturate - presetValues.saturate) < 0.001 &&
      Math.abs(filters.hue - presetValues.hue) < 0.001 &&
      Math.abs(filters.grayscale - presetValues.grayscale) < 0.001 &&
      Math.abs(filters.sepia - presetValues.sepia) < 0.001 &&
      Math.abs(filters.invert - presetValues.invert) < 0.001 &&
      Math.abs(filters.blur - presetValues.blur) < 0.001;

    if (isMatch) return presetKey;
  }

  return "custom";
}

function createFilterControl({
  min,
  max,
  step,
  value,
  suffix = "",
  formatValue = (nextValue) => Number(nextValue).toFixed(step < 1 ? 1 : 0),
  onPreview,
  onCommit,
}) {
  const wrap = document.createElement("div");
  wrap.className = "filter-control";

  const slider = document.createElement("input");
  slider.className = "filter-range";
  slider.type = "range";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);

  const valueLabel = document.createElement("span");
  valueLabel.className = "filter-value-label";
  valueLabel.textContent = `${formatValue(value)}${suffix}`;

  const displayValue = (nextValue) => {
    valueLabel.textContent = `${formatValue(nextValue)}${suffix}`;
  };

  const syncFrom = (nextValue, shouldCommit) => {
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) return;
    const normalized = Math.min(max, Math.max(min, parsed));
    slider.value = String(normalized);
    displayValue(normalized);
    onPreview(normalized);
    if (shouldCommit) {
      onCommit();
    }
  };

  slider.addEventListener("input", () => {
    syncFrom(slider.value, false);
  });
  slider.addEventListener("change", () => {
    syncFrom(slider.value, true);
  });

  wrap.appendChild(slider);
  wrap.appendChild(valueLabel);
  return wrap;
}

function getAppliedRotationBounds(layer) {
  return getRotatedBoundingRect(layer);
}

function ensureRotateSession() {
  rotateController.ensureSession();
}

function revertRotateSession() {
  rotateController.revertSession();
}

function setRotationForSelection(nextAngle, { commit = true } = {}) {
  rotateController.setRotationForSelection(nextAngle, { commit });
}

async function applyRotationSelection() {
  await rotateController.applyRotationSelection();
}

function isRotationApplying() {
  return rotateController.isApplyingRotation();
}

function createInlineNameEditor(
  layerId,
  { className = "inline-name-display" } = {},
) {
  const layer = getLayerById(layerId);
  const display = document.createElement("div");
  display.className = className;
  display.textContent = layer?.name || layer?.id || "Layer";
  display.title = "Double-click to rename";

  const startEdit = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const currentLayer = getLayerById(layerId);
    if (!currentLayer) return;

    const input = createTextInput(
      currentLayer.name || currentLayer.id,
      (nextName) => {
        setLayerName(layerId, nextName);
        refresh();
        commitHistory();
      },
    );

    input.className = "option-name-input";
    display.replaceWith(input);
    input.focus();
    input.select();
  };

  display.addEventListener("dblclick", startEdit);
  return display;
}

function renderEmptyOptions(message) {
  if (isEyedropperActive) {
    setEyedropperActive(false);
  }

  optionsPanel.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "empty-option";
  empty.textContent = message;
  optionsPanel.appendChild(empty);
}

function appendOptionDivider() {
  const divider = document.createElement("div");
  divider.className = "option-divider";
  optionsPanel.appendChild(divider);
}

function renderMoveOptions(selected) {
  if (isEyedropperActive) {
    setEyedropperActive(false);
  }

  optionsPanel.innerHTML = "";

  const nameEditor = createInlineNameEditor(selected.id);
  optionsPanel.appendChild(createOptionRow("Name", nameEditor));
  appendOptionDivider();

  const xInput = createNumberInput(selected.x, (nextX) => {
    const deltaX = nextX - selected.x;
    moveLayerWithChildren(selected.id, deltaX, 0);
    syncLayerParentingForLayer(selected.id);
    refresh();
    commitHistory();
  });
  const yInput = createNumberInput(selected.y, (nextY) => {
    const deltaY = nextY - selected.y;
    moveLayerWithChildren(selected.id, 0, deltaY);
    syncLayerParentingForLayer(selected.id);
    refresh();
    commitHistory();
  });
  const widthInput = createNumberInput(
    selected.width,
    (nextWidth) => {
      selected.width = Math.max(MIN_LAYER_SIZE, nextWidth);
      syncLayerParentingForLayer(selected.id);
      refresh();
      commitHistory();
    },
    { min: MIN_LAYER_SIZE },
  );
  const heightInput = createNumberInput(
    selected.height,
    (nextHeight) => {
      selected.height = Math.max(MIN_LAYER_SIZE, nextHeight);
      syncLayerParentingForLayer(selected.id);
      refresh();
      commitHistory();
    },
    { min: MIN_LAYER_SIZE },
  );
  const metricsGrid = createMetricsGrid([
    { label: "X", input: xInput },
    { label: "Y", input: yInput },
    { label: "W", input: widthInput },
    { label: "H", input: heightInput },
  ]);
  const metricsRow = createOptionRow("", metricsGrid);
  metricsRow.classList.add("full");
  optionsPanel.appendChild(metricsRow);

  appendOptionDivider();

  const cornerRadius = getLayerCornerRadius(selected);
  const maxRadius = Math.max(
    0,
    Math.round(Math.min(selected.width, selected.height) / 2),
  );

  const applyCornerRadius = (nextPatch) => {
    const current = getLayerCornerRadius(selected);
    const normalize = (value, fallback) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return fallback;
      return Math.min(maxRadius, Math.max(0, Math.round(numeric)));
    };

    selected.cornerRadius = {
      lt: normalize(nextPatch.lt, current.lt),
      rt: normalize(nextPatch.rt, current.rt),
      rb: normalize(nextPatch.rb, current.rb),
      lb: normalize(nextPatch.lb, current.lb),
    };
    ensureLayerCornerRadius(selected);
    refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    commitHistory();
  };

  const createRadiusInput = (value, onCommit) => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = String(maxRadius);
    input.step = "1";
    input.value = String(Math.round(value));

    const commit = () => {
      onCommit(input.value);
      const next = getLayerCornerRadius(selected);
      ltInput.value = String(next.lt);
      rtInput.value = String(next.rt);
      lbInput.value = String(next.lb);
      rbInput.value = String(next.rb);
      allInput.value = next.all === null ? "Auto" : String(next.all);
    };

    input.addEventListener("change", commit);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      input.blur();
    });

    return input;
  };

  const ltInput = createRadiusInput(cornerRadius.lt, (rawValue) => {
    applyCornerRadius({ lt: rawValue });
  });
  const rtInput = createRadiusInput(cornerRadius.rt, (rawValue) => {
    applyCornerRadius({ rt: rawValue });
  });
  const lbInput = createRadiusInput(cornerRadius.lb, (rawValue) => {
    applyCornerRadius({ lb: rawValue });
  });
  const rbInput = createRadiusInput(cornerRadius.rb, (rawValue) => {
    applyCornerRadius({ rb: rawValue });
  });

  const radiusGrid = createMetricsGrid([
    { label: "LT", input: ltInput },
    { label: "RT", input: rtInput },
    { label: "LB", input: lbInput },
    { label: "RB", input: rbInput },
  ]);

  const caption = document.createElement("div");
  caption.className = "option-caption";
  caption.textContent = "Corner Radius";
  optionsPanel.appendChild(caption);
  const radiusGridRow = createOptionRow("", radiusGrid);
  radiusGridRow.classList.add("full");
  optionsPanel.appendChild(radiusGridRow);

  const allInput = document.createElement("input");
  allInput.type = "text";
  allInput.value =
    cornerRadius.all === null ? "Auto" : String(cornerRadius.all);
  allInput.placeholder = "Auto";
  const commitAllRadius = () => {
    const raw = String(allInput.value || "").trim();
    if (!raw || raw.toLowerCase() === "auto") {
      const next = getLayerCornerRadius(selected);
      allInput.value = next.all === null ? "Auto" : String(next.all);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      const next = getLayerCornerRadius(selected);
      allInput.value = next.all === null ? "Auto" : String(next.all);
      return;
    }
    applyCornerRadius({
      lt: parsed,
      rt: parsed,
      rb: parsed,
      lb: parsed,
    });
  };
  allInput.addEventListener("change", commitAllRadius);
  allInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    allInput.blur();
  });
  optionsPanel.appendChild(createOptionRow("All", allInput));

  appendOptionDivider();
  const borderCaption = document.createElement("div");
  borderCaption.className = "option-caption";
  borderCaption.textContent = "Border";
  optionsPanel.appendChild(borderCaption);

  const borderDraft = layerBorderController.getDraft();

  const borderSizeInput = createFilterControl({
    min: 0,
    max: 200,
    step: 1,
    value: borderDraft.size,
    suffix: "px",
    onPreview: (nextValue) => {
      layerBorderController.setDraftSize(nextValue);
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    },
    onCommit: () => {},
  });
  optionsPanel.appendChild(createOptionRow("Size", borderSizeInput));

  const borderColorInput = document.createElement("input");
  borderColorInput.type = "color";
  borderColorInput.value = borderDraft.color;
  borderColorInput.setAttribute("aria-label", "Border color");
  borderColorInput.addEventListener("input", () => {
    layerBorderController.setDraftColor(borderColorInput.value);
    refresh({ rerenderOptions: false, rerenderLayersPanel: false });
  });
  optionsPanel.appendChild(createOptionRow("Color", borderColorInput));

  const applyBorderButton = document.createElement("button");
  applyBorderButton.type = "button";
  applyBorderButton.className = "button option-button";
  applyBorderButton.textContent = isApplyingLayerBorder
    ? "Applying Border..."
    : "Apply Border";
  applyBorderButton.disabled =
    isApplyingLayerBorder || !layerBorderController.canApply();
  applyBorderButton.addEventListener("click", () => {
    if (isApplyingLayerBorder) return;
    if (!layerBorderController.canApply()) return;

    isApplyingLayerBorder = true;
    refresh({ rerenderOptions: true, rerenderLayersPanel: false });

    void layerBorderController
      .applyToLayer(selected)
      .then(() => {
        layerBorderController.clearDraftSize();
        syncLayerParentingForLayer(selected.id);
        refresh();
        commitHistory();
      })
      .catch((error) => {
        console.error("Failed to apply border", error);
        window.alert(
          `Border apply failed: ${error?.message || "Unknown error"}`,
        );
      })
      .finally(() => {
        isApplyingLayerBorder = false;
        refresh({ rerenderOptions: true, rerenderLayersPanel: false });
      });
  });
  const applyBorderRow = createOptionRow("", applyBorderButton);
  applyBorderRow.classList.add("full");
  optionsPanel.appendChild(applyBorderRow);

  textTools.renderMoveTextOptions(selected, optionsPanel);
}

function appendBackgroundFillOptions(selected) {
  const modeInput = createSelectInput(
    [
      { value: "solid", label: "Solid" },
      { value: "transparent", label: "Transparent" },
    ],
    selected.cropBackgroundMode || "solid",
    (nextMode) => {
      selected.cropBackgroundMode = nextMode;
      hexInput.disabled = nextMode === "transparent";
      currentColorBox.disabled = nextMode === "transparent";
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
      commitHistory();
    },
  );
  optionsPanel.appendChild(createOptionRow("Fill", modeInput));

  const defaultColor = (
    selected.cropBackgroundColor || "#ffffff"
  ).toUpperCase();

  const customColorInline = document.createElement("div");
  customColorInline.className = "custom-color-inline-control";

  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.className = "color-hex-input";
  hexInput.value = defaultColor;
  hexInput.placeholder = "#FFFFFF";
  hexInput.maxLength = 7;

  const hiddenColorInput = document.createElement("input");
  hiddenColorInput.type = "color";
  hiddenColorInput.className = "color-native-input";
  hiddenColorInput.value = defaultColor;
  hiddenColorInput.setAttribute("aria-label", "Choose custom color");

  const currentColorBox = document.createElement("button");
  currentColorBox.type = "button";
  currentColorBox.className = "color-current-box";
  currentColorBox.setAttribute("aria-label", "Current color swatch");

  const applyColor = (nextColor) => {
    const normalized = nextColor.toUpperCase();
    selected.cropBackgroundColor = normalized;
    hiddenColorInput.value = normalized;
    hexInput.value = normalized;
    currentColorBox.style.backgroundColor = normalized;
    currentColorBox.title = normalized;
    refresh({ rerenderOptions: false, rerenderLayersPanel: false });
  };

  const normalizeHex = (value) => {
    const trimmed = value.trim();
    const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    return /^#[0-9A-Fa-f]{6}$/.test(prefixed) ? prefixed.toUpperCase() : null;
  };

  const commitHex = () => {
    const normalized = normalizeHex(hexInput.value);
    if (!normalized) {
      hexInput.value = (
        selected.cropBackgroundColor || "#FFFFFF"
      ).toUpperCase();
      return;
    }
    applyColor(normalized);
    commitHistory();
  };

  hiddenColorInput.addEventListener("input", () => {
    if (isEyedropperActive) {
      setEyedropperActive(false);
    }
    applyColor(hiddenColorInput.value);
    commitHistory();
  });

  hexInput.addEventListener("input", () => {
    const normalized = normalizeHex(hexInput.value);
    if (!normalized) return;
    if (isEyedropperActive) {
      setEyedropperActive(false);
    }
    applyColor(normalized);
  });

  hexInput.addEventListener("blur", commitHex);
  hexInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitHex();
  });

  const isTransparent = selected.cropBackgroundMode === "transparent";
  hexInput.disabled = isTransparent;
  currentColorBox.disabled = isTransparent;

  applyColor(defaultColor);

  currentColorBox.appendChild(hiddenColorInput);
  customColorInline.appendChild(hexInput);
  customColorInline.appendChild(currentColorBox);
  optionsPanel.appendChild(createOptionRow("Custom", customColorInline));

  const presetWrap = document.createElement("div");
  presetWrap.className = "preset-palette";

  for (const color of PRESET_COLORS) {
    const presetButton = document.createElement("button");
    presetButton.type = "button";
    presetButton.className = "preset-color";
    presetButton.setAttribute("aria-label", `Preset ${color}`);
    presetButton.setAttribute("data-hint", `Color ${color}`);
    presetButton.style.backgroundColor = color;
    presetButton.title = color;
    if (defaultColor === color) {
      presetButton.classList.add("active");
    }

    if (isTransparent) {
      presetButton.disabled = true;
    }

    presetButton.addEventListener("click", () => {
      if (isEyedropperActive) {
        setEyedropperActive(false);
      }
      selected.cropBackgroundMode = "solid";
      modeInput.value = "solid";
      hexInput.disabled = false;
      currentColorBox.disabled = false;
      applyColor(color);
      refresh({ rerenderOptions: true, rerenderLayersPanel: false });
      commitHistory();
    });

    presetWrap.appendChild(presetButton);
  }

  optionsPanel.appendChild(createOptionRow("Set", presetWrap));
}

function renderRotateOptions(selected) {
  ensureRotateSession();
  optionsPanel.innerHTML = "";

  const nameEditor = createInlineNameEditor(selected.id);
  optionsPanel.appendChild(createOptionRow("Name", nameEditor));
  appendOptionDivider();

  const rotationInput = createNumberInput(
    selected.rotation || 0,
    (nextAngle) => {
      setRotationForSelection(nextAngle, { commit: false });
    },
    { min: -360, step: 1 },
  );
  optionsPanel.appendChild(createOptionRow("Angle", rotationInput));

  const rotateBounds = getAppliedRotationBounds(selected);
  if (rotateBounds) {
    const xDisplay = createNumberInput(Math.round(rotateBounds.x), () => {});
    xDisplay.disabled = true;
    const yDisplay = createNumberInput(Math.round(rotateBounds.y), () => {});
    yDisplay.disabled = true;
    const wDisplay = createNumberInput(
      Math.round(rotateBounds.width),
      () => {},
    );
    wDisplay.disabled = true;
    const hDisplay = createNumberInput(
      Math.round(rotateBounds.height),
      () => {},
    );
    hDisplay.disabled = true;

    const metricsGrid = createMetricsGrid([
      { label: "X", input: xDisplay },
      { label: "Y", input: yDisplay },
      { label: "W", input: wDisplay },
      { label: "H", input: hDisplay },
    ]);
    const metricsRow = createOptionRow("", metricsGrid);
    metricsRow.classList.add("full");
    optionsPanel.appendChild(metricsRow);
  }

  appendOptionDivider();

  appendBackgroundFillOptions(selected);
  appendOptionDivider();

  const applyRotationButton = document.createElement("button");
  applyRotationButton.type = "button";
  applyRotationButton.className = "button option-button";
  applyRotationButton.textContent = "Apply Rotation";
  applyRotationButton.disabled = isRotationApplying();
  applyRotationButton.addEventListener("click", () => {
    void applyRotationSelection();
  });

  const applyRow = createOptionRow("", applyRotationButton);
  applyRow.classList.add("full");
  optionsPanel.appendChild(applyRow);

  const note = document.createElement("div");
  note.style.fontSize = "12px";
  note.style.color = "rgba(145, 157, 169, 0.95)";
  note.textContent =
    "Tip: drag inside image to move and drag top handle to rotate.";
  const noteRow = createOptionRow("", note);
  noteRow.classList.add("full");
  optionsPanel.appendChild(noteRow);
}

function renderFilterOptions(selected) {
  if (isEyedropperActive) {
    setEyedropperActive(false);
  }

  optionsPanel.innerHTML = "";

  const nameEditor = createInlineNameEditor(selected.id);
  optionsPanel.appendChild(createOptionRow("Name", nameEditor));

  ensureLayerDefaults(selected);
  const filters = selected.filters;

  const presetInput = createSelectInput(
    [
      { value: "custom", label: "Custom" },
      { value: "original", label: "Original" },
      { value: "vivid", label: "Vivid" },
      { value: "mono", label: "Mono" },
      { value: "warm", label: "Warm" },
      { value: "cool", label: "Cool" },
      { value: "dramatic", label: "Dramatic" },
      { value: "dreamy", label: "Dreamy" },
    ],
    getMatchingFilterPresetKey(filters),
    (nextPreset) => {
      if (nextPreset === "custom") return;
      selected.filters = copyPresetFilters(nextPreset);
      syncSelectedFiltersToChildren(selected);
      refresh();
      commitHistory();
    },
  );
  optionsPanel.appendChild(createOptionRow("Effect", presetInput));

  const appendSection = (title) => {
    if (optionsPanel.querySelector(".option-caption")) {
      appendOptionDivider();
    }
    const caption = document.createElement("div");
    caption.className = "option-caption";
    caption.textContent = title;
    optionsPanel.appendChild(caption);
  };

  const controls = [
    {
      section: "Color",
      items: [
        { label: "Temp", key: "temp", min: -100, max: 100, step: 1 },
        { label: "Tint", key: "tint", min: -100, max: 100, step: 1 },
      ],
    },
    {
      section: "Light",
      items: [
        {
          label: "Exposure",
          key: "exposure",
          min: -100,
          max: 100,
          step: 1,
        },
        {
          label: "Contrast",
          key: "contrast",
          min: 0,
          max: 300,
          step: 1,
        },
        {
          label: "Highlights",
          key: "highlights",
          min: -100,
          max: 100,
          step: 1,
        },
        {
          label: "Shadows",
          key: "shadows",
          min: -100,
          max: 100,
          step: 1,
        },
        { label: "Whites", key: "whites", min: -100, max: 100, step: 1 },
        { label: "Blacks", key: "blacks", min: -100, max: 100, step: 1 },
      ],
    },
    {
      section: "Presence",
      items: [
        {
          label: "Texture",
          key: "texture",
          min: -100,
          max: 100,
          step: 1,
        },
        {
          label: "Clarity",
          key: "clarity",
          min: -100,
          max: 100,
          step: 1,
        },
        {
          label: "Dehaze",
          key: "dehaze",
          min: -100,
          max: 100,
          step: 1,
        },
        {
          label: "Saturation",
          key: "saturation",
          min: -100,
          max: 100,
          step: 1,
        },
      ],
    },
    {
      section: "Detail",
      items: [
        {
          label: "Sharpness",
          key: "sharpness",
          min: -100,
          max: 100,
          step: 1,
        },
        { label: "Noise", key: "noise", min: 0, max: 100, step: 1 },
        { label: "Moire", key: "moire", min: 0, max: 100, step: 1 },
        {
          label: "Defringe",
          key: "defringe",
          min: 0,
          max: 100,
          step: 1,
        },
      ],
    },
    {
      section: "Shadow",
      items: [
        { label: "Offset X", key: "shadowX", min: -80, max: 80, step: 1 },
        { label: "Offset Y", key: "shadowY", min: -80, max: 80, step: 1 },
        { label: "Blur", key: "shadowBlur", min: 0, max: 80, step: 1 },
        {
          label: "Opacity",
          key: "shadowOpacity",
          min: 0,
          max: 100,
          step: 1,
        },
      ],
    },
  ];

  for (const group of controls) {
    appendSection(group.section);

    for (const control of group.items) {
      const offset = control.offset || 0;
      const controlEl = createFilterControl({
        min: control.min + offset,
        max: control.max + offset,
        step: control.step,
        value: (filters[control.key] || 0) + offset,
        formatValue: (nextValue) => String(Math.round(nextValue - offset)),
        onPreview: (nextValue) => {
          ensureLayerDefaults(selected);
          selected.filters[control.key] = nextValue - offset;
          syncSelectedFiltersToChildren(selected);
          refresh({ rerenderOptions: false, rerenderLayersPanel: false });
        },
        onCommit: () => {
          commitHistory();
        },
      });
      optionsPanel.appendChild(createOptionRow(control.label, controlEl));
    }
  }

  const shadowColorInput = document.createElement("input");
  shadowColorInput.type = "color";
  shadowColorInput.value = filters.shadowColor || "#000000";
  shadowColorInput.setAttribute("aria-label", "Shadow color");
  shadowColorInput.addEventListener("input", () => {
    ensureLayerDefaults(selected);
    selected.filters.shadowColor = shadowColorInput.value.toUpperCase();
    syncSelectedFiltersToChildren(selected);
    refresh({ rerenderOptions: false, rerenderLayersPanel: false });
  });
  shadowColorInput.addEventListener("change", () => {
    commitHistory();
  });
  optionsPanel.appendChild(createOptionRow("Color", shadowColorInput));

  appendSection("Background Blur");

  const linkedBackgroundLayer = getLinkedBackgroundLayer(selected);

  const backgroundBlurControl = createFilterControl({
    min: 0,
    max: 75,
    step: 1,
    value: Math.round((Number(filters.backgroundBlurAmount) || 0) * 5),
    formatValue: (nextValue) => String(Math.round(nextValue)),
    onPreview: (nextValue) => {
      ensureLayerDefaults(selected);
      const amount = Math.max(0, Math.min(15, nextValue / 5));
      selected.filters.backgroundBlurAmount = amount;
      syncSelectedFiltersToChildren(selected);
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    },
    onCommit: () => {
      commitHistory();
    },
  });
  optionsPanel.appendChild(createOptionRow("Amount", backgroundBlurControl));

  if (linkedBackgroundLayer) {
    const linkedNote = document.createElement("div");
    linkedNote.className = "empty-option";
    linkedNote.textContent = "";
    const linkedNoteRow = createOptionRow("", linkedNote);
    linkedNoteRow.classList.add("full");
    optionsPanel.appendChild(linkedNoteRow);
  }

  appendOptionDivider();

  const blurBgButton = document.createElement("button");
  blurBgButton.type = "button";
  blurBgButton.className = "button option-button";
  blurBgButton.textContent = isApplyingBackgroundBlur
    ? "Blur Background (AI)..."
    : "Blur Background (AI)";
  blurBgButton.disabled = isApplyingBackgroundBlur || isRemovingBackground;
  blurBgButton.addEventListener("click", () => {
    void applyBackgroundBlurSelection();
  });

  const blurBgRow = createOptionRow("", blurBgButton);
  blurBgRow.classList.add("full");
  optionsPanel.appendChild(blurBgRow);

  const applyFilterButton = document.createElement("button");
  applyFilterButton.type = "button";
  applyFilterButton.className = "button option-button";
  applyFilterButton.textContent = "Apply Filter";
  applyFilterButton.disabled = isApplyingFilter;
  applyFilterButton.setAttribute("data-hint", "Apply Filter (Enter)");
  applyFilterButton.addEventListener("click", () => {
    void applyFilterSelection();
  });

  const applyFilterRow = createOptionRow("", applyFilterButton);
  applyFilterRow.classList.add("full");
  optionsPanel.appendChild(applyFilterRow);

  appendOptionDivider();

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "button option-button";
  resetButton.textContent = "Reset Filters";
  resetButton.addEventListener("click", () => {
    selected.filters = getDefaultLayerFilters();
    syncSelectedFiltersToChildren(selected);
    refresh();
    commitHistory();
  });

  const resetRow = createOptionRow("", resetButton);
  resetRow.classList.add("full");
  optionsPanel.appendChild(resetRow);
}

function renderCropOptions(selected) {
  syncCropSelectionWithSelectedLayer();

  const crop = state.cropSelection;
  if (!crop || crop.layerId !== selected.id) {
    renderEmptyOptions("Crop selection is not available.");
    return;
  }

  optionsPanel.innerHTML = "";

  const getActiveCropRatio = () => {
    const ratio = Number(state.cropAspectRatio);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
  };

  const applyRatioToCropKeepingTopLeft = () => {
    const ratio = getActiveCropRatio();
    if (!ratio) {
      return;
    }
    crop.width = Math.max(MIN_LAYER_SIZE, crop.width);
    crop.height = Math.max(MIN_LAYER_SIZE, crop.width / ratio);
  };

  const nameEditor = createInlineNameEditor(selected.id);
  optionsPanel.appendChild(createOptionRow("Name", nameEditor));
  appendOptionDivider();

  const cropXInput = createNumberInput(crop.x, (nextX) => {
    crop.x = nextX;
    refresh();
    commitHistory();
  });

  const cropYInput = createNumberInput(crop.y, (nextY) => {
    crop.y = nextY;
    refresh();
    commitHistory();
  });

  const cropWInput = createNumberInput(
    crop.width,
    (nextW) => {
      crop.width = Math.max(MIN_LAYER_SIZE, nextW);
      if (getActiveCropRatio()) {
        applyRatioToCropKeepingTopLeft();
      }
      refresh();
      commitHistory();
    },
    { min: MIN_LAYER_SIZE },
  );
  const cropHInput = createNumberInput(
    crop.height,
    (nextH) => {
      crop.height = Math.max(MIN_LAYER_SIZE, nextH);
      const ratio = getActiveCropRatio();
      if (ratio) {
        crop.width = Math.max(MIN_LAYER_SIZE, crop.height * ratio);
      }
      refresh();
      commitHistory();
    },
    { min: MIN_LAYER_SIZE },
  );
  const cropMetricsGrid = createMetricsGrid([
    { label: "X", input: cropXInput },
    { label: "Y", input: cropYInput },
    { label: "W", input: cropWInput },
    { label: "H", input: cropHInput },
  ]);
  const cropMetricsRow = createOptionRow("", cropMetricsGrid);
  cropMetricsRow.classList.add("full");
  optionsPanel.appendChild(cropMetricsRow);

  appendOptionDivider();

  const ratioOptions = [
    { value: "free", label: "Free" },
    { value: "1", label: "1:1" },
    { value: "0.75", label: "3:4" },
    { value: "1.3333333333", label: "4:3" },
    { value: "0.6666666667", label: "2:3" },
    { value: "1.5", label: "3:2" },
    { value: "0.5625", label: "9:16" },
    { value: "1.7777777778", label: "16:9" },
  ];
  const activeRatio = getActiveCropRatio();
  const ratioValue = activeRatio ? String(activeRatio) : "free";
  const ratioSelect = createSelectInput(ratioOptions, ratioValue, (value) => {
    state.cropAspectRatio = value === "free" ? null : Number(value);
    applyRatioToCropKeepingTopLeft();
    refresh();
    commitHistory();
  });
  optionsPanel.appendChild(createOptionRow("Ratio", ratioSelect));

  appendBackgroundFillOptions(selected);
  appendOptionDivider();

  const applyCropButton = document.createElement("button");
  applyCropButton.type = "button";
  applyCropButton.className = "button option-button";
  applyCropButton.textContent = "Apply Crop";
  applyCropButton.disabled = isApplyingCrop;
  applyCropButton.addEventListener("click", () => {
    void applyCropSelection();
  });
  const applyRow = createOptionRow("", applyCropButton);
  applyRow.classList.add("full");
  optionsPanel.appendChild(applyRow);
}

function renderOptionsPanel() {
  const selected = getLayerById(state.selectedLayerId);
  if (!selected) {
    renderEmptyOptions("Select a layer to edit options.");
    return;
  }

  ensureLayerDefaults(selected);

  if (state.mode === "crop-select") {
    renderCropOptions(selected);
    return;
  }

  if (state.mode === "rotate-select") {
    renderRotateOptions(selected);
    return;
  }

  if (state.mode === "filter-adjust") {
    renderFilterOptions(selected);
    return;
  }

  if (state.mode === "shadow-adjust") {
    shadowTools.renderShadowOptions(selected, optionsPanel, {
      isEyedropperActive: () => isEyedropperActive,
      setEyedropperActive,
    });
    return;
  }

  renderMoveOptions(selected);
}

function updateModeButtons() {
  const modeLabel =
    state.mode === "crop-select"
      ? "Crop"
      : state.mode === "rotate-select"
        ? "Rotate"
        : state.mode === "filter-adjust"
          ? "Filter"
          : state.mode === "shadow-adjust"
            ? "Shadow"
            : "Select";
  const hasSelection = Boolean(state.selectedLayerId);

  if (optionsTitle) {
    optionsTitle.textContent = `Options (${modeLabel})`;
  }

  modeSelect.classList.toggle("active", state.mode === "drag-select");
  modeCrop.classList.toggle("active", state.mode === "crop-select");
  modeRotate.classList.toggle("active", state.mode === "rotate-select");
  modeFilter.classList.toggle("active", state.mode === "filter-adjust");
  modeShadow?.classList.toggle("active", state.mode === "shadow-adjust");
  modeFilter.disabled = false;
  duplicateAction.disabled = !hasSelection;
  const isAiBusy =
    isRemovingBackground || isApplyingBackgroundBlur || isUpscaling;
  removeBgAction.disabled = !hasSelection || isAiBusy;
  if (upscaleAction) {
    upscaleAction.disabled = !hasSelection || isAiBusy;
  }
  const removeBgHint = isAiBusy
    ? "Processing AI..."
    : TOOLBAR_HINTS.removeBgAction;
  const upscaleHint = isUpscaling
    ? "Upscaling..."
    : TOOLBAR_HINTS.upscaleAction;
  removeBgAction.setAttribute("data-hint", removeBgHint);
  removeBgAction.setAttribute("aria-label", removeBgHint);
  upscaleAction?.setAttribute("data-hint", upscaleHint);
  upscaleAction?.setAttribute("aria-label", upscaleHint);
  deleteAction.disabled = !hasSelection;
  exportSelected.disabled = !hasSelection;
  stage.classList.toggle("crop-mode", state.mode === "crop-select");
  stage.classList.toggle("rotate-mode", state.mode === "rotate-select");
}

function setupToolbarHints() {
  const entries = [
    ["addAction", addAction],
    ["textAction", textAction],
    ["modeSelect", modeSelect],
    ["modeCrop", modeCrop],
    ["modeRotate", modeRotate],
    ["modeFilter", modeFilter],
    ["modeShadow", modeShadow],
    ["undoAction", undoAction],
    ["redoAction", redoAction],
    ["duplicateAction", duplicateAction],
    ["removeBgAction", removeBgAction],
    ["upscaleAction", upscaleAction],
    ["deleteAction", deleteAction],
    ["exportSelected", exportSelected],
    ["zoomOut", zoomOut],
    ["zoomReset", zoomReset],
    ["zoomIn", zoomIn],
  ];

  for (const [key, element] of entries) {
    const hint = TOOLBAR_HINTS[key];
    if (!element || !hint) continue;
    element.setAttribute("data-hint", hint);
    element.setAttribute("aria-label", hint);
  }
}

function updateSelectionBox() {
  const zoom = Math.max(0.001, state.editorZoom || 1);
  const offsetX = state.editorOffsetX || 0;
  const offsetY = state.editorOffsetY || 0;
  const toScreenX = (value) => value * zoom + offsetX;
  const toScreenY = (value) => value * zoom + offsetY;
  const toScreenSize = (value) => value * zoom;

  const selected = getLayerById(state.selectedLayerId);
  if (!selected) {
    selectionBox.style.display = "none";
    cropBox.style.display = "none";
    return;
  }

  const selectionRect =
    state.mode === "rotate-select"
      ? getAppliedRotationBounds(selected) || selected
      : selected;

  selectionBox.style.display = state.mode === "crop-select" ? "none" : "block";
  selectionBox.style.left = `${toScreenX(selectionRect.x)}px`;
  selectionBox.style.top = `${toScreenY(selectionRect.y)}px`;
  selectionBox.style.width = `${toScreenSize(selectionRect.width)}px`;
  selectionBox.style.height = `${toScreenSize(selectionRect.height)}px`;

  if (state.mode !== "crop-select") {
    cropBox.style.display = "none";
  }

  if (state.mode !== "crop-select") {
    return;
  }

  syncCropSelectionWithSelectedLayer();
  if (!state.cropSelection) {
    cropBox.style.display = "none";
    return;
  }

  cropBox.style.display = "block";
  cropBox.style.left = `${toScreenX(state.cropSelection.x)}px`;
  cropBox.style.top = `${toScreenY(state.cropSelection.y)}px`;
  cropBox.style.width = `${toScreenSize(state.cropSelection.width)}px`;
  cropBox.style.height = `${toScreenSize(state.cropSelection.height)}px`;
}

function renderLayerBranch(layer, depth = 0) {
  if (layer.backgroundBlurRole === "background") {
    return;
  }

  const childLayers = getLayerChildren(layer.id).filter(
    (child) => child.backgroundBlurRole !== "background",
  );
  const hasChildren = childLayers.length > 0;

  const item = document.createElement("div");
  item.setAttribute("role", "button");
  item.tabIndex = 0;
  item.className = `layer-item ${hasChildren ? "parent" : ""}`;
  if (state.selectedLayerId === layer.id) {
    item.classList.add("active");
  }

  item.style.paddingLeft = `${8 + depth * 14}px`;

  const topRow = document.createElement("div");
  topRow.className = "layer-item-top";

  const marker = document.createElement("span");
  marker.className = "layer-depth-marker";
  marker.textContent = depth > 0 ? "↳" : "";

  const nameDisplay = document.createElement("span");
  nameDisplay.className = "layer-name-display layer-item-name";
  nameDisplay.textContent = layer.name || layer.id;
  nameDisplay.title = "Double-click to rename";

  const typeBadge = document.createElement("span");
  typeBadge.className = "layer-item-badge";
  typeBadge.textContent = layer.parentId
    ? "Child"
    : hasChildren
      ? "Parent"
      : "Layer";

  topRow.appendChild(marker);
  topRow.appendChild(nameDisplay);
  topRow.appendChild(typeBadge);

  const meta = document.createElement("div");
  meta.className = "layer-item-meta";
  meta.textContent = `${Math.round(layer.width)}x${Math.round(layer.height)} • ${Math.round(layer.x)}, ${Math.round(layer.y)}`;

  item.appendChild(topRow);
  item.appendChild(meta);

  const selectLayer = () => {
    setSelectedLayer(layer.id);
    bringLayerToFront(layer.id);
    refresh();
    commitHistory();
  };

  let clickTimeoutId = null;
  item.addEventListener("click", () => {
    if (clickTimeoutId !== null) {
      window.clearTimeout(clickTimeoutId);
    }

    clickTimeoutId = window.setTimeout(() => {
      selectLayer();
      clickTimeoutId = null;
    }, 180);
  });
  item.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectLayer();
  });

  attachLayersPanelDragAndDrop({
    item,
    layerId: layer.id,
    layersList,
    state,
    getDescendantLayerIds,
    onDropApplied: (droppedId) => {
      setSelectedLayer(droppedId);
      refresh();
      commitHistory();
    },
  });

  const startInlineLayerRename = (event) => {
    if (event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    event.stopPropagation();

    if (clickTimeoutId !== null) {
      window.clearTimeout(clickTimeoutId);
      clickTimeoutId = null;
    }

    const currentLayer = getLayerById(layer.id);
    if (!currentLayer) return;

    const input = createTextInput(
      currentLayer.name || currentLayer.id,
      (nextName) => {
        setLayerName(layer.id, nextName);
        refresh();
        commitHistory();
      },
    );
    input.className = "layer-name-input";
    nameDisplay.replaceWith(input);
    input.focus();
    input.select();
  };

  nameDisplay.addEventListener("dblclick", startInlineLayerRename);
  item.addEventListener("dblclick", startInlineLayerRename);
  layersList.appendChild(item);

  for (const child of childLayers) {
    renderLayerBranch(child, depth + 1);
  }
}

function renderLayersPanel() {
  layersList.innerHTML = "";

  const roots = getRootLayers().filter(
    (layer) => layer.backgroundBlurRole !== "background",
  );
  if (!roots.length) {
    const empty = document.createElement("div");
    empty.className = "layer-item";
    empty.textContent = "No layers";
    empty.style.opacity = "0.7";
    layersList.appendChild(empty);
    return;
  }

  for (const layer of roots) {
    renderLayerBranch(layer, 0);
  }
}

function updateLayerOutsideBackground() {
  for (const layer of state.layers) {
    ensureLayerDefaults(layer);
    layer.showOutsideBackground = false;
  }

  if (state.mode === "rotate-select") {
    const selected = getLayerById(state.selectedLayerId);
    if (!selected) return;
    selected.showOutsideBackground =
      selected.cropBackgroundMode !== "transparent" &&
      Math.abs(Number(selected.rotation) || 0) > 0.001;
    return;
  }

  if (state.mode !== "crop-select") return;

  const selected = getLayerById(state.selectedLayerId);
  if (!selected || !state.cropSelection) return;

  if (state.cropSelection.layerId !== selected.id) return;

  const cropLeft = state.cropSelection.x;
  const cropTop = state.cropSelection.y;
  const cropRight = cropLeft + state.cropSelection.width;
  const cropBottom = cropTop + state.cropSelection.height;

  const layerLeft = selected.x;
  const layerTop = selected.y;
  const layerRight = selected.x + selected.width;
  const layerBottom = selected.y + selected.height;

  const isOutside =
    cropLeft < layerLeft ||
    cropTop < layerTop ||
    cropRight > layerRight ||
    cropBottom > layerBottom;

  selected.showOutsideBackground = isOutside;
}

function clearActiveSelection() {
  if (!state.selectedLayerId && !state.cropSelection) return;

  setSelectedLayer(null);
  state.cropSelection = null;

  if (isEyedropperActive) {
    setEyedropperActive(false);
  }

  updateModeButtons();
  refresh();
}

function deleteSelectedLayer() {
  const selected = getLayerById(state.selectedLayerId);
  if (!selected) return;

  const linkedLayerIds = [];
  if (selected.linkedBackgroundLayerId) {
    linkedLayerIds.push(selected.linkedBackgroundLayerId);
  }
  if (selected.linkedSubjectLayerId) {
    linkedLayerIds.push(selected.linkedSubjectLayerId);
  }

  deleteLayerWithDescendants(selected.id);
  for (const linkedId of linkedLayerIds) {
    if (getLayerById(linkedId)) {
      deleteLayerWithDescendants(linkedId);
    }
  }
  setSelectedLayer(null);

  if (state.mode === "crop-select") {
    syncCropSelectionWithSelectedLayer(true);
  }

  refresh();
  commitHistory();
}

function renameSelectedLayerInline() {
  const selected = getLayerById(state.selectedLayerId);
  if (!selected) return;

  refresh({ rerenderOptions: true, rerenderLayersPanel: false });

  const inlineName = optionsPanel.querySelector(".inline-name-display");
  if (!(inlineName instanceof HTMLElement)) return;
  inlineName.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
}

function duplicateSelectedLayer() {
  const selected = getLayerById(state.selectedLayerId);
  if (!selected) return;

  const clonedRootId = duplicateLayerWithDescendants(selected.id);
  if (!clonedRootId) return;

  setSelectedLayer(clonedRootId);
  bringLayerToFront(clonedRootId);

  if (state.mode === "crop-select") {
    syncCropSelectionWithSelectedLayer(true);
  }

  refresh();
  commitHistory();
}

async function removeBackgroundFromSelectedLayer() {
  const selected = getLayerById(state.selectedLayerId);
  if (!selected || isRemovingBackground || isApplyingBackgroundBlur) {
    return;
  }

  const selectedId = selected.id;

  isRemovingBackground = true;
  selected.isRemovingBackground = true;
  refresh({ rerenderOptions: false, rerenderLayersPanel: false });
  updateModeButtons();

  try {
    const previousSrc = selected.src;
    const outputBlob = await backgroundRemovalController.removeBackground(
      selected.src,
    );

    selected.src = URL.createObjectURL(outputBlob);
    selected.isRemovingBackground = false;
    const flashToken = Date.now();
    selected.bgRemovalFlashToken = flashToken;
    if (typeof previousSrc === "string" && previousSrc.startsWith("blob:")) {
      URL.revokeObjectURL(previousSrc);
    }
    refresh();
    commitHistory();

    window.setTimeout(() => {
      const layer = getLayerById(selectedId);
      if (!layer || layer.bgRemovalFlashToken !== flashToken) {
        return;
      }
      delete layer.bgRemovalFlashToken;
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    }, 1100);
  } catch (error) {
    console.error("Failed to remove background", error);
    window.alert(
      `Background removal failed: ${error?.message || "Unknown error"}`,
    );
  } finally {
    isRemovingBackground = false;
    const layer = getLayerById(selectedId);
    if (layer) {
      layer.isRemovingBackground = false;
    }
    updateModeButtons();
  }
}

async function upscaleSelectedLayer() {
  const selected = getLayerById(state.selectedLayerId);
  if (
    !selected ||
    isUpscaling ||
    isRemovingBackground ||
    isApplyingBackgroundBlur
  ) {
    return;
  }

  const selectedId = selected.id;
  isUpscaling = true;
  selected.isUpscaling = true;
  refresh({ rerenderOptions: false, rerenderLayersPanel: false });
  updateModeButtons();

  try {
    ensureLayerDefaults(selected);
    const { drawable: sourceDrawable, bakedStroke } =
      await buildUpscaleSourceDrawable(selected);
    const sourceWidth = Math.max(
      1,
      sourceDrawable.width || sourceDrawable.naturalWidth || 1,
    );
    const sourceHeight = Math.max(
      1,
      sourceDrawable.height || sourceDrawable.naturalHeight || 1,
    );

    const desiredScale = 2;
    const maxPixels = 24000000;
    const maxScaleFromPixels = Math.sqrt(
      maxPixels / (sourceWidth * sourceHeight),
    );
    const appliedScale = Math.max(
      1,
      Math.min(
        desiredScale,
        Number.isFinite(maxScaleFromPixels) ? maxScaleFromPixels : desiredScale,
      ),
    );

    const outWidth = Math.max(1, Math.round(sourceWidth * appliedScale));
    const outHeight = Math.max(1, Math.round(sourceHeight * appliedScale));

    const { canvas, usedAi } = await upscaleImageAiFirst(
      sourceDrawable,
      outWidth,
      outHeight,
    );
    if (!usedAi) {
      console.info("Upscale fallback used: enhanced local upscale.");
    }

    const outputBlob = await canvasToBlob(canvas, "image/png");
    const previousSrc = selected.src;
    selected.src = URL.createObjectURL(outputBlob);
    if (bakedStroke && selected.shadowStyle) {
      selected.shadowStyle.strokeSize = 0;
    }

    const flashToken = Date.now();
    selected.upscaleFlashToken = flashToken;
    if (typeof previousSrc === "string" && previousSrc.startsWith("blob:")) {
      URL.revokeObjectURL(previousSrc);
    }

    refresh();
    commitHistory();

    window.setTimeout(() => {
      const layer = getLayerById(selectedId);
      if (!layer || layer.upscaleFlashToken !== flashToken) {
        return;
      }
      delete layer.upscaleFlashToken;
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    }, 1100);
  } catch (error) {
    console.error("Failed to upscale image", error);
    window.alert(`Upscale failed: ${error?.message || "Unknown error"}`);
  } finally {
    isUpscaling = false;
    const layer = getLayerById(selectedId);
    if (layer) {
      layer.isUpscaling = false;
    }
    updateModeButtons();
  }
}

const contextMenu = document.createElement("div");
contextMenu.className = "context-menu";
contextMenu.setAttribute("role", "menu");
document.body.appendChild(contextMenu);

function hideContextMenu() {
  contextMenu.classList.remove("show");
}

function isContextMenuOpen() {
  return contextMenu.classList.contains("show");
}

function createContextItem(label, action, { disabled = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "context-menu-item";
  button.textContent = label;
  button.disabled = disabled;
  button.setAttribute("role", "menuitem");
  button.addEventListener("click", () => {
    hideContextMenu();
    if (!disabled) action();
  });
  return button;
}

function createContextSeparator() {
  const separator = document.createElement("div");
  separator.className = "context-menu-separator";
  return separator;
}

function buildContextMenuItems() {
  const selected = getLayerById(state.selectedLayerId);
  const hasSelection = Boolean(selected);
  const canMergeLayers = hasSelection && isMergeCandidateLayer(selected);
  const canApplyCrop =
    hasSelection &&
    state.mode === "crop-select" &&
    state.cropSelection?.layerId === selected.id;
  const canApplyFilter = hasSelection && state.mode === "filter-adjust";
  const canApplyShadow = hasSelection && state.mode === "shadow-adjust";

  contextMenu.innerHTML = "";

  contextMenu.appendChild(
    createContextItem("Rename", () => renameSelectedLayerInline(), {
      disabled: !hasSelection,
    }),
  );
  contextMenu.appendChild(
    createContextItem("Duplicate", () => duplicateSelectedLayer(), {
      disabled: !hasSelection,
    }),
  );
  contextMenu.appendChild(
    createContextItem("Delete", () => deleteSelectedLayer(), {
      disabled: !hasSelection,
    }),
  );
  contextMenu.appendChild(
    createContextItem("Merge Layers", () => void mergeSelectedLayerTree(), {
      disabled: !canMergeLayers,
    }),
  );

  contextMenu.appendChild(createContextSeparator());

  contextMenu.appendChild(
    createContextItem("Select Mode", () => setEditorMode("drag-select")),
  );
  contextMenu.appendChild(
    createContextItem("Crop Mode", () => setEditorMode("crop-select")),
  );
  contextMenu.appendChild(
    createContextItem("Rotate Mode", () => setEditorMode("rotate-select")),
  );
  contextMenu.appendChild(
    createContextItem("Filter Mode", () => setEditorMode("filter-adjust")),
  );
  contextMenu.appendChild(
    createContextItem("Shadow Mode", () => setEditorMode("shadow-adjust")),
  );
  contextMenu.appendChild(
    createContextItem("Apply Crop", () => void applyCropSelection(), {
      disabled: !canApplyCrop,
    }),
  );
  contextMenu.appendChild(
    createContextItem("Apply Filter", () => void applyFilterSelection(), {
      disabled: !canApplyFilter || isApplyingFilter,
    }),
  );
  contextMenu.appendChild(
    createContextItem(
      "Apply Shadow",
      () => shadowTools.applyShadowSelection(state.selectedLayerId),
      {
        disabled: !canApplyShadow,
      },
    ),
  );

  contextMenu.appendChild(createContextSeparator());

  contextMenu.appendChild(
    createContextItem("Export", () => void exportSelectedImage(), {
      disabled: !hasSelection,
    }),
  );
  contextMenu.appendChild(
    createContextItem("Undo", () => {
      historyManager?.undo();
      updateHistoryButtons();
    }),
  );
  contextMenu.appendChild(
    createContextItem("Redo", () => {
      historyManager?.redo();
      updateHistoryButtons();
    }),
  );
}

function showContextMenu(clientX, clientY) {
  buildContextMenuItems();

  contextMenu.classList.add("show");

  const { innerWidth, innerHeight } = window;
  const menuWidth = contextMenu.offsetWidth;
  const menuHeight = contextMenu.offsetHeight;

  const left = Math.min(clientX, innerWidth - menuWidth - 10);
  const top = Math.min(clientY, innerHeight - menuHeight - 10);

  contextMenu.style.left = `${Math.max(8, left)}px`;
  contextMenu.style.top = `${Math.max(8, top)}px`;
}

function setupSelectionContextMenu() {
  const allowRightClickOn = [stage, layersList, selectionBox, cropBox];

  const openMenu = (event) => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY);
  };

  for (const element of allowRightClickOn) {
    element.addEventListener("contextmenu", openMenu);
  }

  window.addEventListener("pointerdown", (event) => {
    if (!isContextMenuOpen()) return;
    const target = event.target;
    if (target instanceof Node && contextMenu.contains(target)) return;
    hideContextMenu();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    hideContextMenu();
  });

  window.addEventListener("blur", () => {
    hideContextMenu();
  });
}

function setupClearSelectionOnOutsideClick() {
  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    if (
      target.closest(".layer") ||
      target.closest("[data-select-handle]") ||
      target.closest("[data-crop-handle]") ||
      target.closest(".selection-box") ||
      target.closest(".crop-box") ||
      target.closest(".context-menu")
    ) {
      return;
    }

    clearActiveSelection();
  });

  layersList.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".layer-item")) return;

    clearActiveSelection();
  });
}

function setupSidePanelResize() {
  if (
    !layersPanel ||
    !optionsSection ||
    !layersSection ||
    !sidePanelResizeHandle
  ) {
    return;
  }

  let dragState = null;
  const minOptionsPx = 120;
  const minLayersPx = 120;
  const handlePx = 8;

  const stopResize = (pointerId = null) => {
    if (!dragState) return;
    if (pointerId !== null && pointerId !== dragState.pointerId) return;

    try {
      sidePanelResizeHandle.releasePointerCapture(dragState.pointerId);
    } catch {
      // Ignore release errors when capture was already lost.
    }

    dragState = null;
    document.body.classList.remove("side-panel-resizing");
  };

  const onPointerMove = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    // Stop dragging immediately if primary button is no longer pressed.
    if ((event.buttons & 1) === 0) {
      stopResize(event.pointerId);
      return;
    }

    const panelRect = layersPanel.getBoundingClientRect();

    // If pointer leaves panel bounds, end the resize interaction.
    const isOutsidePanel =
      event.clientX < panelRect.left ||
      event.clientX > panelRect.right ||
      event.clientY < panelRect.top ||
      event.clientY > panelRect.bottom;
    if (isOutsidePanel) {
      stopResize(event.pointerId);
      return;
    }

    const deltaY = event.clientY - dragState.startY;

    const maxPx = Math.max(
      minOptionsPx,
      panelRect.height - minLayersPx - handlePx,
    );
    const nextOptionsPx = Math.min(
      maxPx,
      Math.max(minOptionsPx, dragState.startOptionsHeight + deltaY),
    );
    const nextPercent = (nextOptionsPx / panelRect.height) * 100;

    layersPanel.style.setProperty(
      "--options-panel-height",
      `${nextPercent.toFixed(2)}%`,
    );

    event.preventDefault();
  };

  const finishResize = (event) => {
    stopResize(event.pointerId);
  };

  sidePanelResizeHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const optionsRect = optionsSection.getBoundingClientRect();

    dragState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOptionsHeight: optionsRect.height,
    };

    sidePanelResizeHandle.setPointerCapture(event.pointerId);
    document.body.classList.add("side-panel-resizing");
    event.preventDefault();
  });

  sidePanelResizeHandle.addEventListener("pointermove", onPointerMove);
  sidePanelResizeHandle.addEventListener("pointerup", finishResize);
  sidePanelResizeHandle.addEventListener("pointercancel", finishResize);

  // Extra safety: pointerup/pointercancel may happen outside the handle.
  window.addEventListener("pointerup", finishResize);
  window.addEventListener("pointercancel", finishResize);
  window.addEventListener("blur", () => {
    stopResize();
  });
}

function setupBackNavigationBlock() {
  if (!window.history?.pushState) return;

  window.history.pushState({ editorGuard: true }, "", window.location.href);
  window.addEventListener("popstate", () => {
    window.history.pushState({ editorGuard: true }, "", window.location.href);
  });
}

function setupCloseTabWarning() {
  window.addEventListener("beforeunload", (event) => {
    // Most browsers show a generic confirmation dialog.
    event.preventDefault();
    event.returnValue = "";
  });
}

modeSelect.addEventListener("click", () => {
  setEditorMode("drag-select");
});

modeCrop.addEventListener("click", () => {
  setEditorMode("crop-select");
});

modeRotate.addEventListener("click", () => {
  setEditorMode("rotate-select");
});

modeFilter.addEventListener("click", () => {
  setEditorMode("filter-adjust");
});

modeShadow?.addEventListener("click", () => {
  setEditorMode("shadow-adjust");
});

duplicateAction.addEventListener("click", () => {
  duplicateSelectedLayer();
});

removeBgAction.addEventListener("click", () => {
  void removeBackgroundFromSelectedLayer();
});

upscaleAction?.addEventListener("click", () => {
  void upscaleSelectedLayer();
});

deleteAction.addEventListener("click", () => {
  deleteSelectedLayer();
});

addAction.addEventListener("click", () => {
  void addLayerFlowController?.openFlow();
});

textAction?.addEventListener("click", () => {
  void textTools.createTextLayer();
});

exportSelected.addEventListener("click", () => {
  void exportSelectedImage();
});

function refresh({ rerenderOptions = true, rerenderLayersPanel = true } = {}) {
  layerBorderController.syncPreview(state.selectedLayerId);
  updateModeButtons();
  updateLayerOutsideBackground();
  renderLayers(layerRoot);
  updateSelectionBox();
  if (rerenderOptions) {
    renderOptionsPanel();
  }
  if (rerenderLayersPanel) {
    renderLayersPanel();
  }
}

historyManager = createHistoryManager({
  onStateApplied: () => {
    applyEditorZoom();
    updateModeButtons();
    refresh();
    updateHistoryButtons();
  },
});

setupToolbarHints();
updateModeButtons();
applyEditorZoom();
refresh();
updateHistoryButtons();

undoAction.addEventListener("click", () => {
  historyManager?.undo();
  updateHistoryButtons();
});

redoAction.addEventListener("click", () => {
  historyManager?.redo();
  updateHistoryButtons();
});

setupZoomControls();
setupRotateControls();
setupKeyboardShortcuts({
  getHistoryManager: () => historyManager,
  updateHistoryButtons,
  onDuplicate: duplicateSelectedLayer,
  onZoomIn: () => setEditorZoom(state.editorZoom + KEYBOARD_ZOOM_STEP),
  onZoomOut: () => setEditorZoom(state.editorZoom - KEYBOARD_ZOOM_STEP),
  onZoomReset: () => setEditorZoom(1),
  isEyedropperActive: () => isEyedropperActive,
  onDisableEyedropper: () => {
    setEyedropperActive(false);
    refresh({ rerenderOptions: true, rerenderLayersPanel: false });
  },
  onDelete: deleteSelectedLayer,
  onMoveMode: () => setEditorMode("drag-select"),
  onCropMode: () => setEditorMode("crop-select"),
  onRotateMode: () => setEditorMode("rotate-select"),
  onFilterMode: () => setEditorMode("filter-adjust"),
  onShadowMode: () => setEditorMode("shadow-adjust"),
  isCropMode: () => state.mode === "crop-select",
  isRotateMode: () => state.mode === "rotate-select",
  isFilterMode: () => state.mode === "filter-adjust",
  isShadowMode: () => state.mode === "shadow-adjust",
  onApplyCrop: () => void applyCropSelection(),
  onApplyRotate: () => void applyRotationSelection(),
  onApplyFilter: () => void applyFilterSelection(),
  onApplyShadow: () => shadowTools.applyShadowSelection(state.selectedLayerId),
  onExport: () => void exportSelectedImage(),
  onNudge: nudgeSelectedLayer,
});
blockBrowserPinchZoom();
setupEyedropperSampling();
setupSelectionContextMenu();
setupClearSelectionOnOutsideClick();
setupSidePanelResize();
setupBackNavigationBlock();
// setupCloseTabWarning();

addLayerFlowController = createAddLayerFlowController({
  state,
  openAddLayerPopup,
  createLayer,
  setSelectedLayer,
  getLayerById,
  getLayersByZOrderDesc,
  syncLayerParentingForLayer,
  loadImage,
  refresh,
  commitHistory,
});

addLayerFlowController.attachDirectDropImport(stage);

function openTextEditorFromCanvas(layerId) {
  const layer = getLayerById(layerId);
  if (!layer?.textMeta) return;

  setSelectedLayer(layerId);
  bringLayerToFront(layerId);
  setEditorMode("drag-select");
  refresh({ rerenderOptions: true, rerenderLayersPanel: true });

  window.requestAnimationFrame(() => {
    const textArea = optionsPanel.querySelector(".option-textarea");
    if (!(textArea instanceof HTMLTextAreaElement)) return;
    textArea.focus();
    textArea.select();
  });
}

attachDragSelection({
  stage,
  marquee,
  refresh,
  onCommit: commitHistory,
  onTextLayerTripleClick: openTextEditorFromCanvas,
});

if (!state.layers.length) {
  void addLayerFlowController.openFlow({ startup: true });
}
attachCropSelection({
  stage,
  refresh,
  onCommit: commitHistory,
});
  }
}

new EditorApplication().start();
