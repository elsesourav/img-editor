import {
  bringLayerToFront,
  getDescendantLayerIds,
  getLayerById,
  getLayersByZOrderDesc,
  isLayerDescendantOf,
  moveLayerWithChildren,
  setSelectedLayer,
  syncLayerParentingForLayer,
} from "./layers.js";
import { state } from "./state.js";

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

function resizeSelectionRect(start, handle, deltaX, deltaY) {
  const min = 24;
  const isCorner = ["nw", "ne", "sw", "se"].includes(handle);

  if (isCorner) {
    const ratio = Math.max(0.0001, start.width / Math.max(1, start.height));
    const signX = handle.includes("w") ? -1 : 1;
    const signY = handle.includes("n") ? -1 : 1;

    const widthFromX = start.width + signX * deltaX;
    const widthFromY = start.width + signY * deltaY * ratio;
    const nextWidth = Math.max(
      min,
      Math.abs(widthFromX - start.width) >= Math.abs(widthFromY - start.width)
        ? widthFromX
        : widthFromY,
    );
    const nextHeight = nextWidth / ratio;

    const nextX = handle.includes("w")
      ? start.x + (start.width - nextWidth)
      : start.x;
    const nextY = handle.includes("n")
      ? start.y + (start.height - nextHeight)
      : start.y;

    return {
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
    };
  }

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (handle === "n") {
    top = Math.min(bottom - min, start.y + deltaY);
  }
  if (handle === "s") {
    bottom = Math.max(top + min, start.y + start.height + deltaY);
  }
  if (handle === "w") {
    left = Math.min(right - min, start.x + deltaX);
  }
  if (handle === "e") {
    right = Math.max(left + min, start.x + start.width + deltaX);
  }

  return {
    x: left,
    y: top,
    width: Math.max(min, right - left),
    height: Math.max(min, bottom - top),
  };
}

function attachDragSelectionLegacy({
  stage,
  marquee,
  refresh,
  onCommit = () => {},
  onTextLayerTripleClick = () => {},
}) {
  let dragMove = null;
  let dragResize = null;
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

  function applyPendingPointerMove() {
    if (!pendingPointerClient || !dragViewport) return;

    const { clientX, clientY } = pendingPointerClient;
    pendingPointerClient = null;
    const point = getStagePoint(dragViewport, clientX, clientY);

    if (dragResize) {
      const layer = getLayerById(dragResize.layerId);
      if (!layer) return;

      const deltaX = point.x - dragResize.startPointerX;
      const deltaY = point.y - dragResize.startPointerY;
      const resized = resizeSelectionRect(
        {
          x: dragResize.startX,
          y: dragResize.startY,
          width: dragResize.startWidth,
          height: dragResize.startHeight,
        },
        dragResize.handle,
        deltaX,
        deltaY,
      );

      layer.x = resized.x;
      layer.y = resized.y;
      layer.width = resized.width;
      layer.height = resized.height;

      const scaleX = resized.width / Math.max(1, dragResize.startWidth);
      const scaleY = resized.height / Math.max(1, dragResize.startHeight);

      for (const snapshot of dragResize.descendants) {
        const child = getLayerById(snapshot.id);
        if (!child) continue;

        child.x = resized.x + (snapshot.x - dragResize.startX) * scaleX;
        child.y = resized.y + (snapshot.y - dragResize.startY) * scaleY;
        child.width = snapshot.width * scaleX;
        child.height = snapshot.height * scaleY;
      }

      didMutate = true;
      refreshDuringDrag();
      return;
    }

    if (dragMove) {
      const layer = getLayerById(dragMove.layerId);
      if (!layer) return;

      const nextX = point.x - dragMove.dx;
      const nextY = point.y - dragMove.dy;
      const deltaX = nextX - layer.x;
      const deltaY = nextY - layer.y;

      moveLayerWithChildren(layer.id, deltaX, deltaY);
      didMutate = true;
      refreshDuringDrag();
      return;
    }

    if (dragAll) {
      const deltaX = point.x - dragAll.startX;
      const deltaY = point.y - dragAll.startY;

      for (const snapshot of dragAll.layers) {
        const layer = getLayerById(snapshot.id);
        if (!layer) continue;
        layer.x = snapshot.x + deltaX;
        layer.y = snapshot.y + deltaY;
      }

      if (state.cropSelection) {
        const selectedSnap = dragAll.layers.find(
          (layer) => layer.id === state.cropSelection.layerId,
        );
        if (selectedSnap) {
          state.cropSelection.x = selectedSnap.x + deltaX;
          state.cropSelection.y = selectedSnap.y + deltaY;
        }
      }

      didMutate = true;
      refreshDuringDrag();
    }
  }

  function schedulePointerMove(clientX, clientY) {
    pendingPointerClient = { clientX, clientY };
    if (moveFrame) return;

    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0;
      applyPendingPointerMove();
    });
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

  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const isMoveMode = state.mode === "drag-select";
    const isFilterMode = state.mode === "filter-adjust";
    const isShadowMode = state.mode === "shadow-adjust";
    if (!isMoveMode && !isFilterMode && !isShadowMode) return;

    const point = getStagePoint(
      captureStageViewport(stage),
      event.clientX,
      event.clientY,
    );

    const handle = event.target.dataset.selectHandle;
    if (handle && isMoveMode) {
      const selected = getLayerById(state.selectedLayerId);
      if (!selected) return;

      const descendants = getDescendantLayerIds(selected.id)
        .map((id) => getLayerById(id))
        .filter(Boolean)
        .map((layer) => ({
          id: layer.id,
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
        }));

      dragResize = {
        handle,
        layerId: selected.id,
        startPointerX: point.x,
        startPointerY: point.y,
        startX: selected.x,
        startY: selected.y,
        startWidth: selected.width,
        startHeight: selected.height,
        descendants,
      };

      beginPointerTracking(event);
      refresh();
      return;
    }

    const hitLayer = getLayersByZOrderDesc().find((layer) =>
      layerContainsPoint(layer, point.x, point.y),
    );

    if (hitLayer) {
      if (hitLayer.textMeta && event.detail >= 3) {
        setSelectedLayer(hitLayer.id);
        bringLayerToFront(hitLayer.id);
        childSelectAttempt = null;
        didMutate = true;
        refresh();
        onTextLayerTripleClick(hitLayer.id);
        return;
      }

      const selected = getLayerById(state.selectedLayerId);
      const mustDoubleClickForChild =
        selected &&
        selected.id !== hitLayer.id &&
        isLayerDescendantOf(hitLayer.id, selected.id);

      if (
        mustDoubleClickForChild &&
        !isChildSelectionDoubleClick(selected.id, hitLayer.id, point)
      ) {
        dragMove = {
          layerId: selected.id,
          dx: point.x - selected.x,
          dy: point.y - selected.y,
        };

        refresh();
        beginPointerTracking(event);
        return;
      }

      setSelectedLayer(hitLayer.id);
      bringLayerToFront(hitLayer.id);
      childSelectAttempt = null;
      didMutate = true;

      const layer = getLayerById(hitLayer.id);
      if (!layer) return;

      dragMove = {
        layerId: layer.id,
        dx: point.x - layer.x,
        dy: point.y - layer.y,
      };

      refresh();
      beginPointerTracking(event);
      return;
    }

    if (isMoveMode) {
      dragAll = {
        startX: point.x,
        startY: point.y,
        layers: state.layers.map((layer) => ({
          id: layer.id,
          x: layer.x,
          y: layer.y,
        })),
      };
      marquee.style.display = "none";
      beginPointerTracking(event);
    }
  });

  stage.addEventListener("pointermove", (event) => {
    const isMoveMode = state.mode === "drag-select";
    const isFilterMode = state.mode === "filter-adjust";
    if (!isMoveMode && !isFilterMode && !dragMove && !dragResize && !dragAll) {
      return;
    }

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

    if (dragMove || dragResize || dragAll) {
      schedulePointerMove(latestEvent.clientX, latestEvent.clientY);
    }
  });

  function finishDrag() {
    applyPendingPointerMove();

    if (dragMove?.layerId) {
      syncLayerParentingForLayer(dragMove.layerId);
    }

    if (dragResize?.layerId) {
      syncLayerParentingForLayer(dragResize.layerId);

      for (const snapshot of dragResize.descendants) {
        syncLayerParentingForLayer(snapshot.id);
      }
    }

    dragMove = null;
    dragResize = null;
    dragAll = null;
    clearPointerTracking();
    marquee.style.display = "none";
    marquee.style.width = "0px";
    marquee.style.height = "0px";
    refresh();

    if (didMutate) {
      onCommit();
    }
    didMutate = false;
  }

  stage.addEventListener("pointerup", finishDrag);
  stage.addEventListener("pointercancel", finishDrag);
}

/**
 * Class-backed drag selection interaction facade.
 */
class DragSelectionController {
  /**
   * @param {Object} options
   */
  constructor(options) {
    this.options = options;
  }

  /**
   * @return {void}
   */
  attach() {
    attachDragSelectionLegacy(this.options);
  }
}

export function attachDragSelection(options) {
  new DragSelectionController(options).attach();
}
