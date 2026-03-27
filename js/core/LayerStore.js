import { nextLayerId, state } from "./EditorStateStore.js";
import { getRotatedBoundingRect } from "./RotationGeometry.js";

const DEFAULT_LAYER_FILTERS = Object.freeze({
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hue: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  blur: 0,
  temp: 0,
  tint: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  texture: 0,
  clarity: 0,
  dehaze: 0,
  saturation: 0,
  sharpness: 0,
  noise: 0,
  moire: 0,
  defringe: 0,
  shadowX: 0,
  shadowY: 0,
  shadowBlur: 0,
  shadowOpacity: 0,
  shadowColor: "#000000",
  backgroundBlurAmount: 14,
});

let activeLayerBorderPreview = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeFilterNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(numeric, min, max);
}

function normalizeHexColor(value, fallback = "#000000") {
  const candidate = String(value || "").trim();
  const withHash = candidate.startsWith("#") ? candidate : `#${candidate}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return fallback;
  }
  return withHash.toUpperCase();
}

export function setLayerBorderPreview(preview) {
  if (!preview || !preview.layerId) {
    activeLayerBorderPreview = null;
    return;
  }

  const size = Math.max(0, Math.round(Number(preview.size) || 0));
  if (size <= 0) {
    activeLayerBorderPreview = null;
    return;
  }

  activeLayerBorderPreview = {
    layerId: preview.layerId,
    size,
    color: normalizeHexColor(preview.color, "#FFFFFF"),
  };
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function normalizeCornerRadiusValue(value, maxRadius) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return clamp(numeric, 0, maxRadius);
}

export function getLayerCornerRadius(layer) {
  const maxRadius =
    Math.max(
      0,
      Math.min(Number(layer?.width) || 0, Number(layer?.height) || 0) / 2,
    ) || 0;
  const source = layer?.cornerRadius;

  if (source && typeof source === "object") {
    const fallback = normalizeCornerRadiusValue(source.all, maxRadius);
    const resolveCorner = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      return normalizeCornerRadiusValue(numeric, maxRadius);
    };
    const lt = resolveCorner(source.lt) ?? fallback;
    const rt = resolveCorner(source.rt) ?? fallback;
    const rb = resolveCorner(source.rb) ?? fallback;
    const lb = resolveCorner(source.lb) ?? fallback;
    const all = lt === rt && rt === rb && rb === lb ? lt : null;

    return {
      lt,
      rt,
      rb,
      lb,
      all,
      css: `${lt}px ${rt}px ${rb}px ${lb}px`,
    };
  }

  const uniform = normalizeCornerRadiusValue(source, maxRadius);
  return {
    lt: uniform,
    rt: uniform,
    rb: uniform,
    lb: uniform,
    all: uniform,
    css: `${uniform}px`,
  };
}

export function ensureLayerCornerRadius(layer) {
  if (!layer) return;
  const radius = getLayerCornerRadius(layer);
  layer.cornerRadius = {
    lt: radius.lt,
    rt: radius.rt,
    rb: radius.rb,
    lb: radius.lb,
  };
}

export function getLayerShadowStyle(layer) {
  const current = layer?.shadowStyle || {};
  const color = normalizeHexColor(current.color, "#000000");
  const strokeColor = normalizeHexColor(current.strokeColor, "#000000");
  const opacity = normalizeFilterNumber(current.opacity, 45, 0, 100);
  const strokeSize = normalizeFilterNumber(current.strokeSize, 0, 0, 64);
  const rgb = hexToRgb(color);

  return {
    enabled: Boolean(current.enabled),
    mode: "object",
    resolvedMode: "object",
    x: normalizeFilterNumber(current.x, 0, -200, 200),
    y: normalizeFilterNumber(current.y, 8, -200, 200),
    blur: normalizeFilterNumber(current.blur, 16, 0, 200),
    opacity,
    color,
    strokeSize,
    strokeColor,
    cssColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(opacity / 100, 0, 1)})`,
  };
}

export function ensureLayerFilterDefaults(layer) {
  if (!layer) return;

  const current = layer.filters || {};
  layer.filters = {
    brightness: normalizeFilterNumber(current.brightness, 100, 0, 300),
    contrast: normalizeFilterNumber(current.contrast, 100, 0, 300),
    saturate: normalizeFilterNumber(current.saturate, 100, 0, 300),
    hue: normalizeFilterNumber(current.hue, 0, -180, 180),
    grayscale: normalizeFilterNumber(current.grayscale, 0, 0, 100),
    sepia: normalizeFilterNumber(current.sepia, 0, 0, 100),
    invert: normalizeFilterNumber(current.invert, 0, 0, 100),
    blur: normalizeFilterNumber(current.blur, 0, 0, 12),
    temp: normalizeFilterNumber(current.temp, 0, -100, 100),
    tint: normalizeFilterNumber(current.tint, 0, -100, 100),
    exposure: normalizeFilterNumber(current.exposure, 0, -100, 100),
    highlights: normalizeFilterNumber(current.highlights, 0, -100, 100),
    shadows: normalizeFilterNumber(current.shadows, 0, -100, 100),
    whites: normalizeFilterNumber(current.whites, 0, -100, 100),
    blacks: normalizeFilterNumber(current.blacks, 0, -100, 100),
    texture: normalizeFilterNumber(current.texture, 0, -100, 100),
    clarity: normalizeFilterNumber(current.clarity, 0, -100, 100),
    dehaze: normalizeFilterNumber(current.dehaze, 0, -100, 100),
    saturation: normalizeFilterNumber(current.saturation, 0, -100, 100),
    sharpness: normalizeFilterNumber(current.sharpness, 0, -100, 100),
    noise: normalizeFilterNumber(current.noise, 0, 0, 100),
    moire: normalizeFilterNumber(current.moire, 0, 0, 100),
    defringe: normalizeFilterNumber(current.defringe, 0, 0, 100),
    shadowX: normalizeFilterNumber(current.shadowX, 0, -80, 80),
    shadowY: normalizeFilterNumber(current.shadowY, 0, -80, 80),
    shadowBlur: normalizeFilterNumber(current.shadowBlur, 0, 0, 80),
    shadowOpacity: normalizeFilterNumber(current.shadowOpacity, 0, 0, 100),
    shadowColor: normalizeHexColor(current.shadowColor, "#000000"),
    backgroundBlurAmount: normalizeFilterNumber(
      current.backgroundBlurAmount,
      14,
      0,
      15,
    ),
  };
}

export function getDefaultLayerFilters() {
  return { ...DEFAULT_LAYER_FILTERS };
}

export function buildLayerFilterString(layer) {
  ensureLayerFilterDefaults(layer);
  const filters = layer?.filters || DEFAULT_LAYER_FILTERS;

  let derivedBrightness =
    filters.brightness +
    filters.exposure * 0.9 +
    filters.highlights * 0.35 +
    filters.shadows * 0.24 +
    filters.whites * 0.24 -
    filters.blacks * 0.22;

  let derivedContrast =
    filters.contrast +
    filters.clarity * 0.7 +
    filters.texture * 0.3 +
    filters.dehaze * 0.55 +
    (filters.whites - filters.blacks) * 0.25;

  let derivedSaturate =
    filters.saturate +
    filters.saturation +
    filters.dehaze * 0.28 +
    filters.temp * 0.14 -
    filters.moire * 0.16;

  let derivedHue = filters.hue + filters.temp * 0.12 + filters.tint * 0.2;
  let derivedSepia = filters.sepia + Math.max(0, filters.temp) * 0.38;
  let derivedBlur =
    filters.blur +
    Math.max(0, -filters.sharpness) * 0.02 +
    filters.noise * 0.012 +
    filters.moire * 0.01 +
    filters.defringe * 0.007;

  derivedBrightness = clamp(derivedBrightness, 0, 300);
  derivedContrast = clamp(derivedContrast, 0, 300);
  derivedSaturate = clamp(derivedSaturate, 0, 300);
  derivedHue = clamp(derivedHue, -180, 180);
  derivedSepia = clamp(derivedSepia, 0, 100);
  derivedBlur = clamp(derivedBlur, 0, 12);

  const parts = [];

  if (Math.abs(derivedBrightness - 100) > 0.001) {
    parts.push(`brightness(${derivedBrightness}%)`);
  }
  if (Math.abs(derivedContrast - 100) > 0.001) {
    parts.push(`contrast(${derivedContrast}%)`);
  }
  if (Math.abs(derivedSaturate - 100) > 0.001) {
    parts.push(`saturate(${derivedSaturate}%)`);
  }
  if (Math.abs(derivedHue) > 0.001) {
    parts.push(`hue-rotate(${derivedHue}deg)`);
  }
  if (Math.abs(filters.grayscale) > 0.001) {
    parts.push(`grayscale(${filters.grayscale}%)`);
  }
  if (Math.abs(derivedSepia) > 0.001) {
    parts.push(`sepia(${derivedSepia}%)`);
  }
  if (Math.abs(filters.invert) > 0.001) {
    parts.push(`invert(${filters.invert}%)`);
  }
  if (Math.abs(derivedBlur) > 0.001) {
    parts.push(`blur(${derivedBlur}px)`);
  }

  return parts.length ? parts.join(" ") : "none";
}

export function getLayerInsetShadow(layer) {
  ensureLayerFilterDefaults(layer);
  const filters = layer.filters;
  const color = normalizeHexColor(filters.shadowColor, "#000000");
  const rgb = hexToRgb(color);
  const opacity = clamp(filters.shadowOpacity / 100, 0, 1);

  return {
    x: filters.shadowX,
    y: filters.shadowY,
    blur: filters.shadowBlur,
    opacity,
    color,
    cssColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`,
  };
}

function getMaxZOrder() {
  return state.layers.reduce(
    (max, layer) => Math.max(max, layer.zOrder ?? 0),
    0,
  );
}

function layerArea(layer) {
  return Math.max(1, layer.width) * Math.max(1, layer.height);
}

function intersectsRect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
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

function isFullyInside(child, parent) {
  return (
    child.x >= parent.x &&
    child.y >= parent.y &&
    child.x + child.width <= parent.x + parent.width &&
    child.y + child.height <= parent.y + parent.height
  );
}

function isDescendantOf(layerId, ancestorId) {
  let current = getLayerById(layerId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = getLayerById(current.parentId);
  }
  return false;
}

export function isLayerDescendantOf(layerId, ancestorId) {
  return isDescendantOf(layerId, ancestorId);
}

function collectDescendantIds(layerId, output = new Set()) {
  for (const layer of state.layers) {
    if (layer.parentId !== layerId) continue;
    output.add(layer.id);
    collectDescendantIds(layer.id, output);
  }
  return output;
}

export function getDescendantLayerIds(layerId) {
  return [...collectDescendantIds(layerId)];
}

function isAncestorOf(ancestorId, layer) {
  let current = layer;
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = getLayerById(current.parentId);
  }
  return false;
}

function compareLayersForPaint(a, b) {
  if (a.id === b.id) return 0;

  // Parents always paint below descendants.
  if (isAncestorOf(a.id, b)) return -1;
  if (isAncestorOf(b.id, a)) return 1;

  return (a.zOrder ?? 0) - (b.zOrder ?? 0);
}

export function moveLayerWithChildren(layerId, deltaX, deltaY) {
  if (deltaX === 0 && deltaY === 0) return;

  const layer = getLayerById(layerId);
  if (!layer) return;

  const idsToMove = new Set([layerId, ...collectDescendantIds(layerId)]);

  // Keep linked AI blur pair moving together even if only one is selected.
  if (layer.linkedBackgroundLayerId) {
    idsToMove.add(layer.linkedBackgroundLayerId);
  }
  if (layer.linkedSubjectLayerId) {
    idsToMove.add(layer.linkedSubjectLayerId);
  }

  for (const linkedId of [...idsToMove]) {
    const linkedLayer = getLayerById(linkedId);
    if (!linkedLayer) continue;
    if (linkedLayer.linkedBackgroundLayerId) {
      idsToMove.add(linkedLayer.linkedBackgroundLayerId);
    }
    if (linkedLayer.linkedSubjectLayerId) {
      idsToMove.add(linkedLayer.linkedSubjectLayerId);
    }
  }

  for (const id of idsToMove) {
    const item = getLayerById(id);
    if (!item) continue;
    item.x += deltaX;
    item.y += deltaY;
  }
}

export function syncLayerParentingForLayer(layerId) {
  const child = getLayerById(layerId);
  if (!child) return;

  // Keep generated blur background helper layers detached from auto-parenting.
  if (child.backgroundBlurRole === "background") {
    return;
  }

  if (
    child.backgroundBlurRole === "subject" &&
    child.linkedBackgroundLayerId &&
    child.parentId === child.linkedBackgroundLayerId
  ) {
    child.parentId = null;
  }

  if (child.parentId) {
    const parent = getLayerById(child.parentId);
    if (!parent) {
      child.parentId = null;
      return;
    }

    // Keep parent relation while intersecting; detach only when fully outside.
    const childRect = {
      x: child.x,
      y: child.y,
      width: child.width,
      height: child.height,
    };
    const parentRect = {
      x: parent.x,
      y: parent.y,
      width: parent.width,
      height: parent.height,
    };

    if (intersectsRect(childRect, parentRect)) {
      return;
    }

    child.parentId = null;
    return;
  }

  let bestParent = null;
  let bestArea = Number.POSITIVE_INFINITY;

  for (const candidate of state.layers) {
    if (candidate.id === child.id) continue;
    if (
      child.linkedBackgroundLayerId &&
      candidate.id === child.linkedBackgroundLayerId
    ) {
      continue;
    }
    if (isDescendantOf(candidate.id, child.id)) continue;
    if (!isFullyInside(child, candidate)) continue;

    const area = layerArea(candidate);
    if (area < bestArea) {
      bestArea = area;
      bestParent = candidate;
    }
  }

  child.parentId = bestParent ? bestParent.id : null;
}

export function getLayerChildren(parentId) {
  return state.layers.filter((layer) => layer.parentId === parentId);
}

export function getRootLayers() {
  return state.layers.filter((layer) => !layer.parentId);
}

function getActiveCropForLayer(layer) {
  if (state.mode !== "crop-select") return null;
  if (state.cropSelection?.layerId !== layer.id) return null;
  return state.cropSelection;
}

function getLayerCanvasBounds(layer, crop) {
  const useCropExpandedCanvas = Boolean(layer.showOutsideBackground && crop);
  const useRotateExpandedCanvas =
    Boolean(layer.showOutsideBackground) &&
    state.mode === "rotate-select" &&
    Math.abs(Number(layer.rotation) || 0) > 0.001;

  const useExpandedCanvas = useCropExpandedCanvas || useRotateExpandedCanvas;

  if (!useExpandedCanvas) {
    return {
      useExpandedCanvas,
      left: layer.x,
      top: layer.y,
      width: layer.width,
      height: layer.height,
    };
  }

  if (useRotateExpandedCanvas) {
    const rotatedRect = getRotatedBoundingRect(layer);
    return {
      useExpandedCanvas,
      left: rotatedRect.x,
      top: rotatedRect.y,
      width: rotatedRect.width,
      height: rotatedRect.height,
    };
  }

  const left = Math.min(layer.x, crop.x);
  const top = Math.min(layer.y, crop.y);
  const right = Math.max(layer.x + layer.width, crop.x + crop.width);
  const bottom = Math.max(layer.y + layer.height, crop.y + crop.height);

  return {
    useExpandedCanvas,
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function getAncestorClipState(layer, baseBounds) {
  let visible = {
    x: baseBounds.left,
    y: baseBounds.top,
    width: baseBounds.width,
    height: baseBounds.height,
  };
  let clippedByAncestor = false;

  let ancestor = layer.parentId ? getLayerById(layer.parentId) : null;
  while (ancestor) {
    const activeCropForAncestor =
      state.mode === "crop-select" &&
      state.cropSelection?.layerId === ancestor.id
        ? state.cropSelection
        : null;

    const ancestorRect = activeCropForAncestor
      ? {
          x: activeCropForAncestor.x,
          y: activeCropForAncestor.y,
          width: activeCropForAncestor.width,
          height: activeCropForAncestor.height,
        }
      : {
          x: ancestor.x,
          y: ancestor.y,
          width: ancestor.width,
          height: ancestor.height,
        };

    const nextVisible = intersectRect(visible, ancestorRect);
    if (!nextVisible) {
      return {
        hidden: true,
        clippedByAncestor: true,
        clipRect: null,
      };
    }

    if (
      nextVisible.x !== visible.x ||
      nextVisible.y !== visible.y ||
      nextVisible.width !== visible.width ||
      nextVisible.height !== visible.height
    ) {
      clippedByAncestor = true;
    }

    visible = nextVisible;
    ancestor = ancestor.parentId ? getLayerById(ancestor.parentId) : null;
  }

  return {
    hidden: false,
    clippedByAncestor,
    clipRect: visible,
  };
}

function buildLayerElement(
  layer,
  bounds,
  clipState,
  { usePreviewFill = false } = {},
) {
  const el = document.createElement("div");
  el.className = "layer";
  if (layer.isRemovingBackground || layer.isUpscaling) {
    el.classList.add("magic-removing");
  }
  if (layer.bgRemovalFlashToken || layer.upscaleFlashToken) {
    el.classList.add("magic-applied");
  }
  el.dataset.layerId = layer.id;
  el.style.left = `${bounds.left}px`;
  el.style.top = `${bounds.top}px`;
  el.style.width = `${bounds.width}px`;
  el.style.height = `${bounds.height}px`;
  const isSolidCropBackground = layer.cropBackgroundMode !== "transparent";
  const shouldRenderLayerBackground =
    isSolidCropBackground &&
    (layer.showOutsideBackground || Boolean(layer.textMeta));
  el.style.background = shouldRenderLayerBackground
    ? layer.cropBackgroundColor || "#ffffff"
    : "transparent";
  const baseOpacity = Number.isFinite(Number(layer.opacity))
    ? clamp(Number(layer.opacity), 0, 1)
    : 1;
  const clipOpacity = clipState.clippedByAncestor ? 0.92 : 1;
  el.style.opacity = String(baseOpacity * clipOpacity);
  const rotation = Number(layer.rotation) || 0;
  // In rotate preview fill mode, keep container axis-aligned so bg stays inside
  // selection bounds; only the image is rotated.
  el.style.transform = usePreviewFill ? "none" : `rotate(${rotation}deg)`;
  el.style.transformOrigin = "center center";
  const cornerRadius = getLayerCornerRadius(layer);
  el.style.borderRadius = cornerRadius.css;
  el.style.boxShadow = "none";

  if (
    activeLayerBorderPreview &&
    activeLayerBorderPreview.layerId === layer.id &&
    activeLayerBorderPreview.size > 0
  ) {
    el.style.boxShadow = `0 0 0 ${activeLayerBorderPreview.size}px ${activeLayerBorderPreview.color}`;
  }

  if (clipState.clipRect) {
    const clipTop = Math.max(0, clipState.clipRect.y - bounds.top);
    const clipLeft = Math.max(0, clipState.clipRect.x - bounds.left);
    const clipRight = Math.max(
      0,
      bounds.left +
        bounds.width -
        (clipState.clipRect.x + clipState.clipRect.width),
    );
    const clipBottom = Math.max(
      0,
      bounds.top +
        bounds.height -
        (clipState.clipRect.y + clipState.clipRect.height),
    );

    if (clipTop || clipRight || clipBottom || clipLeft) {
      el.style.clipPath = `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
    }
  }

  return el;
}

function buildLayerImage(layer, bounds, { usePreviewFill = false } = {}) {
  const img = document.createElement("img");
  img.src = layer.src;
  img.alt = layer.id;
  img.draggable = false;
  // Always render with explicit px sizing to prevent tiny jumps
  // when crop expand toggles between normal and expanded canvas.
  img.style.position = "absolute";
  img.style.left = `${layer.x - bounds.left}px`;
  img.style.top = `${layer.y - bounds.top}px`;
  img.style.width = `${layer.width}px`;
  img.style.height = `${layer.height}px`;
  const baseFilter = buildLayerFilterString(layer);
  const layerShadow = getLayerShadowStyle(layer);
  const filterParts = [];
  if (baseFilter && baseFilter !== "none") {
    filterParts.push(baseFilter);
  }

  if (layerShadow.enabled && layerShadow.resolvedMode === "object") {
    if (layerShadow.strokeSize > 0) {
      const s = layerShadow.strokeSize;
      const c = layerShadow.strokeColor;
      filterParts.push(`drop-shadow(${s}px 0 0 ${c})`);
      filterParts.push(`drop-shadow(${-s}px 0 0 ${c})`);
      filterParts.push(`drop-shadow(0 ${s}px 0 ${c})`);
      filterParts.push(`drop-shadow(0 ${-s}px 0 ${c})`);
      filterParts.push(`drop-shadow(${s}px ${s}px 0 ${c})`);
      filterParts.push(`drop-shadow(${-s}px ${s}px 0 ${c})`);
      filterParts.push(`drop-shadow(${s}px ${-s}px 0 ${c})`);
      filterParts.push(`drop-shadow(${-s}px ${-s}px 0 ${c})`);
    }
    filterParts.push(
      `drop-shadow(${layerShadow.x}px ${layerShadow.y}px ${layerShadow.blur}px ${layerShadow.cssColor})`,
    );
  }

  img.style.filter = filterParts.length ? filterParts.join(" ") : "none";
  const cornerRadius = getLayerCornerRadius(layer);
  img.style.borderRadius = cornerRadius.css;

  if (usePreviewFill) {
    const rotation = Number(layer.rotation) || 0;
    img.style.transform = `rotate(${rotation}deg)`;
    img.style.transformOrigin = "center center";
  }

  return img;
}

function buildLayerInsetShadowOverlay(
  layer,
  bounds,
  { usePreviewFill = false } = {},
) {
  const insetShadow = getLayerInsetShadow(layer);
  if (
    insetShadow.opacity <= 0 ||
    (insetShadow.blur <= 0 && insetShadow.x === 0 && insetShadow.y === 0)
  ) {
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "layer-inset-shadow-overlay";
  overlay.style.left = `${layer.x - bounds.left}px`;
  overlay.style.top = `${layer.y - bounds.top}px`;
  overlay.style.width = `${layer.width}px`;
  overlay.style.height = `${layer.height}px`;
  overlay.style.boxShadow = `inset ${insetShadow.x}px ${insetShadow.y}px ${insetShadow.blur}px ${insetShadow.cssColor}`;
  overlay.style.borderRadius = getLayerCornerRadius(layer).css;

  const maskSrc = String(layer.src || "").replace(/"/g, '\\"');
  const maskValue = `url("${maskSrc}")`;
  overlay.style.webkitMaskImage = maskValue;
  overlay.style.maskImage = maskValue;
  overlay.style.webkitMaskRepeat = "no-repeat";
  overlay.style.maskRepeat = "no-repeat";
  overlay.style.webkitMaskPosition = "center";
  overlay.style.maskPosition = "center";
  overlay.style.webkitMaskSize = "100% 100%";
  overlay.style.maskSize = "100% 100%";

  if (usePreviewFill) {
    const rotation = Number(layer.rotation) || 0;
    overlay.style.transform = `rotate(${rotation}deg)`;
    overlay.style.transformOrigin = "center center";
  }

  return overlay;
}

export function createLayer(src, width = 420, height = 300) {
  return {
    id: nextLayerId(),
    src,
    x: 120,
    y: 80,
    width,
    height,
    parentId: null,
    zOrder: getMaxZOrder() + 1,
    cropBackgroundColor: "#ffffff",
    cropBackgroundMode: "solid",
    rotation: 0,
    cornerRadius: {
      lt: 0,
      rt: 0,
      rb: 0,
      lb: 0,
    },
    shadowStyle: {
      enabled: false,
      mode: "object",
      x: 0,
      y: 8,
      blur: 16,
      opacity: 45,
      color: "#000000",
      strokeSize: 0,
      strokeColor: "#000000",
    },
    filters: getDefaultLayerFilters(),
  };
}

export function renderLayers(layerRoot) {
  layerRoot.innerHTML = "";

  const orderedLayers = [...state.layers].sort(compareLayersForPaint);

  for (const layer of orderedLayers) {
    const crop = getActiveCropForLayer(layer);
    const baseBounds = getLayerCanvasBounds(layer, crop);
    const clipState = getAncestorClipState(layer, baseBounds);
    if (clipState.hidden) continue;

    const useRotatePreviewFill =
      state.mode === "rotate-select" &&
      layer.showOutsideBackground &&
      Math.abs(Number(layer.rotation) || 0) > 0.001;

    const el = buildLayerElement(layer, baseBounds, clipState, {
      usePreviewFill: useRotatePreviewFill,
    });
    const img = buildLayerImage(layer, baseBounds, {
      usePreviewFill: useRotatePreviewFill,
    });
    el.appendChild(img);

    const insetShadowOverlay = buildLayerInsetShadowOverlay(layer, baseBounds, {
      usePreviewFill: useRotatePreviewFill,
    });
    if (insetShadowOverlay) {
      el.appendChild(insetShadowOverlay);
    }

    layerRoot.appendChild(el);
  }
}

export function getLayerById(id) {
  return state.layers.find((layer) => layer.id === id) || null;
}

export function bringLayerToFront(id) {
  const layer = getLayerById(id);
  if (!layer) return;
  layer.zOrder = getMaxZOrder() + 1;
}

export function getLayersByZOrderDesc() {
  return [...state.layers].sort((a, b) => compareLayersForPaint(b, a));
}

export function setSelectedLayer(id) {
  state.selectedLayerId = id;
}

export function setLayerName(layerId, nextName) {
  const layer = getLayerById(layerId);
  if (!layer) return;

  const normalized = String(nextName || "").trim();
  layer.name = normalized || layer.id;
}

export function deleteLayerWithDescendants(layerId) {
  const idsToDelete = new Set([layerId, ...collectDescendantIds(layerId)]);
  state.layers = state.layers.filter((layer) => !idsToDelete.has(layer.id));

  if (state.selectedLayerId && idsToDelete.has(state.selectedLayerId)) {
    state.selectedLayerId = null;
  }

  if (
    state.cropSelection?.layerId &&
    idsToDelete.has(state.cropSelection.layerId)
  ) {
    state.cropSelection = null;
  }
}

export function duplicateLayerWithDescendants(
  layerId,
  { offsetX = 24, offsetY = 24 } = {},
) {
  const sourceLayer = getLayerById(layerId);
  if (!sourceLayer) return null;

  const sourceIds = new Set([layerId, ...collectDescendantIds(layerId)]);
  const layersToClone = state.layers
    .filter((layer) => sourceIds.has(layer.id))
    .sort((a, b) => compareLayersForPaint(a, b));

  const startingZ = getMaxZOrder() + 1;
  const idMap = new Map();
  const clonedLayers = [];

  for (let index = 0; index < layersToClone.length; index += 1) {
    const layer = layersToClone[index];
    const clonedId = nextLayerId();
    idMap.set(layer.id, clonedId);

    const clonedParentId = layer.parentId
      ? idMap.get(layer.parentId) || layer.parentId
      : null;

    const baseName = layer.name || layer.id;

    clonedLayers.push({
      ...layer,
      id: clonedId,
      name: `${baseName} copy`,
      parentId: clonedParentId,
      x: layer.x + offsetX,
      y: layer.y + offsetY,
      zOrder: startingZ + index,
    });
  }

  state.layers.push(...clonedLayers);
  return idMap.get(layerId) || null;
}

/**
 * Class facade for layer operations, exposing all module behaviors as methods.
 */
export class LayersFacade {
  /** @param {any} layer */
  getLayerCornerRadius(layer) {
    return getLayerCornerRadius(layer);
  }

  /** @param {any} layer */
  ensureLayerCornerRadius(layer) {
    ensureLayerCornerRadius(layer);
  }

  /** @param {any} layer */
  getLayerShadowStyle(layer) {
    return getLayerShadowStyle(layer);
  }

  /** @param {any} layer */
  ensureLayerFilterDefaults(layer) {
    ensureLayerFilterDefaults(layer);
  }

  getDefaultLayerFilters() {
    return getDefaultLayerFilters();
  }

  /** @param {any} layer */
  buildLayerFilterString(layer) {
    return buildLayerFilterString(layer);
  }

  /** @param {any} layer */
  getLayerInsetShadow(layer) {
    return getLayerInsetShadow(layer);
  }

  /** @param {string|null} layerId @param {string|null} ancestorId */
  isLayerDescendantOf(layerId, ancestorId) {
    return isLayerDescendantOf(layerId, ancestorId);
  }

  /** @param {string} layerId */
  getDescendantLayerIds(layerId) {
    return getDescendantLayerIds(layerId);
  }

  /** @param {string} layerId @param {number} deltaX @param {number} deltaY */
  moveLayerWithChildren(layerId, deltaX, deltaY) {
    moveLayerWithChildren(layerId, deltaX, deltaY);
  }

  /** @param {string} layerId */
  syncLayerParentingForLayer(layerId) {
    syncLayerParentingForLayer(layerId);
  }

  /** @param {string} parentId */
  getLayerChildren(parentId) {
    return getLayerChildren(parentId);
  }

  getRootLayers() {
    return getRootLayers();
  }

  /** @param {string} src @param {number} width @param {number} height */
  createLayer(src, width = 420, height = 300) {
    return createLayer(src, width, height);
  }

  /** @param {HTMLElement} layerRoot */
  renderLayers(layerRoot) {
    renderLayers(layerRoot);
  }

  /** @param {string|null} id */
  getLayerById(id) {
    return getLayerById(id);
  }

  /** @param {string} id */
  bringLayerToFront(id) {
    bringLayerToFront(id);
  }

  getLayersByZOrderDesc() {
    return getLayersByZOrderDesc();
  }

  /** @param {string|null} id */
  setSelectedLayer(id) {
    setSelectedLayer(id);
  }

  /** @param {string} layerId @param {string} nextName */
  setLayerName(layerId, nextName) {
    setLayerName(layerId, nextName);
  }

  /** @param {string} layerId */
  deleteLayerWithDescendants(layerId) {
    deleteLayerWithDescendants(layerId);
  }

  /** @param {string} layerId @param {{offsetX?:number,offsetY?:number}} options */
  duplicateLayerWithDescendants(layerId, options) {
    return duplicateLayerWithDescendants(layerId, options);
  }

  /** @param {any|null} preview */
  setLayerBorderPreview(preview) {
    setLayerBorderPreview(preview);
  }
}
