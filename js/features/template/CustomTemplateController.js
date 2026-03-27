import {
  openCustomTemplatePicker,
  openTemplateSaveConfirm,
} from "./CustomTemplatePopup.js";

const STORAGE_KEY = "img-editor.custom-templates.v1";

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

function toLayerSnapshot(layer) {
  return {
    id: String(layer.id),
    name: String(layer.name || ""),
    parentId: layer.parentId ? String(layer.parentId) : null,
    type: layer.textMeta ? "text" : "image",
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
    shadowStyle: cloneValue(layer.shadowStyle) || {
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
    filters: cloneValue(layer.filters) || null,
    textMeta: layer.textMeta ? cloneValue(layer.textMeta) : null,
  };
}

function createTemplateFromState({ state }) {
  const now = Date.now();
  const layers = [...(state.layers || [])]
    .sort((a, b) => (a.zOrder || 0) - (b.zOrder || 0))
    .map((layer) => toLayerSnapshot(layer));

  if (!layers.length) {
    return null;
  }

  const selectedId = state.selectedLayerId ? String(state.selectedLayerId) : null;
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

  const stamp = new Date(now);
  const pad = (value) => String(value).padStart(2, "0");
  const name = `Template ${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;

  return {
    id: `tpl-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
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
  };
}

function createControllerRuntime({ state, createLayer, setSelectedLayer, textTools }) {
  function listTemplates() {
    return readTemplateListFromStorage();
  }

  function getTemplateById(templateId) {
    return listTemplates().find((template) => template.id === templateId) || null;
  }

  async function saveCurrentTemplate() {
    const shouldSave = await openTemplateSaveConfirm();
    if (!shouldSave) {
      return false;
    }

    const nextTemplate = createTemplateFromState({ state });
    if (!nextTemplate) {
      return false;
    }

    const templates = listTemplates();
    templates.unshift(nextTemplate);
    const limited = templates.slice(0, 40);
    writeTemplateListToStorage(limited);
    return true;
  }

  async function pickTemplate() {
    const templates = listTemplates();
    const pickedId = await openCustomTemplatePicker(
      templates.map((template) => ({
        id: template.id,
        name: template.name,
        createdAt: template.createdAt,
        layersCount: template.layers?.length || 0,
      })),
    );

    if (!pickedId) return null;
    return getTemplateById(pickedId);
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
      const src = createTransparentLayerDataUrl(snapshot.width, snapshot.height);
      const layer = createLayer(src, snapshot.width, snapshot.height);

      layer.name = String(snapshot.name || layer.id);
      layer.x = sanitizeNumber(snapshot.x, 0);
      layer.y = sanitizeNumber(snapshot.y, 0);
      layer.width = sanitizeSize(snapshot.width, layer.width);
      layer.height = sanitizeSize(snapshot.height, layer.height);
      layer.rotation = sanitizeNumber(snapshot.rotation, 0);
      layer.zOrder = sanitizeNumber(snapshot.zOrder, layer.zOrder);
      layer.cropBackgroundColor = String(snapshot.cropBackgroundColor || "#ffffff");
      layer.cropBackgroundMode = String(snapshot.cropBackgroundMode || "solid");
      layer.cornerRadius = cloneValue(snapshot.cornerRadius) || {
        lt: 0,
        rt: 0,
        rb: 0,
        lb: 0,
      };
      layer.shadowStyle = cloneValue(snapshot.shadowStyle) || layer.shadowStyle;
      if (snapshot.filters) {
        layer.filters = cloneValue(snapshot.filters);
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
      const mappedCropLayerId = oldToNewId.get(String(template.cropSelection.layerId));
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
      parentId: snapshot.parentId ? oldToNewId.get(String(snapshot.parentId)) || null : null,
    }));

    return {
      templateId: template.id,
      templateName: template.name,
      bindings,
    };
  }

  async function applyImageFileToLayer(layerId, file) {
    if (!layerId || !file) return false;
    const layer = state.layers.find((item) => item.id === layerId);
    if (!layer) return false;

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });

    layer.src = dataUrl;
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
   * @return {Promise<boolean>}
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
   * @param {any} template
   * @return {{templateId:string,templateName:string,bindings:Array<{layerId:string,name:string,kind:string,parentId:string|null}>}|null}
   */
  applyTemplate(template) {
    return this.impl.applyTemplate(template);
  }

  /**
   * @param {string} layerId
   * @param {File} file
   * @return {Promise<boolean>}
   */
  async applyImageFileToLayer(layerId, file) {
    return this.impl.applyImageFileToLayer(layerId, file);
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
