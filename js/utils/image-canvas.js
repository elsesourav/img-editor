let upscaleAiInitPromise = null;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image for crop."));
    img.src = src;
  });
}

export function getRectFromLayer(layer) {
  return {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
  };
}

export function getBoundingRectForLayers(layers) {
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

export function intersectRect(a, b) {
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

export function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function rgbToHex(r, g, b) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export async function renderLayerRegionToCanvas(
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

export function buildInsetShadowCanvas(
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

export async function renderFilteredLayerToCanvas(
  layer,
  { ensureLayerDefaults, buildLayerFilterString, getLayerInsetShadow },
) {
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

export function buildObjectStrokeFilterChain(
  strokeSize,
  strokeColor,
  { isTextLayer = false } = {},
) {
  const size = Math.max(0, Number(strokeSize) || 0);
  if (size <= 0) return "";
  const color = String(strokeColor || "#000000");

  if (isTextLayer) {
    const s = Number(size.toFixed(3));
    const half = Number((size * 0.5).toFixed(3));
    const parts = [
      `drop-shadow(${s}px 0 0 ${color})`,
      `drop-shadow(${-s}px 0 0 ${color})`,
      `drop-shadow(0 ${s}px 0 ${color})`,
      `drop-shadow(0 ${-s}px 0 ${color})`,
    ];

    if (size >= 1.5) {
      parts.push(`drop-shadow(${half}px ${half}px 0 ${color})`);
      parts.push(`drop-shadow(${-half}px ${half}px 0 ${color})`);
      parts.push(`drop-shadow(${half}px ${-half}px 0 ${color})`);
      parts.push(`drop-shadow(${-half}px ${-half}px 0 ${color})`);
    }

    return parts.join(" ");
  }

  const parts = [];
  const seen = new Set();
  const angles = size <= 2 ? 8 : size <= 8 ? 12 : 16;

  for (let index = 0; index < angles; index += 1) {
    const angle = (Math.PI * 2 * index) / angles;
    const dx = Number((Math.cos(angle) * size).toFixed(3));
    const dy = Number((Math.sin(angle) * size).toFixed(3));
    const key = `${dx},${dy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(`drop-shadow(${dx}px ${dy}px 0 ${color})`);
  }

  return parts.join(" ");
}

export function bakeObjectStrokeIntoCanvas(
  sourceCanvas,
  strokeSize,
  strokeColor,
  options,
) {
  const filterChain = buildObjectStrokeFilterChain(
    strokeSize,
    strokeColor,
    options,
  );
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

export async function buildUpscaleSourceDrawable(layer, getLayerShadowStyle) {
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
      shadowStyle.strokeCssColor || shadowStyle.strokeColor,
      { isTextLayer: Boolean(layer.textMeta) },
    ),
    bakedStroke: true,
  };
}

export async function renderCompositeLayersToCanvas(
  baseLayer,
  layers,
  regionRect,
  {
    fillBackground = false,
    buildLayerFilterString,
    getLayerShadowStyle,
    getLayerInsetShadow,
    getLayerCornerRadius,
    getAncestorVisibleRectForRegion,
  },
) {
  const normalizeHexColor = (value, fallback = "#FFFFFF") => {
    const candidate = String(value || "").trim();
    const withHash = candidate.startsWith("#") ? candidate : `#${candidate}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
      return fallback;
    }
    return withHash.toUpperCase();
  };

  const addRoundedRectPath = (ctx, x, y, width, height, radii) => {
    const w = Math.max(0, width);
    const h = Math.max(0, height);
    const maxRx = w / 2;
    const maxRy = h / 2;
    const lt = Math.max(0, Math.min(maxRx, maxRy, Number(radii.lt) || 0));
    const rt = Math.max(0, Math.min(maxRx, maxRy, Number(radii.rt) || 0));
    const rb = Math.max(0, Math.min(maxRx, maxRy, Number(radii.rb) || 0));
    const lb = Math.max(0, Math.min(maxRx, maxRy, Number(radii.lb) || 0));

    ctx.moveTo(x + lt, y);
    ctx.lineTo(x + w - rt, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rt);
    ctx.lineTo(x + w, y + h - rb);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rb, y + h);
    ctx.lineTo(x + lb, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - lb);
    ctx.lineTo(x, y + lt);
    ctx.quadraticCurveTo(x, y, x + lt, y);
    ctx.closePath();
  };

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
    const baseFilterString = buildLayerFilterString(layer);
    const filterParts = [];
    if (baseFilterString && baseFilterString !== "none") {
      filterParts.push(baseFilterString);
    }

    if (typeof getLayerShadowStyle === "function") {
      const layerShadow = getLayerShadowStyle(layer);
      if (layerShadow.enabled && layerShadow.resolvedMode === "object") {
        if (layerShadow.strokeSize > 0) {
          const strokeFilter = buildObjectStrokeFilterChain(
            layerShadow.strokeSize,
            layerShadow.strokeCssColor || layerShadow.strokeColor,
            { isTextLayer: Boolean(layer.textMeta) },
          );
          if (strokeFilter) {
            filterParts.push(strokeFilter);
          }
        }

        filterParts.push(
          `drop-shadow(${layerShadow.x}px ${layerShadow.y}px ${layerShadow.blur}px ${layerShadow.cssColor})`,
        );
      }
    }

    const filterString = filterParts.length ? filterParts.join(" ") : "none";

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
    const appliedBorderSize = Math.max(
      0,
      Math.round(Number(layer?.appliedBorder?.size) || 0),
    );
    const borderX = appliedBorderSize * scaleX;
    const borderY = appliedBorderSize * scaleY;
    const contentX = drawX;
    const contentY = drawY;
    const contentWidth = Math.max(1, drawWidth - borderX * 2);
    const contentHeight = Math.max(1, drawHeight - borderY * 2);

    let cornerRadii = { lt: 0, rt: 0, rb: 0, lb: 0 };
    if (typeof getLayerCornerRadius === "function") {
      const radius = getLayerCornerRadius(layer);
      cornerRadii = {
        lt: (Number(radius?.lt) || 0) * Math.min(scaleX, scaleY),
        rt: (Number(radius?.rt) || 0) * Math.min(scaleX, scaleY),
        rb: (Number(radius?.rb) || 0) * Math.min(scaleX, scaleY),
        lb: (Number(radius?.lb) || 0) * Math.min(scaleX, scaleY),
      };
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, clipY, clipWidth, clipHeight);
    ctx.clip();

    ctx.beginPath();
    addRoundedRectPath(ctx, contentX, contentY, contentWidth, contentHeight, {
      lt: cornerRadii.lt,
      rt: cornerRadii.rt,
      rb: cornerRadii.rb,
      lb: cornerRadii.lb,
    });
    ctx.clip();

    const layerOpacity = Number.isFinite(Number(layer.opacity))
      ? Math.max(0, Math.min(1, Number(layer.opacity)))
      : 1;
    ctx.globalAlpha = layerOpacity;
    ctx.filter = filterString;
    ctx.drawImage(img, contentX, contentY, contentWidth, contentHeight);

    const insetShadow = getLayerInsetShadow(layer);
    if (
      insetShadow.opacity > 0 &&
      (insetShadow.blur > 0 || insetShadow.x !== 0 || insetShadow.y !== 0)
    ) {
      const shadowCanvas = buildInsetShadowCanvas(
        img,
        contentWidth,
        contentHeight,
        baseFilterString,
        insetShadow,
      );
      ctx.drawImage(
        shadowCanvas,
        contentX,
        contentY,
        contentWidth,
        contentHeight,
      );
    }

    if (appliedBorderSize > 0) {
      const borderColor = normalizeHexColor(
        layer?.appliedBorder?.color,
        "#FFFFFF",
      );
      ctx.filter = "none";
      ctx.lineJoin = "round";
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = Math.max(1, appliedBorderSize * Math.min(scaleX, scaleY));
      ctx.beginPath();
      addRoundedRectPath(
        ctx,
        contentX + ctx.lineWidth / 2,
        contentY + ctx.lineWidth / 2,
        Math.max(1, contentWidth - ctx.lineWidth),
        Math.max(1, contentHeight - ctx.lineWidth),
        {
          lt: cornerRadii.lt,
          rt: cornerRadii.rt,
          rb: cornerRadii.rb,
          lb: cornerRadii.lb,
        },
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  return { canvas, scaleX, scaleY };
}

export function canvasToBlob(canvas, mimeType, quality) {
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

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function resizeCanvasWithQuality(sourceCanvas, width, height) {
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

export function quantizeCanvasColors(sourceCanvas, levels) {
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

export function applySharpenToCanvas(sourceCanvas, amount = 0.28) {
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
  return canvas;
}

export function upscaleImageEnhanced(image, targetWidth, targetHeight) {
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

export async function normalizeUpscaleOutputToCanvas(
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

export async function upscaleImageAiFirst(image, targetWidth, targetHeight) {
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

export function getFormatInfo(format) {
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

export async function encodeByQualityPreset(canvas, preset, format) {
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

export async function encodeByTargetSize(canvas, targetBytes, format) {
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
