import {
  bringLayerToFront,
  getDescendantLayerIds,
  getLayerById,
  getLayersByZOrderDesc,
  isLayerDescendantOf,
  setSelectedLayer,
  syncLayerParentingForLayer,
} from "../../core/LayerStore.js";
import { state } from "../../core/EditorStateStore.js";

function getStagePoint(viewport, clientX, clientY) {
  const zoom = Math.max(0.001, viewport.zoom || 1);
  const offsetX = viewport.offsetX || 0;
  const offsetY = viewport.offsetY || 0;
  return {
    x: (clientX - viewport.left - offsetX) / zoom,
    y: (clientY - viewport.top - offsetY) / zoom,
  };
}

function captureStageViewport(stage) {
  const rect = stage.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    zoom: Math.max(0.001, state.editorZoom || 1),
    offsetX: state.editorOffsetX || 0,
    offsetY: state.editorOffsetY || 0,
  };
}

function layerContainsPoint(layer, x, y) {
  return (
    x >= layer.x &&
    y >= layer.y &&
    x <= layer.x + layer.width &&
    y <= layer.y + layer.height
  );
}

function attachCropSelectionRuntime({ stage, refresh, onCommit = () => {} }) {
  let dragCrop = null;
  let dragAll = null;
  let activePointerId = null;
  let dragViewport = null;
  let pendingPointerClient = null;
  let moveFrame = 0;
  let childSelectAttempt = null;
  let didMutate = false;

  function refreshDuringDrag() {
    refresh({ rerenderOptions: false, rerenderLayersPanel: false });
  }

  function beginPointerTracking(event) {
    activePointerId = event.pointerId;
    dragViewport = captureStageViewport(stage);
    stage.setPointerCapture(event.pointerId);
  }

  function clearPointerTracking() {
    pendingPointerClient = null;
    if (moveFrame) {
      cancelAnimationFrame(moveFrame);
      moveFrame = 0;
    }

    if (
      activePointerId !== null &&
      typeof stage.hasPointerCapture === "function" &&
      stage.hasPointerCapture(activePointerId)
    ) {
      stage.releasePointerCapture(activePointerId);
    }

    activePointerId = null;
    dragViewport = null;
  }

  function schedulePointerMove(clientX, clientY) {
    pendingPointerClient = { clientX, clientY };
    if (moveFrame) return;

    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0;
      applyPendingPointerMove();
    });
  }

  function applyPendingPointerMove() {
    if (!pendingPointerClient || !dragViewport) return;

    const { clientX, clientY } = pendingPointerClient;
    pendingPointerClient = null;
    const point = getStagePoint(dragViewport, clientX, clientY);

    if (dragAll) {
      const deltaX = point.x - dragAll.startX;
      const deltaY = point.y - dragAll.startY;

      for (const snapshot of dragAll.layers) {
        const layer = getLayerById(snapshot.id);
        if (!layer) continue;
        layer.x = snapshot.x + deltaX;
        layer.y = snapshot.y + deltaY;
      }

      if (state.cropSelection && dragAll.crop) {
        state.cropSelection.x = dragAll.crop.x + deltaX;
        state.cropSelection.y = dragAll.crop.y + deltaY;
      }

      didMutate = true;
      refreshDuringDrag();
      return;
    }

    if (!dragCrop) return;

    const layer = getLayerById(dragCrop.layerId);
    if (!layer) return;

    if (dragCrop.type === "move") {
      if (!state.cropSelection) return;

      const deltaX = point.x - dragCrop.startPointerX;
      const deltaY = point.y - dragCrop.startPointerY;

      layer.x = dragCrop.startLayerX + deltaX;
      layer.y = dragCrop.startLayerY + deltaY;

      for (const snapshot of dragCrop.descendants || []) {
        const child = getLayerById(snapshot.id);
        if (!child) continue;
        child.x = snapshot.x + deltaX;
        child.y = snapshot.y + deltaY;
      }

      state.cropSelection.x = dragCrop.startCropX + deltaX;
      state.cropSelection.y = dragCrop.startCropY + deltaY;
      didMutate = true;
    }

    if (dragCrop.type === "resize") {
      if (!state.cropSelection) return;

      const min = 24;
      const start = dragCrop.start;
      const localX = point.x;
      const localY = point.y;

      let left = start.x;
      let top = start.y;
      let right = start.x + start.width;
      let bottom = start.y + start.height;

      if (dragCrop.handle === "nw") {
        left = Math.min(right - min, localX);
        top = Math.min(bottom - min, localY);
      }
      if (dragCrop.handle === "ne") {
        right = Math.max(left + min, localX);
        top = Math.min(bottom - min, localY);
      }
      if (dragCrop.handle === "sw") {
        left = Math.min(right - min, localX);
        bottom = Math.max(top + min, localY);
      }
      if (dragCrop.handle === "se") {
        right = Math.max(left + min, localX);
        bottom = Math.max(top + min, localY);
      }
      if (dragCrop.handle === "n") {
        top = Math.min(bottom - min, localY);
      }
      if (dragCrop.handle === "e") {
        right = Math.max(left + min, localX);
      }
      if (dragCrop.handle === "s") {
        bottom = Math.max(top + min, localY);
      }
      if (dragCrop.handle === "w") {
        left = Math.min(right - min, localX);
      }

      const ratioValue = Number(state.cropAspectRatio);
      const ratio =
        Number.isFinite(ratioValue) && ratioValue > 0 ? ratioValue : null;
      if (ratio) {
        const handle = dragCrop.handle;
        const centerX = start.x + start.width / 2;
        const centerY = start.y + start.height / 2;

        let width = Math.max(min, right - left);
        let height = Math.max(min, bottom - top);

        if (
          handle === "nw" ||
          handle === "ne" ||
          handle === "sw" ||
          handle === "se"
        ) {
          if (width / height > ratio) {
            width = height * ratio;
          } else {
            height = width / ratio;
          }

          if (width < min) {
            width = min;
            height = width / ratio;
          }
          if (height < min) {
            height = min;
            width = height * ratio;
          }

          if (handle === "se") {
            right = left + width;
            bottom = top + height;
          }
          if (handle === "nw") {
            left = right - width;
            top = bottom - height;
          }
          if (handle === "ne") {
            right = left + width;
            top = bottom - height;
          }
          if (handle === "sw") {
            left = right - width;
            bottom = top + height;
          }
        }

        if (handle === "n" || handle === "s") {
          height = Math.max(min, bottom - top);
          width = Math.max(min, height * ratio);
          left = centerX - width / 2;
          right = left + width;

          if (handle === "n") {
            top = bottom - height;
          } else {
            bottom = top + height;
          }
        }

        if (handle === "e" || handle === "w") {
          width = Math.max(min, right - left);
          height = Math.max(min, width / ratio);
          top = centerY - height / 2;
          bottom = top + height;

          if (handle === "e") {
            right = left + width;
          } else {
            left = right - width;
          }
        }
      }

      state.cropSelection.x = left;
      state.cropSelection.y = top;
      state.cropSelection.width = Math.max(min, right - left);
      state.cropSelection.height = Math.max(min, bottom - top);
      didMutate = true;
    }

    refreshDuringDrag();
  }

  function isChildSelectionDoubleClick(parentId, childId, point) {
    const now = performance.now();
    const maxDelayMs = 360;
    const maxDistance = 10;

    if (
      childSelectAttempt &&
      childSelectAttempt.parentId === parentId &&
      childSelectAttempt.childId === childId
    ) {
      const deltaTime = now - childSelectAttempt.time;
      const deltaX = point.x - childSelectAttempt.x;
      const deltaY = point.y - childSelectAttempt.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (deltaTime <= maxDelayMs && distance <= maxDistance) {
        childSelectAttempt = null;
        return true;
      }
    }

    childSelectAttempt = {
      parentId,
      childId,
      x: point.x,
      y: point.y,
      time: now,
    };

    return false;
  }

  function beginMoveDrag(layer, crop, point) {
    dragCrop = {
      type: "move",
      layerId: layer.id,
      startPointerX: point.x,
      startPointerY: point.y,
      startLayerX: layer.x,
      startLayerY: layer.y,
      startCropX: crop.x,
      startCropY: crop.y,
      descendants: getDescendantLayerIds(layer.id)
        .map((id) => getLayerById(id))
        .filter(Boolean)
        .map((child) => ({
          id: child.id,
          x: child.x,
          y: child.y,
        })),
    };
  }

  function ensureCropSelection(layer) {
    if (!layer) return null;

    if (state.cropSelection?.layerId !== layer.id) {
      state.cropSelection = {
        layerId: layer.id,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
      };
    }

    return state.cropSelection;
  }

  function pointInRect(point, rect) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (state.mode !== "crop-select") return;

    const handle = event.target.dataset.cropHandle;
    const point = getStagePoint(
      captureStageViewport(stage),
      event.clientX,
      event.clientY,
    );

    if (handle) {
      const selected = getLayerById(state.selectedLayerId);
      const crop = ensureCropSelection(selected);
      if (!crop) return;

      dragCrop = {
        type: "resize",
        handle,
        layerId: selected.id,
        start: {
          x: crop.x,
          y: crop.y,
          width: crop.width,
          height: crop.height,
        },
      };

      beginPointerTracking(event);
      refresh();
      return;
    }

    const hitLayer = getLayersByZOrderDesc().find((layer) =>
      layerContainsPoint(layer, point.x, point.y),
    );

    const selected = getLayerById(state.selectedLayerId);
    const mustDoubleClickForChild =
      selected &&
      hitLayer &&
      selected.id !== hitLayer.id &&
      isLayerDescendantOf(hitLayer.id, selected.id);

    // If pointer is over another top layer (e.g. child inside parent crop),
    // switch selection to that layer first so it can be cropped directly.
    if (
      hitLayer &&
      hitLayer.id !== state.cropSelection?.layerId &&
      (!mustDoubleClickForChild ||
        isChildSelectionDoubleClick(selected.id, hitLayer.id, point))
    ) {
      setSelectedLayer(hitLayer.id);
      bringLayerToFront(hitLayer.id);
      childSelectAttempt = null;
      didMutate = true;

      const layer = getLayerById(hitLayer.id);
      if (!layer) return;
      const crop = ensureCropSelection(layer);
      if (!crop) return;

      beginMoveDrag(layer, crop, point);
      beginPointerTracking(event);
      refresh();
      return;
    }

    if (state.cropSelection && pointInRect(point, state.cropSelection)) {
      const selected = getLayerById(state.cropSelection.layerId);
      if (!selected) return;

      setSelectedLayer(selected.id);
      bringLayerToFront(selected.id);

      beginMoveDrag(selected, state.cropSelection, point);

      beginPointerTracking(event);
      refresh();
      return;
    }

    if (mustDoubleClickForChild) {
      isChildSelectionDoubleClick(selected.id, hitLayer.id, point);
    }

    if (!hitLayer) {
      dragAll = {
        startX: point.x,
        startY: point.y,
        layers: state.layers.map((layer) => ({
          id: layer.id,
          x: layer.x,
          y: layer.y,
        })),
        crop: state.cropSelection
          ? {
              x: state.cropSelection.x,
              y: state.cropSelection.y,
            }
          : null,
      };

      beginPointerTracking(event);
      refresh();
      return;
    }

    setSelectedLayer(hitLayer.id);
    bringLayerToFront(hitLayer.id);
    didMutate = true;

    const layer = getLayerById(hitLayer.id);
    if (!layer) return;

    const crop = ensureCropSelection(layer);
    if (!crop) return;

    beginMoveDrag(layer, crop, point);

    beginPointerTracking(event);
    refresh();
  });

  stage.addEventListener("pointermove", (event) => {
    if (!dragCrop && !dragAll) return;

    if (activePointerId !== null && event.pointerId !== activePointerId) {
      return;
    }

    const coalesced =
      typeof event.getCoalescedEvents === "function"
        ? event.getCoalescedEvents()
        : null;
    const latestEvent =
      coalesced && coalesced.length > 0
        ? coalesced[coalesced.length - 1]
        : event;

    schedulePointerMove(latestEvent.clientX, latestEvent.clientY);
  });

  function clearDrag() {
    applyPendingPointerMove();

    if (dragCrop?.layerId) {
      syncLayerParentingForLayer(dragCrop.layerId);
    }

    dragCrop = null;
    dragAll = null;
    clearPointerTracking();
    refresh();

    if (didMutate) {
      onCommit();
    }
    didMutate = false;
  }

  stage.addEventListener("pointerup", clearDrag);
  stage.addEventListener("pointercancel", clearDrag);
}

/**
 * Class-backed crop selection interaction facade.
 */
class CropSelectionController {
  /**
   * @param {{stage:HTMLElement,refresh:Function,onCommit?:Function}} options
   */
  constructor(options) {
    this.options = options;
  }

  /**
   * @return {void}
   */
  attach() {
    attachCropSelectionRuntime(this.options);
  }
}

export function attachCropSelection(options) {
  new CropSelectionController(options).attach();
}
