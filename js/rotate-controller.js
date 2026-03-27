function normalizeAngle(angle) {
  const next = Number(angle) || 0;
  let normalized = ((next % 360) + 360) % 360;
  if (normalized > 180) normalized -= 360;
  return normalized;
}

function rotatePoint(pointX, pointY, pivotX, pivotY, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = pointX - pivotX;
  const dy = pointY - pivotY;

  return {
    x: pivotX + dx * cos - dy * sin,
    y: pivotY + dx * sin + dy * cos,
  };
}

function createRotateControllerLegacy({
  state,
  stage,
  rotateHandle,
  setSelectedLayer,
  bringLayerToFront,
  getLayersByZOrderDesc,
  getLayerById,
  getDescendantLayerIds,
  getWorldPointFromClient,
  loadImage,
  refresh,
  commitHistory,
}) {
  let rotateSession = null;
  let isApplyingRotation = false;

  const captureSession = (rootLayerId) => {
    const ids = [rootLayerId, ...getDescendantLayerIds(rootLayerId)];
    const snapshot = new Map();

    for (const id of ids) {
      const layer = getLayerById(id);
      if (!layer) continue;
      snapshot.set(id, {
        x: layer.x,
        y: layer.y,
        rotation: Number(layer.rotation) || 0,
      });
    }

    return snapshot;
  };

  const applySessionSnapshot = (snapshot) => {
    if (!snapshot) return;

    for (const [id, layerState] of snapshot.entries()) {
      const layer = getLayerById(id);
      if (!layer) continue;
      layer.x = layerState.x;
      layer.y = layerState.y;
      layer.rotation = layerState.rotation;
    }
  };

  const ensureSession = () => {
    if (state.mode !== "rotate-select") return;

    const selected = getLayerById(state.selectedLayerId);
    if (!selected) {
      rotateSession = null;
      return;
    }

    if (rotateSession?.layerId === selected.id) {
      return;
    }

    if (rotateSession?.snapshot) {
      applySessionSnapshot(rotateSession.snapshot);
    }

    rotateSession = {
      layerId: selected.id,
      snapshot: captureSession(selected.id),
    };
  };

  const revertSession = () => {
    if (!rotateSession?.snapshot) {
      rotateSession = null;
      return;
    }

    applySessionSnapshot(rotateSession.snapshot);
    rotateSession = null;
  };

  const rotateLayerWithDescendants = (layerId, deltaDegrees) => {
    if (!deltaDegrees) return;

    const root = getLayerById(layerId);
    if (!root) return;

    const radians = (deltaDegrees * Math.PI) / 180;
    const pivotX = root.x + root.width / 2;
    const pivotY = root.y + root.height / 2;

    const ids = [layerId, ...getDescendantLayerIds(layerId)];
    for (const id of ids) {
      const layer = getLayerById(id);
      if (!layer) continue;

      const centerX = layer.x + layer.width / 2;
      const centerY = layer.y + layer.height / 2;
      const rotatedCenter = rotatePoint(
        centerX,
        centerY,
        pivotX,
        pivotY,
        radians,
      );

      layer.x = rotatedCenter.x - layer.width / 2;
      layer.y = rotatedCenter.y - layer.height / 2;
      layer.rotation = normalizeAngle((layer.rotation || 0) + deltaDegrees);
    }
  };

  const setRotationForSelection = (nextAngle, { commit = true } = {}) => {
    const selected = getLayerById(state.selectedLayerId);
    if (!selected) return;

    if (state.mode === "rotate-select") {
      ensureSession();
    }

    const current = Number(selected.rotation) || 0;
    const normalizedTarget = normalizeAngle(nextAngle);
    const delta = normalizedTarget - current;
    if (!delta) return;

    rotateLayerWithDescendants(selected.id, delta);
    refresh();

    if (commit) {
      commitHistory();
    }
  };

  const applyRotationToLayer = async (layer) => {
    const angle = normalizeAngle(layer.rotation || 0);
    if (!angle) return;

    const img = await loadImage(layer.src);
    const radians = (angle * Math.PI) / 180;

    const halfW = layer.width / 2;
    const halfH = layer.height / 2;
    const corners = [
      rotatePoint(-halfW, -halfH, 0, 0, radians),
      rotatePoint(halfW, -halfH, 0, 0, radians),
      rotatePoint(halfW, halfH, 0, 0, radians),
      rotatePoint(-halfW, halfH, 0, 0, radians),
    ];

    const minX = Math.min(...corners.map((point) => point.x));
    const maxX = Math.max(...corners.map((point) => point.x));
    const minY = Math.min(...corners.map((point) => point.y));
    const maxY = Math.max(...corners.map((point) => point.y));

    const targetWidth = Math.max(1, Math.ceil(maxX - minX));
    const targetHeight = Math.max(1, Math.ceil(maxY - minY));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");

    const isTransparent = layer.cropBackgroundMode === "transparent";
    if (isTransparent) {
      ctx.clearRect(0, 0, targetWidth, targetHeight);
    } else {
      ctx.fillStyle = layer.cropBackgroundColor || "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.save();
    // Shift rotated local coordinates so the top-left corner is at canvas origin.
    ctx.translate(-minX, -minY);
    ctx.rotate(radians);
    ctx.drawImage(
      img,
      -layer.width / 2,
      -layer.height / 2,
      layer.width,
      layer.height,
    );
    ctx.restore();

    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;

    layer.src = canvas.toDataURL("image/png");
    layer.width = targetWidth;
    layer.height = targetHeight;
    layer.x = centerX + minX;
    layer.y = centerY + minY;
    layer.rotation = 0;
  };

  const applyRotationSelection = async () => {
    if (isApplyingRotation) return;

    const selected = getLayerById(state.selectedLayerId);
    if (!selected) return;

    const targetIds = [selected.id, ...getDescendantLayerIds(selected.id)];
    isApplyingRotation = true;

    try {
      for (const id of targetIds) {
        const layer = getLayerById(id);
        if (!layer) continue;
        await applyRotationToLayer(layer);
      }

      rotateSession = null;
      refresh();
      commitHistory();
    } catch (error) {
      console.error(error);
    } finally {
      isApplyingRotation = false;
    }
  };

  const pointInLayerRect = (layer, point) => {
    return (
      point.x >= layer.x &&
      point.x <= layer.x + layer.width &&
      point.y >= layer.y &&
      point.y <= layer.y + layer.height
    );
  };

  const getTopLayerAtPoint = (point) => {
    return getLayersByZOrderDesc().find((layer) =>
      pointInLayerRect(layer, point),
    );
  };

  const setupRotateHandleControls = () => {
    let rotateDrag = null;
    let moveDrag = null;

    stage.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (state.mode !== "rotate-select") return;

      const target = event.target;
      if (target instanceof Element && target.closest("#rotateHandle")) {
        return;
      }

      const point = getWorldPointFromClient(event.clientX, event.clientY);
      const hitLayer = getTopLayerAtPoint(point);
      if (!hitLayer) return;

      let selected = getLayerById(state.selectedLayerId);
      if (!selected || selected.id !== hitLayer.id) {
        setSelectedLayer(hitLayer.id);
        bringLayerToFront(hitLayer.id);
        selected = getLayerById(hitLayer.id);
        refresh();
      }

      if (!selected) return;

      ensureSession();

      moveDrag = {
        pointerId: event.pointerId,
        startPointerX: point.x,
        startPointerY: point.y,
        startLayerX: selected.x,
        startLayerY: selected.y,
        descendants: getDescendantLayerIds(selected.id)
          .map((id) => getLayerById(id))
          .filter(Boolean)
          .map((layer) => ({
            id: layer.id,
            x: layer.x,
            y: layer.y,
          })),
      };

      stage.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    stage.addEventListener("pointermove", (event) => {
      if (!moveDrag || moveDrag.pointerId !== event.pointerId) return;

      const selected = getLayerById(state.selectedLayerId);
      if (!selected) return;

      const point = getWorldPointFromClient(event.clientX, event.clientY);
      const deltaX = point.x - moveDrag.startPointerX;
      const deltaY = point.y - moveDrag.startPointerY;

      selected.x = moveDrag.startLayerX + deltaX;
      selected.y = moveDrag.startLayerY + deltaY;

      for (const snapshot of moveDrag.descendants) {
        const layer = getLayerById(snapshot.id);
        if (!layer) continue;
        layer.x = snapshot.x + deltaX;
        layer.y = snapshot.y + deltaY;
      }

      refresh({ rerenderLayersPanel: false });
      event.preventDefault();
    });

    rotateHandle?.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (state.mode !== "rotate-select") return;

      const selected = getLayerById(state.selectedLayerId);
      if (!selected) return;

      ensureSession();

      const point = getWorldPointFromClient(event.clientX, event.clientY);
      const centerX = selected.x + selected.width / 2;
      const centerY = selected.y + selected.height / 2;
      const startPointerAngle =
        (Math.atan2(point.y - centerY, point.x - centerX) * 180) / Math.PI;

      rotateDrag = {
        pointerId: event.pointerId,
        startPointerAngle,
        startLayerAngle: Number(selected.rotation) || 0,
      };

      rotateHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });

    rotateHandle?.addEventListener("pointermove", (event) => {
      if (!rotateDrag || rotateDrag.pointerId !== event.pointerId) return;

      const selected = getLayerById(state.selectedLayerId);
      if (!selected) return;

      const point = getWorldPointFromClient(event.clientX, event.clientY);
      const centerX = selected.x + selected.width / 2;
      const centerY = selected.y + selected.height / 2;
      const pointerAngle =
        (Math.atan2(point.y - centerY, point.x - centerX) * 180) / Math.PI;

      const nextAngle =
        rotateDrag.startLayerAngle +
        (pointerAngle - rotateDrag.startPointerAngle);

      setRotationForSelection(nextAngle, { commit: false });
      event.preventDefault();
    });

    const finishDrag = (event) => {
      let didFinish = false;

      if (rotateDrag && rotateDrag.pointerId === event.pointerId) {
        rotateDrag = null;
        didFinish = true;
      }

      if (moveDrag && moveDrag.pointerId === event.pointerId) {
        moveDrag = null;
        didFinish = true;
      }

      if (!didFinish) return;

      refresh({ rerenderLayersPanel: false });
    };

    stage.addEventListener("pointerup", finishDrag);
    stage.addEventListener("pointercancel", finishDrag);
    rotateHandle?.addEventListener("pointerup", finishDrag);
    rotateHandle?.addEventListener("pointercancel", finishDrag);
  };

  return {
    ensureSession,
    revertSession,
    setRotationForSelection,
    applyRotationSelection,
    setupRotateHandleControls,
    isApplyingRotation: () => isApplyingRotation,
  };
}

/**
 * Class-backed rotate controller facade.
 */
class RotateController {
  /**
   * @param {Object} deps
   */
  constructor(deps) {
    this.impl = createRotateControllerLegacy(deps);
  }

  /** @return {void} */
  ensureSession() {
    this.impl.ensureSession();
  }

  /** @return {void} */
  revertSession() {
    this.impl.revertSession();
  }

  /**
   * @param {number} nextAngle
   * @param {{commit?: boolean}} options
   * @return {void}
   */
  setRotationForSelection(nextAngle, options = {}) {
    this.impl.setRotationForSelection(nextAngle, options);
  }

  /** @return {Promise<void>} */
  async applyRotationSelection() {
    await this.impl.applyRotationSelection();
  }

  /** @return {void} */
  setupRotateHandleControls() {
    this.impl.setupRotateHandleControls();
  }

  /** @return {boolean} */
  isApplyingRotation() {
    return this.impl.isApplyingRotation();
  }
}

export function createRotateController(deps) {
  return new RotateController(deps);
}
