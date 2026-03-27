const IMGLY_IMPORT_URLS = [
  "https://esm.sh/@imgly/background-removal@1.7.0?bundle",
  "https://esm.sh/@imgly/background-removal@1.7.0",
  "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm",
];

const BASE_CONFIG = {
  output: {
    format: "image/png",
    quality: 1,
    type: "foreground",
  },
};

const MODEL_FALLBACK_ORDER = ["isnet_fp16", "isnet_quint8"];

function detectThreadingMode() {
  const hasCrossOriginIsolation =
    typeof window !== "undefined" && window.crossOriginIsolated === true;
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  return hasCrossOriginIsolation && hasSharedArrayBuffer ? "multi" : "single";
}

function getOrderedModelsForThreading(mode) {
  if (mode === "multi") {
    return ["isnet_fp16", "isnet_quint8"];
  }

  return ["isnet_quint8", "isnet_fp16"];
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to decode source image."));
    img.src = src;
  });
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to encode source image as PNG."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function normalizeSourceForModel(source) {
  if (typeof source === "string") {
    const img = await loadImageElement(source);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, img.naturalWidth || img.width || 1);
    canvas.height = Math.max(1, img.naturalHeight || img.height || 1);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context is not available.");
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvasToPngBlob(canvas);
  }

  if (source instanceof Blob && source.type === "image/avif") {
    const tempUrl = URL.createObjectURL(source);
    try {
      const img = await loadImageElement(tempUrl);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, img.naturalWidth || img.width || 1);
      canvas.height = Math.max(1, img.naturalHeight || img.height || 1);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas context is not available.");
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return await canvasToPngBlob(canvas);
    } finally {
      URL.revokeObjectURL(tempUrl);
    }
  }

  return source;
}

function createBackgroundRemovalControllerLegacy() {
  let removeBackgroundFn = null;
  let preloadFn = null;
  let loadingPromise = null;
  let threadingMode = null;
  let preferredModel = null;
  const preloadedModels = new Set();

  function resolveFunctions(module) {
    const removeCandidate =
      module?.removeBackground ||
      module?.imglyRemoveBackground ||
      module?.default?.removeBackground ||
      module?.default;

    const preloadCandidate =
      module?.preload || module?.default?.preload || null;

    if (typeof removeCandidate !== "function") {
      throw new Error("removeBackground export is not a function");
    }

    return {
      removeCandidate,
      preloadCandidate:
        typeof preloadCandidate === "function" ? preloadCandidate : null,
    };
  }

  async function loadRemoveBackground() {
    if (removeBackgroundFn) {
      return removeBackgroundFn;
    }

    if (!loadingPromise) {
      loadingPromise = (async () => {
        const errors = [];

        for (const url of IMGLY_IMPORT_URLS) {
          try {
            const module = await import(url);
            const { removeCandidate, preloadCandidate } =
              resolveFunctions(module);
            removeBackgroundFn = removeCandidate;
            preloadFn = preloadCandidate;
            return removeBackgroundFn;
          } catch (error) {
            errors.push(`${url}: ${error?.message || String(error)}`);
          }
        }

        throw new Error(
          `Unable to load IMG.LY background removal module. ${errors.join(" | ")}`,
        );
      })().catch((error) => {
        loadingPromise = null;
        throw error;
      });
    }

    return loadingPromise;
  }

  async function preloadModelIfSupported(model) {
    if (!preloadFn || preloadedModels.has(model)) {
      return;
    }

    await preloadFn({
      ...BASE_CONFIG,
      model,
    });

    preloadedModels.add(model);
  }

  async function removeBackground(source) {
    const removeBackgroundImpl = await loadRemoveBackground();
    const normalizedSource = await normalizeSourceForModel(source);

    if (!threadingMode) {
      threadingMode = detectThreadingMode();
    }

    const initialCandidates = preferredModel
      ? [preferredModel]
      : getOrderedModelsForThreading(threadingMode);
    const candidateModels = [
      ...new Set([...initialCandidates, ...MODEL_FALLBACK_ORDER]),
    ];

    let lastError = null;
    for (const model of candidateModels) {
      try {
        await preloadModelIfSupported(model);

        const outputBlob = await removeBackgroundImpl(normalizedSource, {
          ...BASE_CONFIG,
          model,
        });

        if (!(outputBlob instanceof Blob)) {
          throw new Error(`Model ${model} returned a non-blob result.`);
        }

        preferredModel = model;

        return outputBlob;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `All models failed (${candidateModels.join(" -> ")}) [threading:${threadingMode}]: ${lastError?.message || String(lastError)}`,
    );
  }

  return {
    removeBackground,
  };
}

/**
 * Class-backed background removal controller facade.
 */
class BackgroundRemovalController {
  constructor() {
    this.impl = createBackgroundRemovalControllerLegacy();
  }

  /**
   * @param {string|Blob} source
   * @return {Promise<Blob>}
   */
  async removeBackground(source) {
    return this.impl.removeBackground(source);
  }
}

export function createBackgroundRemovalController() {
  return new BackgroundRemovalController();
}
