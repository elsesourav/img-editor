import {
  bringLayerToFront,
  getDescendantLayerIds,
  getLayerById,
  getLayersByZOrderDesc,
  isLayerDescendantOf,
  moveLayerWithChildren,
  setSelectedLayer,
  syncLayerParentingForLayer,
} from "../../layers.js";
import { state } from "../../state.js";
import {
  captureStageViewport,
  getStagePoint,
  layerContainsPoint,
  resizeSelectionRect,
} from "./SelectGeometry.js";

const SNAP_THRESHOLD_PX = 8;

/**
 * @typedef {Object} DragSelectionRuntimeOptions
 * @property {HTMLElement} stage - Stage element that receives pointer events.
 * @property {HTMLElement} marquee - Marquee rectangle element.
 * @property {(opts?: {rerenderOptions?: boolean, rerenderLayersPanel?: boolean}) => void} refresh - UI refresh callback.
 * @property {() => void} [onCommit] - Called when a drag interaction changes state.
 * @property {(layerId: string) => void} [onTextLayerTripleClick] - Called on text layer triple-click.
 */

/**
 * Handles drag-select interactions and state mutation while the user drags.
 */
export class DragSelectionRuntime {
  /**
   * @param {DragSelectionRuntimeOptions} options - Runtime dependencies for drag interactions.
   */
  constructor({
    stage,
    marquee,
    refresh,
    onCommit = () => {},
    onTextLayerTripleClick = () => {},
  }) {
    this.stage = stage;
    this.marquee = marquee;
    this.refresh = refresh;
    this.onCommit = onCommit;
    this.onTextLayerTripleClick = onTextLayerTripleClick;

    this.dragMove = null;
    this.dragResize = null;
    this.dragAll = null;
    this.activePointerId = null;
    this.dragViewport = null;
    this.pendingPointerClient = null;
    this.moveFrame = 0;
    this.childSelectAttempt = null;
    this.didMutate = false;

    this.snapGuideX = null;
    this.snapGuideY = null;
    this.ensureSnapGuideElements();
  }

  /**
   * @return {void}
   */
  ensureSnapGuideElements() {
    if (this.snapGuideX && this.snapGuideY) return;

    const vertical = document.createElement("div");
    vertical.className = "snap-guide snap-guide-vertical";
    vertical.style.display = "none";

    const horizontal = document.createElement("div");
    horizontal.className = "snap-guide snap-guide-horizontal";
    horizontal.style.display = "none";

    this.stage.appendChild(vertical);
    this.stage.appendChild(horizontal);
    this.snapGuideX = vertical;
    this.snapGuideY = horizontal;
  }

  /**
   * @param {number|null} snapX - Snap X line in world space.
   * @param {number|null} snapY - Snap Y line in world space.
   * @return {void}
   */
  renderSnapGuides(snapX, snapY) {
    if (!this.snapGuideX || !this.snapGuideY) return;

    const zoom = Math.max(0.001, Number(state.editorZoom) || 1);
    const offsetX = Number(state.editorOffsetX) || 0;
    const offsetY = Number(state.editorOffsetY) || 0;

    if (Number.isFinite(snapX)) {
      this.snapGuideX.style.display = "block";
      this.snapGuideX.style.left = `${snapX * zoom + offsetX}px`;
    } else {
      this.snapGuideX.style.display = "none";
    }

    if (Number.isFinite(snapY)) {
      this.snapGuideY.style.display = "block";
      this.snapGuideY.style.top = `${snapY * zoom + offsetY}px`;
    } else {
      this.snapGuideY.style.display = "none";
    }
  }

  /**
   * @return {void}
   */
  hideSnapGuides() {
    this.renderSnapGuides(null, null);
  }

  /**
   * @return {{left:number,top:number,right:number,bottom:number,width:number,height:number}}
   */
  getViewportWorldRect() {
    const zoom = Math.max(0.001, state.editorZoom || 1);
    const offsetX = Number(state.editorOffsetX) || 0;
    const offsetY = Number(state.editorOffsetY) || 0;
    const worldLeft = -offsetX / zoom;
    const worldTop = -offsetY / zoom;
    const worldRight = worldLeft + this.stage.clientWidth / zoom;
    const worldBottom = worldTop + this.stage.clientHeight / zoom;

    return {
      left: worldLeft,
      top: worldTop,
      right: worldRight,
      bottom: worldBottom,
      width: Math.max(1, worldRight - worldLeft),
      height: Math.max(1, worldBottom - worldTop),
    };
  }

  /**
   * @param {Set<string>} excludedIds - Layer IDs to exclude from snapping targets.
   * @return {{x:number[],y:number[]}}
   */
  collectSnapTargets(excludedIds = new Set()) {
    const viewport = this.getViewportWorldRect();
    const xTargets = [
      viewport.left,
      viewport.left + viewport.width / 2,
      viewport.right,
    ];
    const yTargets = [
      viewport.top,
      viewport.top + viewport.height / 2,
      viewport.bottom,
    ];

    for (const layer of state.layers) {
      if (!layer || excludedIds.has(layer.id)) continue;

      xTargets.push(layer.x, layer.x + layer.width / 2, layer.x + layer.width);
      yTargets.push(layer.y, layer.y + layer.height / 2, layer.y + layer.height);
    }

    return {
      x: xTargets,
      y: yTargets,
    };
  }

  /**
   * @param {{x:number,y:number,width:number,height:number}} rect - Proposed rectangle.
   * @param {{x:number[],y:number[]}} targets - Snap lines.
   * @param {number} threshold - Snap threshold in editor pixels.
   * @return {{x:number,y:number}}
   */
  resolveSnappedPosition(rect, targets, threshold = SNAP_THRESHOLD_PX) {
    const xCandidates = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
    const yCandidates = [
      rect.y,
      rect.y + rect.height / 2,
      rect.y + rect.height,
    ];

    let bestDx = 0;
    let bestDy = 0;
    let bestSnapX = null;
    let bestSnapY = null;
    let bestAbsDx = threshold + 0.0001;
    let bestAbsDy = threshold + 0.0001;

    for (const line of xCandidates) {
      for (const target of targets.x) {
        const delta = target - line;
        const distance = Math.abs(delta);
        if (distance < bestAbsDx && distance <= threshold) {
          bestAbsDx = distance;
          bestDx = delta;
          bestSnapX = target;
        }
      }
    }

    for (const line of yCandidates) {
      for (const target of targets.y) {
        const delta = target - line;
        const distance = Math.abs(delta);
        if (distance < bestAbsDy && distance <= threshold) {
          bestAbsDy = distance;
          bestDy = delta;
          bestSnapY = target;
        }
      }
    }

    return {
      x: rect.x + bestDx,
      y: rect.y + bestDy,
      snapX: bestSnapX,
      snapY: bestSnapY,
    };
  }

  /**
   * Attaches all pointer handlers for drag selection behavior.
   * @return {void}
   */
  attach() {
    this.stage.addEventListener("pointerdown", (event) =>
      this.onPointerDown(event),
    );
    this.stage.addEventListener("pointermove", (event) =>
      this.onPointerMove(event),
    );
    this.stage.addEventListener("pointerup", () => this.finishDrag());
    this.stage.addEventListener("pointercancel", () => this.finishDrag());
  }

  /**
   * @return {void}
   */
  refreshDuringDrag() {
    this.refresh({ rerenderOptions: false, rerenderLayersPanel: false });
  }

  /**
   * @param {PointerEvent} event - Current pointer event.
   * @return {void}
   */
  beginPointerTracking(event) {
    this.activePointerId = event.pointerId;
    this.dragViewport = captureStageViewport(this.stage);
    this.stage.setPointerCapture(event.pointerId);
  }

  /**
   * @return {void}
   */
  clearPointerTracking() {
    this.pendingPointerClient = null;
    if (this.moveFrame) {
      cancelAnimationFrame(this.moveFrame);
      this.moveFrame = 0;
    }

    if (
      this.activePointerId !== null &&
      typeof this.stage.hasPointerCapture === "function" &&
      this.stage.hasPointerCapture(this.activePointerId)
    ) {
      this.stage.releasePointerCapture(this.activePointerId);
    }

    this.activePointerId = null;
    this.dragViewport = null;
  }

  /**
   * @return {void}
   */
  applyPendingPointerMove() {
    if (!this.pendingPointerClient || !this.dragViewport) return;

    const { clientX, clientY } = this.pendingPointerClient;
    this.pendingPointerClient = null;
    const point = getStagePoint(this.dragViewport, clientX, clientY);

    if (this.dragResize) {
      this.hideSnapGuides();
      const layer = getLayerById(this.dragResize.layerId);
      if (!layer) return;

      const deltaX = point.x - this.dragResize.startPointerX;
      const deltaY = point.y - this.dragResize.startPointerY;
      const resized = resizeSelectionRect(
        {
          x: this.dragResize.startX,
          y: this.dragResize.startY,
          width: this.dragResize.startWidth,
          height: this.dragResize.startHeight,
        },
        this.dragResize.handle,
        deltaX,
        deltaY,
      );

      layer.x = resized.x;
      layer.y = resized.y;
      layer.width = resized.width;
      layer.height = resized.height;

      const scaleX = resized.width / Math.max(1, this.dragResize.startWidth);
      const scaleY = resized.height / Math.max(1, this.dragResize.startHeight);

      for (const snapshot of this.dragResize.descendants) {
        const child = getLayerById(snapshot.id);
        if (!child) continue;

        child.x = resized.x + (snapshot.x - this.dragResize.startX) * scaleX;
        child.y = resized.y + (snapshot.y - this.dragResize.startY) * scaleY;
        child.width = snapshot.width * scaleX;
        child.height = snapshot.height * scaleY;
      }

      this.didMutate = true;
      this.refreshDuringDrag();
      return;
    }

    if (this.dragMove) {
      const layer = getLayerById(this.dragMove.layerId);
      if (!layer) return;

      const nextX = point.x - this.dragMove.dx;
      const nextY = point.y - this.dragMove.dy;

      const excludedIds = new Set([
        layer.id,
        ...getDescendantLayerIds(layer.id),
      ]);
      const snapTargets = this.collectSnapTargets(excludedIds);
      const snapThreshold =
        SNAP_THRESHOLD_PX / Math.max(0.001, Number(state.editorZoom) || 1);
      const snapped = this.resolveSnappedPosition(
        {
          x: nextX,
          y: nextY,
          width: layer.width,
          height: layer.height,
        },
        snapTargets,
        snapThreshold,
      );

      const snappedX = snapped.x;
      const snappedY = snapped.y;
      const deltaX = snappedX - layer.x;
      const deltaY = snappedY - layer.y;

      moveLayerWithChildren(layer.id, deltaX, deltaY);
      this.renderSnapGuides(snapped.snapX, snapped.snapY);
      this.didMutate = true;
      this.refreshDuringDrag();
      return;
    }

    if (this.dragAll) {
      const deltaX = point.x - this.dragAll.startX;
      const deltaY = point.y - this.dragAll.startY;

      const snappedGroup = this.resolveSnappedPosition(
        {
          x: this.dragAll.bounds.x + deltaX,
          y: this.dragAll.bounds.y + deltaY,
          width: this.dragAll.bounds.width,
          height: this.dragAll.bounds.height,
        },
        this.collectSnapTargets(new Set(state.layers.map((layer) => layer.id))),
        SNAP_THRESHOLD_PX / Math.max(0.001, Number(state.editorZoom) || 1),
      );
      const snappedDeltaX = snappedGroup.x - this.dragAll.bounds.x;
      const snappedDeltaY = snappedGroup.y - this.dragAll.bounds.y;

      for (const snapshot of this.dragAll.layers) {
        const layer = getLayerById(snapshot.id);
        if (!layer) continue;
        layer.x = snapshot.x + snappedDeltaX;
        layer.y = snapshot.y + snappedDeltaY;
      }

      if (state.cropSelection) {
        const selectedSnap = this.dragAll.layers.find(
          (layer) => layer.id === state.cropSelection.layerId,
        );
        if (selectedSnap) {
          state.cropSelection.x = selectedSnap.x + snappedDeltaX;
          state.cropSelection.y = selectedSnap.y + snappedDeltaY;
        }
      }

      this.renderSnapGuides(snappedGroup.snapX, snappedGroup.snapY);
      this.didMutate = true;
      this.refreshDuringDrag();
      return;
    }

    this.hideSnapGuides();
  }

  /**
   * @param {number} clientX - Pointer X in client coordinates.
   * @param {number} clientY - Pointer Y in client coordinates.
   * @return {void}
   */
  schedulePointerMove(clientX, clientY) {
    this.pendingPointerClient = { clientX, clientY };
    if (this.moveFrame) return;

    this.moveFrame = requestAnimationFrame(() => {
      this.moveFrame = 0;
      this.applyPendingPointerMove();
    });
  }

  /**
   * @param {string} parentId - Current selected parent layer ID.
   * @param {string} childId - Child layer candidate ID.
   * @param {{x:number,y:number}} point - Stage point where click occurred.
   * @return {boolean} - True when the click pattern qualifies as a double-click.
   */
  isChildSelectionDoubleClick(parentId, childId, point) {
    const now = performance.now();
    const maxDelayMs = 360;
    const maxDistance = 10;

    if (
      this.childSelectAttempt &&
      this.childSelectAttempt.parentId === parentId &&
      this.childSelectAttempt.childId === childId
    ) {
      const deltaTime = now - this.childSelectAttempt.time;
      const deltaX = point.x - this.childSelectAttempt.x;
      const deltaY = point.y - this.childSelectAttempt.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (deltaTime <= maxDelayMs && distance <= maxDistance) {
        this.childSelectAttempt = null;
        return true;
      }
    }

    this.childSelectAttempt = {
      parentId,
      childId,
      x: point.x,
      y: point.y,
      time: now,
    };

    return false;
  }

  /**
   * @param {PointerEvent} event - Pointer down event.
   * @return {void}
   */
  onPointerDown(event) {
    if (event.button !== 0) return;
    const isMoveMode = state.mode === "drag-select";
    const isFilterMode = state.mode === "filter-adjust";
    const isShadowMode = state.mode === "shadow-adjust";
    if (!isMoveMode && !isFilterMode && !isShadowMode) return;

    const point = getStagePoint(
      captureStageViewport(this.stage),
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

      this.dragResize = {
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

      this.beginPointerTracking(event);
      this.refresh();
      return;
    }

    const hitLayer = getLayersByZOrderDesc().find((layer) =>
      layerContainsPoint(layer, point.x, point.y),
    );

    if (hitLayer) {
      if (hitLayer.textMeta && event.detail >= 3) {
        setSelectedLayer(hitLayer.id);
        bringLayerToFront(hitLayer.id);
        this.childSelectAttempt = null;
        this.didMutate = true;
        this.refresh();
        this.onTextLayerTripleClick(hitLayer.id);
        return;
      }

      const selected = getLayerById(state.selectedLayerId);
      const mustDoubleClickForChild =
        selected &&
        selected.id !== hitLayer.id &&
        isLayerDescendantOf(hitLayer.id, selected.id);

      if (
        mustDoubleClickForChild &&
        !this.isChildSelectionDoubleClick(selected.id, hitLayer.id, point)
      ) {
        this.dragMove = {
          layerId: selected.id,
          dx: point.x - selected.x,
          dy: point.y - selected.y,
        };

        this.refresh();
        this.beginPointerTracking(event);
        return;
      }

      setSelectedLayer(hitLayer.id);
      bringLayerToFront(hitLayer.id);
      this.childSelectAttempt = null;
      this.didMutate = true;

      const layer = getLayerById(hitLayer.id);
      if (!layer) return;

      this.dragMove = {
        layerId: layer.id,
        dx: point.x - layer.x,
        dy: point.y - layer.y,
      };

      this.refresh();
      this.beginPointerTracking(event);
      return;
    }

    if (isMoveMode) {
      const bounds = (() => {
        if (!state.layers.length) {
          return { x: 0, y: 0, width: 1, height: 1 };
        }
        const left = Math.min(...state.layers.map((layer) => layer.x));
        const top = Math.min(...state.layers.map((layer) => layer.y));
        const right = Math.max(
          ...state.layers.map((layer) => layer.x + layer.width),
        );
        const bottom = Math.max(
          ...state.layers.map((layer) => layer.y + layer.height),
        );
        return {
          x: left,
          y: top,
          width: Math.max(1, right - left),
          height: Math.max(1, bottom - top),
        };
      })();

      this.dragAll = {
        startX: point.x,
        startY: point.y,
        bounds,
        layers: state.layers.map((layer) => ({
          id: layer.id,
          x: layer.x,
          y: layer.y,
        })),
      };
      this.marquee.style.display = "none";
      this.beginPointerTracking(event);
    }
  }

  /**
   * @param {PointerEvent} event - Pointer move event.
   * @return {void}
   */
  onPointerMove(event) {
    const isMoveMode = state.mode === "drag-select";
    const isFilterMode = state.mode === "filter-adjust";
    if (
      !isMoveMode &&
      !isFilterMode &&
      !this.dragMove &&
      !this.dragResize &&
      !this.dragAll
    ) {
      return;
    }

    if (
      this.activePointerId !== null &&
      event.pointerId !== this.activePointerId
    ) {
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

    if (this.dragMove || this.dragResize || this.dragAll) {
      this.schedulePointerMove(latestEvent.clientX, latestEvent.clientY);
    }
  }

  /**
   * Finalizes drag operation, applies pending changes, and commits once.
   * @return {void}
   */
  finishDrag() {
    this.applyPendingPointerMove();

    if (this.dragMove?.layerId) {
      syncLayerParentingForLayer(this.dragMove.layerId);
    }

    if (this.dragResize?.layerId) {
      syncLayerParentingForLayer(this.dragResize.layerId);

      for (const snapshot of this.dragResize.descendants) {
        syncLayerParentingForLayer(snapshot.id);
      }
    }

    this.dragMove = null;
    this.dragResize = null;
    this.dragAll = null;
    this.clearPointerTracking();
    this.hideSnapGuides();
    this.marquee.style.display = "none";
    this.marquee.style.width = "0px";
    this.marquee.style.height = "0px";
    this.refresh();

    if (this.didMutate) {
      this.onCommit();
    }
    this.didMutate = false;
  }
}
