import {
  BUTTON_ZOOM_STEP,
  FILTER_PRESETS,
  KEYBOARD_ZOOM_STEP,
  MIN_LAYER_SIZE,
  PRESET_COLORS,
  TOOLBAR_HINTS,
  WHEEL_ZOOM_STEP,
} from "./constants/editor-constants.js";
import { createAddLayerFlowController } from "./features/add-layer/AddLayerFlowController.js";
import { openAddLayerPopup } from "./features/add-layer/AddLayerPopup.js";
import { createBackgroundRemovalController } from "./features/background-removal/BackgroundRemovalController.js";
import { attachCropSelection } from "./features/crop/CropSelectionController.js";
import { openExportPopup } from "./features/export/ExportPopup.js";
import { createHistoryManager } from "./features/history/HistoryManager.js";
import { setupKeyboardShortcuts } from "./features/keyboard/KeyboardShortcuts.js";
import { attachLayersPanelDragAndDrop } from "./features/layers-panel/LayersPanelDragDrop.js";
import { createRotateController } from "./features/rotate/RotateController.js";
import { attachDragSelection } from "./features/select/DragSelectionController.js";
import { LayerBorderController } from "./features/select/LayerBorderController.js";
import { createShadowTools } from "./features/shadow/ShadowTools.js";
import { createCustomTemplateController } from "./features/template/CustomTemplateController.js";
import { showTemplateToast } from "./features/template/CustomTemplatePopup.js";
import { createTextTools } from "./features/text/TextTools.js";
import { createEditorViewportController } from "./features/viewport/EditorViewportController.js";
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
import {
  getRotatedBoundingRect,
  mapPointToLayerLocal,
} from "./rotation-geometry.js";
import { state } from "./state.js";
import {
  applySharpenToCanvas as applySharpenToCanvasUtil,
  bakeObjectStrokeIntoCanvas as bakeObjectStrokeIntoCanvasUtil,
  buildInsetShadowCanvas as buildInsetShadowCanvasUtil,
  buildObjectStrokeFilterChain as buildObjectStrokeFilterChainUtil,
  buildUpscaleSourceDrawable as buildUpscaleSourceDrawableUtil,
  canvasToBlob as canvasToBlobUtil,
  downloadBlob as downloadBlobUtil,
  encodeByQualityPreset as encodeByQualityPresetUtil,
  encodeByTargetSize as encodeByTargetSizeUtil,
  getBoundingRectForLayers as getBoundingRectForLayersUtil,
  getFormatInfo as getFormatInfoUtil,
  getRectFromLayer as getRectFromLayerUtil,
  intersectRect as intersectRectUtil,
  loadImage as loadImageUtil,
  normalizeUpscaleOutputToCanvas as normalizeUpscaleOutputToCanvasUtil,
  pointInRect as pointInRectUtil,
  quantizeCanvasColors as quantizeCanvasColorsUtil,
  renderCompositeLayersToCanvas as renderCompositeLayersToCanvasUtil,
  renderFilteredLayerToCanvas as renderFilteredLayerToCanvasUtil,
  renderLayerRegionToCanvas as renderLayerRegionToCanvasUtil,
  resizeCanvasWithQuality as resizeCanvasWithQualityUtil,
  rgbToHex as rgbToHexUtil,
  upscaleImageAiFirst as upscaleImageAiFirstUtil,
  upscaleImageEnhanced as upscaleImageEnhancedUtil,
} from "./utils/image-canvas.js";

// design log show color text "Welcome to Image Editor!" in console with colors from PRESET_COLORS
console.log(
  "\t\t%cWelcome to Image Editor! v1.0.1\t\t",
  "color: #007acc; font-weight: bold; font-size: 24px;",
);

/**
 * @typedef {Object} EditorLifecycle
 * @property {() => void} start
 */

/**
 * Main runtime bootstrap for the image editor application.
 * @implements {EditorLifecycle}
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
    const customTemplateAction = document.getElementById(
      "customTemplateAction",
    );
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
    const sidePanelResizeHandle = document.getElementById(
      "sidePanelResizeHandle",
    );
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
    let isEyedropperActive = false;
    let eyedropperPreview = null;
    const eyedropperImageCache = new Map();
    let layerBorderController = null;
    let historyManager = null;
    const backgroundRemovalController = createBackgroundRemovalController();
    let addLayerFlowController = null;
    let customTemplateController = null;
    const templateSession = {
      active: false,
      templateId: null,
      templateName: "",
      bindings: [],
      batchImageLayerId: null,
      batchImageUploads: [],
    };

    const viewportController = createEditorViewportController({
      state,
      stage,
      zoomOut,
      zoomIn,
      zoomReset,
      buttonZoomStep: BUTTON_ZOOM_STEP,
      wheelZoomStep: WHEEL_ZOOM_STEP,
      getContentBounds: () => getBoundingRectForLayers(state.layers),
      onViewportUpdated: () => {
        refresh();
      },
    });

    function fitEditorToContent() {
      viewportController.fitToContent();
    }

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
      return loadImageUtil(src);
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
      return getRectFromLayerUtil(layer);
    }

    function getBoundingRectForLayers(layers) {
      return getBoundingRectForLayersUtil(layers);
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
      return intersectRectUtil(a, b);
    }

    function pointInRect(point, rect) {
      return pointInRectUtil(point, rect);
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
      return rgbToHexUtil(r, g, b);
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
          Math.floor(
            (localY / Math.max(1, hitLayer.height)) * img.naturalHeight,
          ),
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
      {
        fillBackground = true,
        clipRect = null,
        backgroundColor = "#ffffff",
      } = {},
    ) {
      return renderLayerRegionToCanvasUtil(selected, regionRect, {
        fillBackground,
        clipRect,
        backgroundColor,
      });
    }

    async function renderFilteredLayerToCanvas(layer) {
      return renderFilteredLayerToCanvasUtil(layer, {
        ensureLayerDefaults,
        buildLayerFilterString,
        getLayerInsetShadow,
      });
    }

    function buildInsetShadowCanvas(
      image,
      width,
      height,
      filterString,
      insetShadow,
    ) {
      return buildInsetShadowCanvasUtil(
        image,
        width,
        height,
        filterString,
        insetShadow,
      );
    }

    function buildObjectStrokeFilterChain(strokeSize, strokeColor) {
      return buildObjectStrokeFilterChainUtil(strokeSize, strokeColor);
    }

    function bakeObjectStrokeIntoCanvas(sourceCanvas, strokeSize, strokeColor) {
      const filterChain = buildObjectStrokeFilterChain(strokeSize, strokeColor);
      if (!filterChain) return sourceCanvas;
      return bakeObjectStrokeIntoCanvasUtil(
        sourceCanvas,
        strokeSize,
        strokeColor,
      );
    }

    async function buildUpscaleSourceDrawable(layer) {
      return buildUpscaleSourceDrawableUtil(layer, getLayerShadowStyle);
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
      return renderCompositeLayersToCanvasUtil(baseLayer, layers, regionRect, {
        fillBackground,
        buildLayerFilterString,
        getLayerShadowStyle,
        getLayerInsetShadow,
        getLayerCornerRadius,
        getAncestorVisibleRectForRegion,
      });
    }

    function downloadCanvas(canvas, filenameBase) {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${filenameBase}.png`;
      link.click();
    }

    function canvasToBlob(canvas, mimeType, quality) {
      return canvasToBlobUtil(canvas, mimeType, quality);
    }

    function downloadBlob(blob, fileName) {
      return downloadBlobUtil(blob, fileName);
    }

    function resizeCanvasWithQuality(sourceCanvas, width, height) {
      return resizeCanvasWithQualityUtil(sourceCanvas, width, height);
    }

    function quantizeCanvasColors(sourceCanvas, levels) {
      return quantizeCanvasColorsUtil(sourceCanvas, levels);
    }

    function applySharpenToCanvas(sourceCanvas, amount = 0.28) {
      return applySharpenToCanvasUtil(sourceCanvas, amount);
    }

    function upscaleImageEnhanced(image, targetWidth, targetHeight) {
      return upscaleImageEnhancedUtil(image, targetWidth, targetHeight);
    }

    async function normalizeUpscaleOutputToCanvas(
      output,
      targetWidth,
      targetHeight,
    ) {
      return normalizeUpscaleOutputToCanvasUtil(
        output,
        targetWidth,
        targetHeight,
      );
    }

    async function upscaleImageAiFirst(image, targetWidth, targetHeight) {
      return upscaleImageAiFirstUtil(image, targetWidth, targetHeight);
    }

    function getFormatInfo(format) {
      return getFormatInfoUtil(format);
    }

    async function encodeByQualityPreset(canvas, preset, format) {
      return encodeByQualityPresetUtil(canvas, preset, format);
    }

    async function encodeByTargetSize(canvas, targetBytes, format) {
      return encodeByTargetSizeUtil(canvas, targetBytes, format);
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
        backgroundBlurAmount:
          Number(layer?.filters?.backgroundBlurAmount) || 14,
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
        window.alert(
          `Filter apply failed: ${error?.message || "Unknown error"}`,
        );
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

        state.layers = state.layers.filter(
          (layer) => !removedIds.has(layer.id),
        );

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

        if (
          state.cropSelection &&
          removedIds.has(state.cropSelection.layerId)
        ) {
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
          Math.round(
            (Number(selected.filters.backgroundBlurAmount) || 14) * 5,
          ) / 5,
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

        const backgroundLayer = createLayer(
          originalSrc,
          layer.width,
          layer.height,
        );
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

      const buildExportSnapshot = () => {
        const selectedLayer = getLayerById(state.selectedLayerId);
        const allLayers = [...state.layers];
        if (!selectedLayer && !allLayers.length) {
          return null;
        }

        const exportLayers = selectedLayer
          ? getExportLayersForSelection(selectedLayer)
          : getLayersByZOrderDesc().reverse();
        if (!exportLayers.length) {
          return null;
        }

        const baseLayer = selectedLayer || exportLayers[0];
        const allBounds = getBoundingRectForLayers(exportLayers);
        if (!baseLayer || !allBounds) {
          return null;
        }

        const cropToExport =
          selectedLayer &&
          state.mode === "crop-select" &&
          state.cropSelection?.layerId === selectedLayer.id
            ? state.cropSelection
            : selectedLayer
              ? {
                  x: selectedLayer.x,
                  y: selectedLayer.y,
                  width: selectedLayer.width,
                  height: selectedLayer.height,
                }
              : allBounds;

        return {
          selectedLayer,
          exportLayers,
          baseLayer,
          cropToExport,
        };
      };

      const getTemplateBatchExportState = () => {
        if (!templateSession.active) return null;
        if (!templateSession.batchImageLayerId) return null;
        if ((templateSession.batchImageUploads || []).length < 2) return null;

        const editableImageBindings = templateSession.bindings.filter(
          (binding) => !binding.locked && binding.kind === "image",
        );
        if (editableImageBindings.length !== 1) return null;

        const binding = editableImageBindings[0];
        if (binding.layerId !== templateSession.batchImageLayerId) return null;

        const layer = getLayerById(binding.layerId);
        if (!layer) return null;

        return {
          layer,
          uploads: templateSession.batchImageUploads,
        };
      };

      const exportBatchTemplateImages = async (exportOptions) => {
        const batchState = getTemplateBatchExportState();
        if (!batchState) return false;

        const originalLayer = {
          src: batchState.layer.src,
        };

        try {
          for (let index = 0; index < batchState.uploads.length; index += 1) {
            const upload = batchState.uploads[index];
            batchState.layer.src = upload.src;

            const snapshot = buildExportSnapshot();
            if (!snapshot) continue;

            const { canvas } = await renderCompositeLayersToCanvas(
              snapshot.baseLayer,
              snapshot.exportLayers,
              snapshot.cropToExport,
              {
                fillBackground: false,
              },
            );

            const finalCanvas = resizeCanvasWithQuality(
              canvas,
              canvas.width,
              canvas.height,
            );

            const isTargetMode = exportOptions.mode === "target";
            const isLossyFormat = exportOptions.format !== "png";
            const exportResult =
              isTargetMode && isLossyFormat
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

            const sourceName = String(upload.name || `image-${index + 1}`)
              .replace(/\.[^.]+$/, "")
              .replace(/[^a-zA-Z0-9-_ ]+/g, "")
              .trim()
              .replace(/\s+/g, "-")
              .toLowerCase();

            downloadBlob(
              exportResult.blob,
              `${sourceName || `image-${index + 1}`}.${exportResult.extension}`,
            );
          }

          showTemplateToast(
            `Downloaded ${batchState.uploads.length} images from template batch`,
            {
              durationMs: 2400,
            },
          );
          return true;
        } finally {
          batchState.layer.src = originalLayer.src;
          refresh({ rerenderOptions: false, rerenderLayersPanel: false });
        }
      };

      const snapshot = buildExportSnapshot();
      if (!snapshot) return;

      isExporting = true;
      exportSelected.disabled = true;

      try {
        const { canvas } = await renderCompositeLayersToCanvas(
          snapshot.baseLayer,
          snapshot.exportLayers,
          snapshot.cropToExport,
          {
            fillBackground: false,
          },
        );

        const exportOptions = await openExportPopup({
          width: canvas.width,
          height: canvas.height,
        });

        if (!exportOptions) return;

        if (exportOptions.action === "save-template") {
          if (!customTemplateController) return;
          const saveResult =
            await customTemplateController.saveCurrentTemplate();
          if (saveResult?.saved) {
            showTemplateToast("Template saved successfully");
            return;
          }

          if (saveResult?.reason === "size-limit") {
            showTemplateToast("Template too large. Lock fewer image layers.", {
              durationMs: 2600,
            });
            return;
          }

          if (saveResult?.reason !== "canceled") {
            showTemplateToast("Template was not saved", {
              durationMs: 2100,
            });
          }
          return;
        }

        const didExportBatch = await exportBatchTemplateImages(exportOptions);
        if (didExportBatch) {
          return;
        }

        const finalCanvas = resizeCanvasWithQuality(
          canvas,
          exportOptions.width,
          exportOptions.height,
        );

        const isTargetMode = exportOptions.mode === "target";
        const isLossyFormat = exportOptions.format !== "png";

        const exportResult =
          isTargetMode && isLossyFormat
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
          snapshot.selectedLayer
            ? `selected-${snapshot.selectedLayer.id}.${exportResult.extension}`
            : `canvas-export.${exportResult.extension}`,
        );
      } catch (error) {
        console.error(error);
        window.alert("Export failed. Please try again.");
      } finally {
        isExporting = false;
        exportSelected.disabled = false;
      }
    }

    function setupZoomControls() {
      viewportController.setupZoomControls();
    }

    function setEditorMode(nextMode) {
      if (templateSession.active && nextMode !== "drag-select") {
        return;
      }

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

      const valueInput = document.createElement("input");
      valueInput.className = "filter-value-input";
      valueInput.type = "text";
      valueInput.inputMode = "decimal";
      valueInput.min = String(min);
      valueInput.max = String(max);
      valueInput.step = String(step);

      const displayValue = (nextValue) => {
        const formatted = String(formatValue(nextValue));
        valueInput.value = Number.isFinite(Number(formatted))
          ? formatted
          : String(nextValue);
        valueInput.title = suffix
          ? `${valueInput.value}${suffix}`
          : valueInput.value;
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

      valueInput.addEventListener("input", () => {
        const rawValue = String(valueInput.value || "").trim();
        if (
          !rawValue ||
          rawValue === "-" ||
          rawValue === "." ||
          rawValue === "-."
        ) {
          return;
        }

        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed)) return;
        const normalized = Math.min(max, Math.max(min, parsed));
        slider.value = String(normalized);
        onPreview(normalized);
      });
      valueInput.addEventListener("change", () => {
        syncFrom(valueInput.value, true);
      });
      valueInput.addEventListener("blur", () => {
        const rawValue = String(valueInput.value || "").trim();
        if (
          !rawValue ||
          rawValue === "-" ||
          rawValue === "." ||
          rawValue === "-."
        ) {
          displayValue(Number(slider.value));
          return;
        }

        syncFrom(rawValue, false);
      });

      displayValue(Number(slider.value));

      wrap.appendChild(slider);
      wrap.appendChild(valueInput);
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

    function setTemplateMode(active) {
      templateSession.active = Boolean(active);
      if (!templateSession.active) {
        templateSession.templateId = null;
        templateSession.templateName = "";
        templateSession.bindings = [];
        templateSession.batchImageLayerId = null;
        templateSession.batchImageUploads = [];
      }

      document.body.classList.toggle("template-mode", templateSession.active);
      if (templateSession.active) {
        state.mode = "drag-select";
      }
    }

    function renderTemplateModeOptions() {
      optionsPanel.innerHTML = "";

      const editableImageBindings = templateSession.bindings.filter(
        (binding) => !binding.locked && binding.kind === "image",
      );
      const singleEditableImageBinding =
        editableImageBindings.length === 1 ? editableImageBindings[0] : null;

      const title = document.createElement("div");
      title.className = "option-caption";
      title.textContent = templateSession.templateName
        ? `Template: ${templateSession.templateName}`
        : "Template Inputs";
      optionsPanel.appendChild(title);

      const note = document.createElement("p");
      note.className = "template-note";
      note.textContent =
        "Upload images and edit text for the template slots. Parent and child layers stay linked.";
      const noteRow = createOptionRow("", note);
      noteRow.classList.add("full");
      optionsPanel.appendChild(noteRow);

      appendOptionDivider();

      for (const binding of templateSession.bindings) {
        if (binding.locked) {
          continue;
        }

        const layer = getLayerById(binding.layerId);
        if (!layer) continue;

        const block = document.createElement("div");
        block.className = "template-input-block";

        const blockTitle = document.createElement("h4");
        blockTitle.className = "template-input-block-title";
        blockTitle.textContent = `${binding.name} (${binding.kind})`;
        block.appendChild(blockTitle);

        const focusBtn = document.createElement("button");
        focusBtn.type = "button";
        focusBtn.className = "button option-button";
        focusBtn.textContent = "Select Layer";
        focusBtn.addEventListener("click", () => {
          setSelectedLayer(layer.id);
          refresh({ rerenderOptions: false, rerenderLayersPanel: false });
        });
        block.appendChild(focusBtn);

        if (binding.kind === "image") {
          const allowBatchUpload =
            singleEditableImageBinding?.layerId === layer.id;
          const getResolvedFitMode = () => {
            const layerMode = String(
              layer.templateImageFitMode || "",
            ).toLowerCase();
            if (layerMode === "contain" || layerMode === "cover") {
              return layerMode;
            }
            const bindingMode = String(binding.fitMode || "").toLowerCase();
            if (bindingMode === "contain" || bindingMode === "cover") {
              return bindingMode;
            }
            return "stretch";
          };
          const clearTemplateBatchQueue = () => {
            templateSession.batchImageLayerId = null;
            templateSession.batchImageUploads = [];
          };

          const imageInput = document.createElement("input");
          imageInput.type = "file";
          imageInput.accept = "image/*";
          imageInput.multiple = allowBatchUpload;
          imageInput.hidden = true;

          const readImageFile = (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = async () => {
                const src = String(reader.result || "");
                try {
                  const image = await loadImage(src);
                  const fitMode = getResolvedFitMode();
                  const normalizedCanvas = document.createElement("canvas");
                  normalizedCanvas.width = Math.max(
                    MIN_LAYER_SIZE,
                    Math.round(layer.width),
                  );
                  normalizedCanvas.height = Math.max(
                    MIN_LAYER_SIZE,
                    Math.round(layer.height),
                  );
                  const normalizedCtx = normalizedCanvas.getContext("2d");
                  if (normalizedCtx) {
                    normalizedCtx.clearRect(
                      0,
                      0,
                      normalizedCanvas.width,
                      normalizedCanvas.height,
                    );
                    if (fitMode === "stretch") {
                      normalizedCtx.drawImage(
                        image,
                        0,
                        0,
                        normalizedCanvas.width,
                        normalizedCanvas.height,
                      );
                    } else {
                      const imageWidth = Math.max(
                        1,
                        image.naturalWidth || image.width || 1,
                      );
                      const imageHeight = Math.max(
                        1,
                        image.naturalHeight || image.height || 1,
                      );
                      const scale =
                        fitMode === "cover"
                          ? Math.max(
                              normalizedCanvas.width / imageWidth,
                              normalizedCanvas.height / imageHeight,
                            )
                          : Math.min(
                              normalizedCanvas.width / imageWidth,
                              normalizedCanvas.height / imageHeight,
                            );
                      const drawWidth = Math.max(
                        1,
                        Math.round(imageWidth * scale),
                      );
                      const drawHeight = Math.max(
                        1,
                        Math.round(imageHeight * scale),
                      );
                      const drawX = Math.round(
                        (normalizedCanvas.width - drawWidth) / 2,
                      );
                      const drawY = Math.round(
                        (normalizedCanvas.height - drawHeight) / 2,
                      );
                      normalizedCtx.drawImage(
                        image,
                        drawX,
                        drawY,
                        drawWidth,
                        drawHeight,
                      );
                    }
                  }
                  resolve({
                    name: file.name,
                    src: normalizedCanvas.toDataURL("image/png"),
                    width: Math.max(MIN_LAYER_SIZE, Math.round(layer.width)),
                    height: Math.max(MIN_LAYER_SIZE, Math.round(layer.height)),
                  });
                } catch {
                  resolve({
                    name: file.name,
                    src,
                    width: Math.max(MIN_LAYER_SIZE, layer.width),
                    height: Math.max(MIN_LAYER_SIZE, layer.height),
                  });
                }
              };
              reader.onerror = () =>
                reject(new Error("Failed to read image file"));
              reader.readAsDataURL(file);
            });

          const applyImageFiles = async (files) => {
            const imageFiles = files.filter((file) =>
              file.type.startsWith("image/"),
            );
            if (!imageFiles.length) return;

            if (!allowBatchUpload || imageFiles.length === 1) {
              clearTemplateBatchQueue();
              const file = imageFiles[0];
              if (!file || !customTemplateController) return;

              void customTemplateController
                .applyImageFileToLayer(layer.id, file, {
                  fitMode: getResolvedFitMode(),
                })
                .then((updated) => {
                  if (!updated) return;
                  refresh({
                    rerenderOptions: true,
                    rerenderLayersPanel: false,
                  });
                  commitHistory();
                })
                .catch((error) => {
                  console.error("Template image apply failed", error);
                });
              return;
            }

            const uploads = [];
            for (const file of imageFiles) {
              try {
                const upload = await readImageFile(file);
                uploads.push(upload);
              } catch {
                // Ignore invalid files.
              }
            }
            if (!uploads.length) return;

            templateSession.batchImageLayerId = layer.id;
            templateSession.batchImageUploads = uploads;

            layer.src = uploads[0].src;
            refresh({ rerenderOptions: true, rerenderLayersPanel: false });
            commitHistory();
            showTemplateToast(
              `${uploads.length} images added to template batch export`,
              { durationMs: 2200 },
            );
          };

          const fitSelect = document.createElement("select");
          fitSelect.className = "option-select";
          [
            ["stretch", "Stretch"],
            ["contain", "Contain"],
            ["cover", "Cover"],
          ].forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            fitSelect.appendChild(option);
          });
          fitSelect.value = getResolvedFitMode();
          fitSelect.addEventListener("change", () => {
            const nextMode = String(fitSelect.value || "stretch").toLowerCase();
            binding.fitMode = nextMode;
            layer.templateImageFitMode = nextMode;
            if (templateSession.batchImageLayerId === layer.id) {
              clearTemplateBatchQueue();
              showTemplateToast("Batch queue cleared after fit mode change", {
                durationMs: 1800,
              });
            }
          });

          block.appendChild(createOptionRow("Image Fit", fitSelect));

          imageInput.addEventListener("change", () => {
            const files = Array.from(imageInput.files || []);
            void applyImageFiles(files);
          });

          const dropZone = document.createElement("div");
          dropZone.className = "template-dropzone";
          dropZone.textContent = allowBatchUpload
            ? "Drop one or many images here, or click to upload"
            : "Drop image here or click to upload";
          dropZone.addEventListener("click", () => {
            imageInput.click();
          });
          dropZone.addEventListener("dragover", (event) => {
            event.preventDefault();
            dropZone.classList.add("drag-over");
          });
          dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("drag-over");
          });
          dropZone.addEventListener("drop", (event) => {
            event.preventDefault();
            dropZone.classList.remove("drag-over");
            const files = Array.from(event.dataTransfer?.files || []);
            if (!files.length) return;
            void applyImageFiles(files);
          });

          const imageRowValue = document.createElement("div");
          imageRowValue.className = "template-upload-control";
          imageRowValue.appendChild(imageInput);
          imageRowValue.appendChild(dropZone);

          const isBatchLayer =
            templateSession.batchImageLayerId === layer.id &&
            (templateSession.batchImageUploads || []).length > 1;
          if (allowBatchUpload && isBatchLayer) {
            const batchNote = document.createElement("p");
            batchNote.className = "template-note";
            batchNote.textContent = `${templateSession.batchImageUploads.length} images queued. Export downloads one output per image.`;
            imageRowValue.appendChild(batchNote);
          }

          block.appendChild(createOptionRow("Image", imageRowValue));
        }

        if (binding.kind === "text" && layer.textMeta) {
          const textInput = document.createElement("textarea");
          textInput.className = "option-textarea";
          textInput.rows = 3;
          textInput.value = String(layer.textMeta.content || "");
          textInput.placeholder = "Text content";
          textInput.addEventListener("input", () => {
            customTemplateController?.applyTextContentToLayer(
              layer.id,
              textInput.value,
            );
            refresh({ rerenderOptions: false, rerenderLayersPanel: false });
          });
          textInput.addEventListener("change", () => {
            customTemplateController?.applyTextContentToLayer(
              layer.id,
              textInput.value,
            );
            refresh({ rerenderOptions: false, rerenderLayersPanel: false });
            commitHistory();
          });
          block.appendChild(createOptionRow("Text", textInput));
        }

        const blockRow = createOptionRow("", block);
        blockRow.classList.add("full");
        optionsPanel.appendChild(blockRow);
      }

      appendOptionDivider();
      if (!templateSession.bindings.some((binding) => !binding.locked)) {
        const lockedInfo = document.createElement("p");
        lockedInfo.className = "template-note";
        lockedInfo.textContent =
          "All template layers are locked. No editable inputs for this template.";
        const lockedInfoRow = createOptionRow("", lockedInfo);
        lockedInfoRow.classList.add("full");
        optionsPanel.appendChild(lockedInfoRow);
        appendOptionDivider();
      }

      const exitButton = document.createElement("button");
      exitButton.type = "button";
      exitButton.className = "button option-button";
      exitButton.textContent = "Exit Template Mode";
      exitButton.addEventListener("click", () => {
        setTemplateMode(false);
        refresh();
      });
      const exitRow = createOptionRow("", exitButton);
      exitRow.classList.add("full");
      optionsPanel.appendChild(exitRow);
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
        return /^#[0-9A-Fa-f]{6}$/.test(prefixed)
          ? prefixed.toUpperCase()
          : null;
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
        const xDisplay = createNumberInput(
          Math.round(rotateBounds.x),
          () => {},
        );
        xDisplay.disabled = true;
        const yDisplay = createNumberInput(
          Math.round(rotateBounds.y),
          () => {},
        );
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
      optionsPanel.appendChild(
        createOptionRow("Amount", backgroundBlurControl),
      );

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

      const getFixedCropRatioValue = () => {
        if (!crop.width || !crop.height) return null;
        return crop.width / Math.max(1, crop.height);
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
        { value: "fixed", label: "Fixed (Current)" },
        { value: "1", label: "1:1" },
        { value: "0.75", label: "3:4" },
        { value: "1.3333333333", label: "4:3" },
        { value: "0.6666666667", label: "2:3" },
        { value: "1.5", label: "3:2" },
        { value: "0.5625", label: "9:16" },
        { value: "1.7777777778", label: "16:9" },
      ];
      const activeRatio = getActiveCropRatio();
      const presetRatioValues = ratioOptions
        .map((item) => item.value)
        .filter((value) => value !== "free" && value !== "fixed")
        .map((value) => Number(value));
      const matchedPreset = activeRatio
        ? presetRatioValues.find(
            (value) => Math.abs(value - activeRatio) < 0.000001,
          )
        : null;
      const ratioValue = !activeRatio
        ? "free"
        : matchedPreset
          ? String(matchedPreset)
          : "fixed";
      const ratioSelect = createSelectInput(
        ratioOptions,
        ratioValue,
        (value) => {
          if (value === "free") {
            state.cropAspectRatio = null;
          } else if (value === "fixed") {
            state.cropAspectRatio = getFixedCropRatioValue();
          } else {
            state.cropAspectRatio = Number(value);
          }
          applyRatioToCropKeepingTopLeft();
          refresh();
          commitHistory();
        },
      );
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
      if (templateSession.active) {
        renderTemplateModeOptions();
        return;
      }

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
        optionsTitle.textContent = templateSession.active
          ? "Options (Template)"
          : `Options (${modeLabel})`;
      }

      modeSelect.classList.toggle("active", state.mode === "drag-select");
      modeCrop.classList.toggle("active", state.mode === "crop-select");
      modeRotate.classList.toggle("active", state.mode === "rotate-select");
      modeFilter.classList.toggle("active", state.mode === "filter-adjust");
      modeShadow?.classList.toggle("active", state.mode === "shadow-adjust");
      const isTemplateMode = templateSession.active;
      modeCrop.disabled = isTemplateMode;
      modeRotate.disabled = isTemplateMode;
      modeFilter.disabled = isTemplateMode;
      if (modeShadow) {
        modeShadow.disabled = isTemplateMode;
      }

      duplicateAction.disabled = isTemplateMode || !hasSelection;
      const isAiBusy =
        isRemovingBackground || isApplyingBackgroundBlur || isUpscaling;
      removeBgAction.disabled = isTemplateMode || !hasSelection || isAiBusy;
      if (upscaleAction) {
        upscaleAction.disabled = isTemplateMode || !hasSelection || isAiBusy;
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
      deleteAction.disabled = isTemplateMode || !hasSelection;
      exportSelected.disabled = state.layers.length === 0;
      stage.classList.toggle("crop-mode", state.mode === "crop-select");
      stage.classList.toggle("rotate-mode", state.mode === "rotate-select");

      if (layersSection) {
        layersSection.style.display = isTemplateMode ? "none" : "";
      }
      if (sidePanelResizeHandle) {
        sidePanelResizeHandle.style.display = isTemplateMode ? "none" : "";
      }
    }

    function setupToolbarHints() {
      const entries = [
        ["addAction", addAction],
        ["textAction", textAction],
        ["customTemplateAction", customTemplateAction],
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

      selectionBox.style.display =
        state.mode === "crop-select" ? "none" : "block";
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
        if (
          typeof previousSrc === "string" &&
          previousSrc.startsWith("blob:")
        ) {
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
            Number.isFinite(maxScaleFromPixels)
              ? maxScaleFromPixels
              : desiredScale,
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
        if (
          typeof previousSrc === "string" &&
          previousSrc.startsWith("blob:")
        ) {
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
        window.history.pushState(
          { editorGuard: true },
          "",
          window.location.href,
        );
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
      if (templateSession.active) return;
      setEditorMode("crop-select");
    });

    modeRotate.addEventListener("click", () => {
      if (templateSession.active) return;
      setEditorMode("rotate-select");
    });

    modeFilter.addEventListener("click", () => {
      if (templateSession.active) return;
      setEditorMode("filter-adjust");
    });

    modeShadow?.addEventListener("click", () => {
      if (templateSession.active) return;
      setEditorMode("shadow-adjust");
    });

    duplicateAction.addEventListener("click", () => {
      if (templateSession.active) return;
      duplicateSelectedLayer();
    });

    removeBgAction.addEventListener("click", () => {
      if (templateSession.active) return;
      void removeBackgroundFromSelectedLayer();
    });

    upscaleAction?.addEventListener("click", () => {
      if (templateSession.active) return;
      void upscaleSelectedLayer();
    });

    deleteAction.addEventListener("click", () => {
      if (templateSession.active) return;
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

    customTemplateAction?.addEventListener("click", () => {
      if (!customTemplateController) return;

      void customTemplateController
        .pickTemplate()
        .then((result) => {
          if (!result?.template) return;

          const template = result.template;
          const openMode = result.openMode || "template";

          const session = customTemplateController.applyTemplate(template);
          if (!session) {
            window.alert("Template could not be applied.");
            return;
          }

          templateSession.templateId = session.templateId;
          templateSession.templateName = session.templateName;
          templateSession.bindings = session.bindings.filter((binding) =>
            Boolean(binding.layerId),
          );
          templateSession.batchImageLayerId = null;
          templateSession.batchImageUploads = [];
          setTemplateMode(openMode === "template");
          refresh();
          commitHistory();
          showTemplateToast(
            openMode === "editor"
              ? "Template opened in editor mode"
              : "Template loaded successfully",
          );
        })
        .catch((error) => {
          console.error("Failed to open template", error);
          window.alert("Unable to open custom template.");
        });
    });

    function refresh({
      rerenderOptions = true,
      rerenderLayersPanel = true,
    } = {}) {
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
      onDuplicate: () => {
        if (templateSession.active) return;
        duplicateSelectedLayer();
      },
      onZoomIn: () => setEditorZoom(state.editorZoom + KEYBOARD_ZOOM_STEP),
      onZoomOut: () => setEditorZoom(state.editorZoom - KEYBOARD_ZOOM_STEP),
      onZoomReset: () => fitEditorToContent(),
      isEyedropperActive: () => isEyedropperActive,
      onDisableEyedropper: () => {
        setEyedropperActive(false);
        refresh({ rerenderOptions: true, rerenderLayersPanel: false });
      },
      onDelete: () => {
        if (templateSession.active) return;
        deleteSelectedLayer();
      },
      onMoveMode: () => setEditorMode("drag-select"),
      onCropMode: () => {
        if (templateSession.active) return;
        setEditorMode("crop-select");
      },
      onRotateMode: () => {
        if (templateSession.active) return;
        setEditorMode("rotate-select");
      },
      onFilterMode: () => {
        if (templateSession.active) return;
        setEditorMode("filter-adjust");
      },
      onShadowMode: () => {
        if (templateSession.active) return;
        setEditorMode("shadow-adjust");
      },
      isCropMode: () => state.mode === "crop-select",
      isRotateMode: () => state.mode === "rotate-select",
      isFilterMode: () => state.mode === "filter-adjust",
      isShadowMode: () => state.mode === "shadow-adjust",
      onApplyCrop: () => void applyCropSelection(),
      onApplyRotate: () => void applyRotationSelection(),
      onApplyFilter: () => void applyFilterSelection(),
      onApplyShadow: () =>
        shadowTools.applyShadowSelection(state.selectedLayerId),
      onExport: () => void exportSelectedImage(),
      onNudge: nudgeSelectedLayer,
    });
    blockBrowserPinchZoom();
    setupEyedropperSampling();
    setupSelectionContextMenu();
    setupClearSelectionOnOutsideClick();
    setupSidePanelResize();
    setupBackNavigationBlock();
    setupCloseTabWarning();

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
      onSelectCustomTemplateFromStartup: async (templateId) => {
        if (!customTemplateController || !templateId) {
          return;
        }

        const template = customTemplateController.getTemplateById(templateId);
        if (!template) {
          return;
        }

        const session = customTemplateController.applyTemplate(template);
        if (!session) {
          return;
        }

        templateSession.templateId = session.templateId;
        templateSession.templateName = session.templateName;
        templateSession.bindings = session.bindings.filter((binding) =>
          Boolean(binding.layerId),
        );
        templateSession.batchImageLayerId = null;
        templateSession.batchImageUploads = [];
        setTemplateMode(true);
        refresh();
        commitHistory();
        showTemplateToast("Custom template loaded from startup", {
          durationMs: 1800,
        });
      },
    });

    customTemplateController = createCustomTemplateController({
      state,
      createLayer,
      setSelectedLayer,
      textTools,
      loadImage,
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
      onViewportPanBy: (deltaX, deltaY) => {
        viewportController.panBy(deltaX, deltaY, { notify: false });
        updateSelectionBox();
      },
      onCommit: commitHistory,
      onTextLayerTripleClick: openTextEditorFromCanvas,
    });

    if (!state.layers.length) {
      void addLayerFlowController.openFlow({ startup: true }).then(() => {
        if (!state.layers.length) return;
        fitEditorToContent();
      });
    } else {
      fitEditorToContent();
    }
    attachCropSelection({
      stage,
      refresh,
      onCommit: commitHistory,
    });
  }
}

new EditorApplication().start();
