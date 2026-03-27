const TEMPLATE_COLOR_PRESETS = [
  "#FFFFFF",
  "#000000",
  "#EF4444",
  "#F59E0B",
  "#FDE047",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
];

const PRESET_IMAGES = [
  {
    label: "Street Portrait",
    src: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80",
    width: 1200,
    height: 800,
  },
  {
    label: "City Geometry",
    src: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80",
    width: 1200,
    height: 800,
  },
  {
    label: "Mountain Day",
    src: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    width: 1200,
    height: 800,
  },
  {
    label: "Palm Coast",
    src: "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1200&q=80",
    width: 1200,
    height: 800,
  },
  {
    label: "Desert Form",
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    width: 1200,
    height: 800,
  },
  {
    label: "Neon Rain",
    src: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80",
    width: 1200,
    height: 800,
  },
];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function getLayerSizeForImage(image, maxSize = 420) {
  const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
  if (ratio >= 1) {
    return {
      width: maxSize,
      height: Math.max(1, Math.round(maxSize / ratio)),
    };
  }

  return {
    width: Math.max(1, Math.round(maxSize * ratio)),
    height: maxSize,
  };
}

function createTemplateDataUrl(template) {
  const width = Math.max(32, Math.round(Number(template.width) || 1200));
  const height = Math.max(32, Math.round(Number(template.height) || 800));
  const opacityValue = Number(template.opacity);
  const alpha = Number.isFinite(opacityValue)
    ? Math.max(0, Math.min(100, opacityValue)) / 100
    : 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  if (!template.transparent) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = template.color || "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  return canvas.toDataURL("image/png");
}

function hasImageFiles(dataTransfer) {
  return [...(dataTransfer?.items || [])].some(
    (item) =>
      item.kind === "file" && String(item.type || "").startsWith("image/"),
  );
}

function createAddLayerFlowControllerLegacy({
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
}) {
  function getPresetTemplateSize() {
    const first = PRESET_IMAGES[0];
    return {
      width: Math.max(32, Math.round(Number(first?.width) || 1200)),
      height: Math.max(32, Math.round(Number(first?.height) || 800)),
    };
  }

  function getLayerInsertOrigin(offsetIndex = 0) {
    const offset = 18 * Math.max(0, offsetIndex);
    const selected = getLayerById(state.selectedLayerId);
    if (selected) {
      return {
        x: selected.x + offset,
        y: selected.y + offset,
      };
    }

    const topLayer = getLayersByZOrderDesc()[0];
    if (topLayer) {
      return {
        x: topLayer.x + offset,
        y: topLayer.y + offset,
      };
    }

    return {
      x: 120,
      y: 80,
    };
  }

  function pushLayer(layer, offsetIndex = 0) {
    const origin = getLayerInsertOrigin(offsetIndex);
    layer.x = origin.x;
    layer.y = origin.y;
    state.layers.push(layer);
    syncLayerParentingForLayer(layer.id);
  }

  async function addLayerFromSrc(src, { offsetIndex = 0 } = {}) {
    const image = await loadImage(src);
    const nextSize = getLayerSizeForImage(image);
    const layer = createLayer(src, nextSize.width, nextSize.height);
    pushLayer(layer, offsetIndex);
    return layer;
  }

  async function addTemplateLayer(template) {
    const src = createTemplateDataUrl(template);
    const layer = await addLayerFromSrc(src);
    setSelectedLayer(layer.id);
    refresh();
    commitHistory();
  }

  async function addPresetLayer(src) {
    const layer = await addLayerFromSrc(src);
    setSelectedLayer(layer.id);
    refresh();
    commitHistory();
  }

  async function addImportedLayers(files) {
    const imageFiles = [...(files || [])].filter((file) =>
      String(file?.type || "").startsWith("image/"),
    );
    const layers = [];

    for (let i = 0; i < imageFiles.length; i += 1) {
      const src = await readFileAsDataUrl(imageFiles[i]);
      const layer = await addLayerFromSrc(src, { offsetIndex: i });
      layers.push(layer);
    }

    if (!layers.length) return;

    setSelectedLayer(layers[layers.length - 1].id);
    refresh();
    commitHistory();
  }

  async function openFlow({ startup = false } = {}) {
    const result = await openAddLayerPopup({
      presetImages: PRESET_IMAGES,
      startup,
      templateDefaults: getPresetTemplateSize(),
      templateColorPresets: TEMPLATE_COLOR_PRESETS,
    });

    if (!result) return;

    if (result.type === "template") {
      await addTemplateLayer(result.template);
      return;
    }

    if (result.type === "preset") {
      await addPresetLayer(result.src);
      return;
    }

    if (result.type === "import-files") {
      await addImportedLayers(result.files || []);
    }
  }

  function attachDirectDropImport(element) {
    if (!element) return;

    element.addEventListener("dragover", (event) => {
      if (!hasImageFiles(event.dataTransfer)) return;
      event.preventDefault();
    });

    element.addEventListener("drop", (event) => {
      if (!hasImageFiles(event.dataTransfer)) return;
      event.preventDefault();
      void addImportedLayers(event.dataTransfer?.files || []);
    });
  }

  return {
    openFlow,
    attachDirectDropImport,
  };
}

/**
 * Class-backed add-layer flow controller facade.
 */
class AddLayerFlowController {
  /**
   * @param {Object} deps
   */
  constructor(deps) {
    this.impl = createAddLayerFlowControllerLegacy(deps);
  }

  /**
   * @param {{startup?: boolean}} options
   * @return {Promise<void>}
   */
  async openFlow(options = {}) {
    await this.impl.openFlow(options);
  }

  /**
   * @param {HTMLElement} element
   * @return {void}
   */
  attachDirectDropImport(element) {
    this.impl.attachDirectDropImport(element);
  }
}

export function createAddLayerFlowController(deps) {
  return new AddLayerFlowController(deps);
}
