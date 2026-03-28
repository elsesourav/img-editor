import {
  buildLayerFilterString,
  ensureLayerFilterDefaults,
  getDefaultLayerFilters,
  getLayerInsetShadow,
  getLayerShadowStyle,
} from "../../core/LayerStore.js";
import {
  buildObjectStrokeFilterChain,
  renderFilteredLayerToCanvas,
} from "../../utils/image-canvas.js";
import {
  openCustomTemplatePicker,
  openTemplateSaveConfirm,
  openTemplateSaveOptions,
} from "./CustomTemplatePopup.js";

const STORAGE_KEY = "img-editor.custom-templates.v1";
const TEMPLATE_MAX_BYTES = 1024 * 1024;

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function sanitizeNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function sanitizeSize(value, fallback = 1) {
  return Math.max(1, Math.round(sanitizeNumber(value, fallback)));
}

function createTransparentLayerDataUrl(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = sanitizeSize(width, 1);
  canvas.height = sanitizeSize(height, 1);

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return canvas.toDataURL("image/png");
}

function normalizeTemplateImageFitMode(value) {
  const mode = String(value || "stretch").toLowerCase();
  if (mode === "contain" || mode === "cover") {
    return mode;
  }
  return "stretch";
}

async function renderSourceToLayerSizedDataUrl(
  source,
  width,
  height,
  loadImage,
  fitMode = "stretch",
) {
  const safeWidth = sanitizeSize(width, 1);
  const safeHeight = sanitizeSize(height, 1);
  if (!source || typeof loadImage !== "function") {
    return String(source || "");
  }

  try {
    const image = await loadImage(String(source));
    const canvas = document.createElement("canvas");
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return String(source);
    }

    const resolvedFitMode = normalizeTemplateImageFitMode(fitMode);
    const imageWidth = Math.max(1, image.naturalWidth || image.width || 1);
    const imageHeight = Math.max(1, image.naturalHeight || image.height || 1);

    ctx.clearRect(0, 0, safeWidth, safeHeight);
    if (resolvedFitMode === "stretch") {
      ctx.drawImage(image, 0, 0, safeWidth, safeHeight);
    } else {
      const scale =
        resolvedFitMode === "cover"
          ? Math.max(safeWidth / imageWidth, safeHeight / imageHeight)
          : Math.min(safeWidth / imageWidth, safeHeight / imageHeight);
      const drawWidth = Math.max(1, Math.round(imageWidth * scale));
      const drawHeight = Math.max(1, Math.round(imageHeight * scale));
      const drawX = Math.round((safeWidth - drawWidth) / 2);
      const drawY = Math.round((safeHeight - drawHeight) / 2);
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    }

    return canvas.toDataURL("image/png");
  } catch {
    return String(source);
  }
}

async function renderLockedLayerVisualDataUrl(layer, loadImage) {
  const fitMode = normalizeTemplateImageFitMode(layer.templateImageFitMode);
  const normalizedSrc = await renderSourceToLayerSizedDataUrl(
    layer.src,
    layer.width,
    layer.height,
    loadImage,
    fitMode,
  );

  const previewLayer = {
    ...layer,
    src: normalizedSrc,
    width: sanitizeSize(layer.width, 1),
    height: sanitizeSize(layer.height, 1),
  };

  const filteredCanvas = await renderFilteredLayerToCanvas(previewLayer, {
    ensureLayerDefaults: ensureLayerFilterDefaults,
    buildLayerFilterString,
    getLayerInsetShadow,
  });

  const shadowStyle = getLayerShadowStyle(previewLayer);
  const shouldRenderObjectShadow =
    shadowStyle.enabled && shadowStyle.resolvedMode === "object";
  if (!shouldRenderObjectShadow) {
    return filteredCanvas.toDataURL("image/png");
  }

  const canvas = document.createElement("canvas");
  canvas.width = filteredCanvas.width;
  canvas.height = filteredCanvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return filteredCanvas.toDataURL("image/png");
  }

  const filterParts = [];
  if (shadowStyle.strokeSize > 0) {
    const strokeFilter = buildObjectStrokeFilterChain(
      shadowStyle.strokeSize,
      shadowStyle.strokeCssColor || shadowStyle.strokeColor,
      { isTextLayer: Boolean(previewLayer.textMeta) },
    );
    if (strokeFilter) {
      filterParts.push(strokeFilter);
    }
  }
  filterParts.push(
    `drop-shadow(${shadowStyle.x}px ${shadowStyle.y}px ${shadowStyle.blur}px ${shadowStyle.cssColor})`,
  );

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = filterParts.length ? filterParts.join(" ") : "none";
  ctx.drawImage(filteredCanvas, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";
  return canvas.toDataURL("image/png");
}

function readTemplateListFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTemplateListToStorage(templates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("Failed to write custom templates", error);
  }
}

function downloadTemplateJson(template) {
  const safeName = String(template?.name || "template")
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

  const payload = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    template,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName || "template"}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function normalizeImportedTemplate(payload) {
  const rawTemplate =
    payload?.template && Array.isArray(payload.template.layers)
      ? payload.template
      : payload;

  if (
    !rawTemplate ||
    !Array.isArray(rawTemplate.layers) ||
    !rawTemplate.layers.length
  ) {
    return null;
  }

  return {
    ...rawTemplate,
    id:
      rawTemplate.id ||
      `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(rawTemplate.name || "Imported Template"),
    createdAt: Number(rawTemplate.createdAt) || Date.now(),
  };
}

function estimateTemplateBytes(template) {
  try {
    return new Blob([JSON.stringify(template)]).size;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function createDefaultTemplateName() {
  const now = Date.now();
  const stamp = new Date(now);
  const pad = (value) => String(value).padStart(2, "0");
  return `Template ${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;
}

async function toLayerSnapshot(layer, isLocked = false, loadImage) {
  const isSourceText = Boolean(layer.textMeta);
  const kind = isSourceText && !isLocked ? "text" : "image";
  const imageFitMode = normalizeTemplateImageFitMode(
    layer.templateImageFitMode,
  );
  let lockedSnapshotSrc = null;
  if (isLocked) {
    lockedSnapshotSrc = await renderLockedLayerVisualDataUrl(layer, loadImage);
  }

  const defaultShadowStyle = {
    enabled: false,
    mode: "object",
    x: 0,
    y: 0,
    blur: 5,
    opacity: 45,
    color: "#000000",
    strokeSize: 0,
    strokeColor: "#000000",
    strokeOpacity: 100,
  };

  return {
    id: String(layer.id),
    name: String(layer.name || ""),
    parentId: layer.parentId ? String(layer.parentId) : null,
    type: kind,
    locked: Boolean(isLocked),
    x: sanitizeNumber(layer.x, 0),
    y: sanitizeNumber(layer.y, 0),
    width: sanitizeSize(layer.width, 1),
    height: sanitizeSize(layer.height, 1),
    zOrder: sanitizeNumber(layer.zOrder, 0),
    rotation: sanitizeNumber(layer.rotation, 0),
    cropBackgroundColor: String(layer.cropBackgroundColor || "#ffffff"),
    cropBackgroundMode: String(layer.cropBackgroundMode || "solid"),
    cornerRadius: cloneValue(layer.cornerRadius) || {
      lt: 0,
      rt: 0,
      rb: 0,
      lb: 0,
    },
    shadowStyle: isLocked
      ? defaultShadowStyle
      : cloneValue(layer.shadowStyle) || defaultShadowStyle,
    appliedBorder: layer.appliedBorder ? cloneValue(layer.appliedBorder) : null,
    filters: isLocked
      ? getDefaultLayerFilters()
      : cloneValue(layer.filters) || null,
    textMeta: kind === "text" ? cloneValue(layer.textMeta) : null,
    imageFitMode: kind === "image" ? imageFitMode : undefined,
    src: lockedSnapshotSrc,
  };
}

async function createTemplateFromState({
  state,
  name,
  lockedLayerIds = [],
  loadImage,
}) {
  const now = Date.now();
  const lockedSet = new Set(lockedLayerIds.map((value) => String(value)));
  const orderedLayers = [...(state.layers || [])].sort(
    (a, b) => (a.zOrder || 0) - (b.zOrder || 0),
  );
  const layers = [];
  for (const layer of orderedLayers) {
    layers.push(
      await toLayerSnapshot(layer, lockedSet.has(String(layer.id)), loadImage),
    );
  }

  if (!layers.length) {
    return null;
  }

  const selectedId = state.selectedLayerId
    ? String(state.selectedLayerId)
    : null;
  const cropSelection =
    state.cropSelection && state.cropSelection.layerId
      ? {
          layerId: String(state.cropSelection.layerId),
          x: sanitizeNumber(state.cropSelection.x, 0),
          y: sanitizeNumber(state.cropSelection.y, 0),
          width: sanitizeSize(state.cropSelection.width, 1),
          height: sanitizeSize(state.cropSelection.height, 1),
        }
      : null;

  return {
    id: `tpl-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || createDefaultTemplateName()),
    createdAt: now,
    mode: "drag-select",
    selectedLayerId: selectedId,
    cropSelection,
    cropAspectRatio:
      Number.isFinite(Number(state.cropAspectRatio)) &&
      Number(state.cropAspectRatio) > 0
        ? Number(state.cropAspectRatio)
        : null,
    layers,
    thumb: null,
  };
}

/**
 * Builds a tiny thumbnail image to store with template metadata.
 * @param {{state:any,loadImage:(src:string)=>Promise<HTMLImageElement>}} deps - Runtime deps.
 * @return {Promise<string|null>} - Tiny thumbnail data URL.
 */
async function createTinyTemplateThumb({ state, loadImage }) {
  const selected = state.layers.find(
    (layer) => layer.id === state.selectedLayerId,
  );
  const fallback = state.layers[state.layers.length - 1] || state.layers[0];
  const sourceLayer = selected || fallback;
  if (!sourceLayer?.src || typeof loadImage !== "function") return null;

  try {
    const image = await loadImage(sourceLayer.src);
    const canvas = document.createElement("canvas");
    canvas.width = 56;
    canvas.height = 56;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111317";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const iw = Math.max(1, image.naturalWidth || image.width || 1);
    const ih = Math.max(1, image.naturalHeight || image.height || 1);
    const scale = Math.min(canvas.width / iw, canvas.height / ih);
    const drawW = Math.max(1, Math.round(iw * scale));
    const drawH = Math.max(1, Math.round(ih * scale));
    const drawX = Math.round((canvas.width - drawW) / 2);
    const drawY = Math.round((canvas.height - drawH) / 2);
    ctx.drawImage(image, drawX, drawY, drawW, drawH);

    return canvas.toDataURL("image/webp", 0.5);
  } catch {
    return null;
  }
}

function createControllerRuntime({
  state,
  createLayer,
  setSelectedLayer,
  textTools,
  loadImage,
}) {
  function listTemplates() {
    return readTemplateListFromStorage();
  }

  function getTemplateById(templateId) {
    return (
      listTemplates().find((template) => template.id === templateId) || null
    );
  }

  async function saveCurrentTemplate() {
    const orderedLayers = [...(state.layers || [])].sort(
      (a, b) => (a.zOrder || 0) - (b.zOrder || 0),
    );
    if (!orderedLayers.length) {
      return {
        saved: false,
        reason: "no-layers",
      };
    }

    const saveOptions = await openTemplateSaveOptions({
      defaultName: createDefaultTemplateName(),
      layers: orderedLayers.map((layer) => ({
        id: String(layer.id),
        name: String(layer.name || `Layer ${layer.id}`),
        kind: layer.textMeta ? "text" : "image",
        locked: false,
      })),
    });
    if (!saveOptions) {
      return {
        saved: false,
        reason: "canceled",
      };
    }

    const nextTemplate = await createTemplateFromState({
      state,
      name: saveOptions.name,
      lockedLayerIds: saveOptions.lockedLayerIds,
      loadImage,
    });
    if (!nextTemplate) {
      return {
        saved: false,
        reason: "invalid-template",
      };
    }

    nextTemplate.thumb = await createTinyTemplateThumb({ state, loadImage });
    const templateBytes = estimateTemplateBytes(nextTemplate);
    if (templateBytes > TEMPLATE_MAX_BYTES) {
      return {
        saved: false,
        reason: "size-limit",
        sizeBytes: templateBytes,
        maxBytes: TEMPLATE_MAX_BYTES,
      };
    }

    const templates = listTemplates();
    templates.unshift(nextTemplate);
    const limited = templates.slice(0, 40);
    writeTemplateListToStorage(limited);
    return {
      saved: true,
      templateId: nextTemplate.id,
      templateName: nextTemplate.name,
    };
  }

  async function pickTemplate() {
    while (true) {
      const templates = listTemplates();
      const action = await openCustomTemplatePicker(
        templates.map((template) => ({
          id: template.id,
          name: template.name,
          createdAt: template.createdAt,
          layersCount: template.layers?.length || 0,
          thumb: template.thumb || null,
        })),
      );

      if (!action) return null;

      if (action.type === "select") {
        const picked = getTemplateById(action.id);
        if (!picked) continue;
        return {
          template: picked,
          openMode: "template",
        };
      }

      if (action.type === "edit-open") {
        const current = getTemplateById(action.id);
        if (!current) {
          continue;
        }
        return {
          template: current,
          openMode: "editor",
        };
      }

      if (action.type === "delete") {
        const shouldDelete = await openTemplateSaveConfirm({
          message: "Delete this template permanently?",
        });
        if (!shouldDelete) {
          continue;
        }

        const updated = templates.filter(
          (template) => template.id !== action.id,
        );
        writeTemplateListToStorage(updated);
        continue;
      }

      if (action.type === "export-json") {
        const current = getTemplateById(action.id);
        if (!current) {
          continue;
        }
        downloadTemplateJson(current);
        continue;
      }

      if (action.type === "import-json") {
        try {
          const parsed = JSON.parse(String(action.jsonText || ""));
          const importedTemplate = normalizeImportedTemplate(parsed);
          if (!importedTemplate) {
            window.alert("Invalid template JSON file.");
            continue;
          }

          if (
            templates.some((template) => template.id === importedTemplate.id)
          ) {
            importedTemplate.id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          }

          writeTemplateListToStorage(
            [importedTemplate, ...templates].slice(0, 40),
          );
        } catch {
          window.alert("Failed to import template JSON.");
        }
      }
    }
  }

  function applyTemplate(template) {
    if (!template?.layers?.length) {
      return null;
    }

    const oldToNewId = new Map();
    const orderedSnapshots = [...template.layers].sort(
      (a, b) => sanitizeNumber(a.zOrder, 0) - sanitizeNumber(b.zOrder, 0),
    );

    state.layers = [];

    for (const snapshot of orderedSnapshots) {
      const isText = Boolean(snapshot.textMeta);
      const imageFitMode = normalizeTemplateImageFitMode(snapshot.imageFitMode);
      const src =
        !isText && snapshot.locked && snapshot.src
          ? String(snapshot.src)
          : createTransparentLayerDataUrl(snapshot.width, snapshot.height);
      const layer = createLayer(src, snapshot.width, snapshot.height);

      layer.name = String(snapshot.name || layer.id);
      layer.x = sanitizeNumber(snapshot.x, 0);
      layer.y = sanitizeNumber(snapshot.y, 0);
      layer.width = sanitizeSize(snapshot.width, layer.width);
      layer.height = sanitizeSize(snapshot.height, layer.height);
      layer.rotation = sanitizeNumber(snapshot.rotation, 0);
      layer.zOrder = sanitizeNumber(snapshot.zOrder, layer.zOrder);
      layer.cropBackgroundColor = String(
        snapshot.cropBackgroundColor || "#ffffff",
      );
      layer.cropBackgroundMode = String(snapshot.cropBackgroundMode || "solid");
      layer.cornerRadius = cloneValue(snapshot.cornerRadius) || {
        lt: 0,
        rt: 0,
        rb: 0,
        lb: 0,
      };
      layer.shadowStyle = cloneValue(snapshot.shadowStyle) || layer.shadowStyle;
      if (snapshot.appliedBorder) {
        layer.appliedBorder = cloneValue(snapshot.appliedBorder);
      }
      if (snapshot.filters) {
        layer.filters = cloneValue(snapshot.filters);
      }
      if (!isText) {
        layer.templateImageFitMode = imageFitMode;
      }

      if (isText) {
        layer.textMeta = cloneValue(snapshot.textMeta);
        if (textTools?.applyTextMetaToLayer) {
          textTools.applyTextMetaToLayer(layer, layer.textMeta, {
            commit: false,
          });
          layer.x = sanitizeNumber(snapshot.x, 0);
          layer.y = sanitizeNumber(snapshot.y, 0);
          layer.rotation = sanitizeNumber(snapshot.rotation, 0);
        }
      }

      state.layers.push(layer);
      oldToNewId.set(String(snapshot.id), layer.id);
    }

    for (let index = 0; index < orderedSnapshots.length; index += 1) {
      const snapshot = orderedSnapshots[index];
      const nextLayer = state.layers[index];
      if (!nextLayer) continue;
      const mappedParentId = snapshot.parentId
        ? oldToNewId.get(String(snapshot.parentId)) || null
        : null;
      nextLayer.parentId = mappedParentId;
    }

    const mappedSelectedId = template.selectedLayerId
      ? oldToNewId.get(String(template.selectedLayerId)) || null
      : null;
    setSelectedLayer(mappedSelectedId || state.layers[0]?.id || null);

    if (template.cropSelection?.layerId) {
      const mappedCropLayerId = oldToNewId.get(
        String(template.cropSelection.layerId),
      );
      if (mappedCropLayerId) {
        state.cropSelection = {
          layerId: mappedCropLayerId,
          x: sanitizeNumber(template.cropSelection.x, 0),
          y: sanitizeNumber(template.cropSelection.y, 0),
          width: sanitizeSize(template.cropSelection.width, 1),
          height: sanitizeSize(template.cropSelection.height, 1),
        };
      } else {
        state.cropSelection = null;
      }
    } else {
      state.cropSelection = null;
    }

    state.cropAspectRatio =
      Number.isFinite(Number(template.cropAspectRatio)) &&
      Number(template.cropAspectRatio) > 0
        ? Number(template.cropAspectRatio)
        : null;
    state.mode = "drag-select";

    const bindings = orderedSnapshots.map((snapshot, index) => ({
      layerId: state.layers[index]?.id,
      name: String(snapshot.name || `Layer ${index + 1}`),
      kind: snapshot.textMeta ? "text" : "image",
      locked: Boolean(snapshot.locked),
      fitMode: snapshot.textMeta
        ? undefined
        : normalizeTemplateImageFitMode(snapshot.imageFitMode),
      parentId: snapshot.parentId
        ? oldToNewId.get(String(snapshot.parentId)) || null
        : null,
    }));

    return {
      templateId: template.id,
      templateName: template.name,
      bindings,
    };
  }

  async function applyImageFileToLayer(layerId, file, options = {}) {
    if (!layerId || !file) return false;
    const layer = state.layers.find((item) => item.id === layerId);
    if (!layer) return false;

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });

    const fitMode = normalizeTemplateImageFitMode(
      options.fitMode || layer.templateImageFitMode,
    );
    layer.templateImageFitMode = fitMode;

    layer.src = await renderSourceToLayerSizedDataUrl(
      dataUrl,
      layer.width,
      layer.height,
      loadImage,
      fitMode,
    );
    return true;
  }

  function applyTextContentToLayer(layerId, content) {
    const layer = state.layers.find((item) => item.id === layerId);
    if (!layer || !layer.textMeta) return false;

    const nextMeta = {
      ...layer.textMeta,
      content: String(content || "Text"),
    };

    if (textTools?.applyTextMetaToLayer) {
      textTools.applyTextMetaToLayer(layer, nextMeta, {
        commit: false,
      });
      return true;
    }

    layer.textMeta = nextMeta;
    return true;
  }

  return {
    saveCurrentTemplate,
    pickTemplate,
    getTemplateById,
    applyTemplate,
    applyImageFileToLayer,
    applyTextContentToLayer,
  };
}

/**
 * Class-backed custom template feature facade.
 */
class CustomTemplateController {
  /**
   * @param {Object} deps - Runtime dependencies.
   */
  constructor(deps) {
    this.impl = createControllerRuntime(deps);
  }

  /**
   * @return {Promise<{saved:boolean,reason?:string,sizeBytes?:number,maxBytes?:number,templateId?:string,templateName?:string}>}
   */
  async saveCurrentTemplate() {
    return this.impl.saveCurrentTemplate();
  }

  /**
   * @return {Promise<any|null>}
   */
  async pickTemplate() {
    return this.impl.pickTemplate();
  }

  /**
   * @param {string} templateId
   * @return {any|null}
   */
  getTemplateById(templateId) {
    return this.impl.getTemplateById(templateId);
  }

  /**
   * @param {any} template
   * @return {{templateId:string,templateName:string,bindings:Array<{layerId:string,name:string,kind:string,locked:boolean,parentId:string|null}>}|null}
   */
  applyTemplate(template) {
    return this.impl.applyTemplate(template);
  }

  /**
   * @param {string} layerId
   * @param {File} file
   * @param {{fitMode?:"stretch"|"contain"|"cover"}} [options]
   * @return {Promise<boolean>}
   */
  async applyImageFileToLayer(layerId, file, options) {
    return this.impl.applyImageFileToLayer(layerId, file, options);
  }

  /**
   * @param {string} layerId
   * @param {string} content
   * @return {boolean}
   */
  applyTextContentToLayer(layerId, content) {
    return this.impl.applyTextContentToLayer(layerId, content);
  }
}

export function createCustomTemplateController(deps) {
  return new CustomTemplateController(deps);
}
