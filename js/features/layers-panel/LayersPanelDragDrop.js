let activeDraggedLayerId = null;

function normalizeLayerZOrder(state) {
  for (let index = 0; index < state.layers.length; index += 1) {
    state.layers[index].zOrder = index + 1;
  }
}

function moveLayerBlockAfter(
  state,
  getDescendantLayerIds,
  blockRootId,
  anchorId,
) {
  const blockIds = new Set([
    blockRootId,
    ...getDescendantLayerIds(blockRootId),
  ]);
  const block = state.layers.filter((layer) => blockIds.has(layer.id));
  if (!block.length) return false;

  const remaining = state.layers.filter((layer) => !blockIds.has(layer.id));
  const anchorIndex = remaining.findIndex((layer) => layer.id === anchorId);
  if (anchorIndex < 0) return false;

  state.layers = [
    ...remaining.slice(0, anchorIndex + 1),
    ...block,
    ...remaining.slice(anchorIndex + 1),
  ];
  return true;
}

function moveLayerBlockToRootEnd(state, getDescendantLayerIds, blockRootId) {
  const blockIds = new Set([
    blockRootId,
    ...getDescendantLayerIds(blockRootId),
  ]);
  const block = state.layers.filter((layer) => blockIds.has(layer.id));
  if (!block.length) return false;

  const remaining = state.layers.filter((layer) => !blockIds.has(layer.id));

  state.layers = [...remaining, ...block];
  return true;
}

function setLayerParent(state, layerId, nextParentId) {
  const layer = state.layers.find((entry) => entry.id === layerId);
  if (!layer) return false;

  layer.parentId = nextParentId;
  return true;
}

function makeLayerChildOfLayer(
  state,
  getDescendantLayerIds,
  draggedId,
  targetId,
) {
  if (!draggedId || !targetId || draggedId === targetId) return false;

  const draggedDescendants = new Set(getDescendantLayerIds(draggedId));
  if (draggedDescendants.has(targetId)) {
    return false;
  }

  const didSetParent = setLayerParent(state, draggedId, targetId);
  if (!didSetParent) return false;

  const didMoveBlock = moveLayerBlockAfter(
    state,
    getDescendantLayerIds,
    draggedId,
    targetId,
  );
  if (!didMoveBlock) return false;

  normalizeLayerZOrder(state);
  return true;
}

function moveLayerToRoot(state, getDescendantLayerIds, draggedId) {
  if (!draggedId) return false;

  const didSetParent = setLayerParent(state, draggedId, null);
  if (!didSetParent) return false;

  const didMove = moveLayerBlockToRootEnd(
    state,
    getDescendantLayerIds,
    draggedId,
  );
  if (!didMove) return false;

  normalizeLayerZOrder(state);
  return true;
}

function attachLayersPanelDragAndDropRuntime({
  item,
  layerId,
  layersList,
  state,
  getDescendantLayerIds,
  onDropApplied,
}) {
  item.draggable = true;
  item.dataset.layerId = layerId;

  item.addEventListener("dragstart", (event) => {
    activeDraggedLayerId = layerId;
    item.classList.add("dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", layerId);
    }
  });

  item.addEventListener("dragend", () => {
    activeDraggedLayerId = null;
    item.classList.remove("dragging");
    for (const el of layersList.querySelectorAll(".layer-item.drag-over")) {
      el.classList.remove("drag-over");
    }
    layersList.classList.remove("drag-over-root");
  });

  item.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!activeDraggedLayerId || activeDraggedLayerId === layerId) return;
    item.classList.add("drag-over");
  });

  item.addEventListener("dragleave", () => {
    item.classList.remove("drag-over");
  });

  item.addEventListener("drop", (event) => {
    event.preventDefault();
    item.classList.remove("drag-over");

    const droppedId =
      activeDraggedLayerId || event.dataTransfer?.getData("text/plain") || null;
    if (!droppedId) return;

    const didApply = makeLayerChildOfLayer(
      state,
      getDescendantLayerIds,
      droppedId,
      layerId,
    );
    if (!didApply) return;

    onDropApplied(droppedId);
  });

  const handleRootDragOver = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".layer-item")) return;

    event.preventDefault();
    if (!activeDraggedLayerId) return;
    layersList.classList.add("drag-over-root");
  };

  const handleRootDragLeave = (event) => {
    const related = event.relatedTarget;
    if (related instanceof Node && layersList.contains(related)) return;
    layersList.classList.remove("drag-over-root");
  };

  const handleRootDrop = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".layer-item")) return;

    event.preventDefault();
    layersList.classList.remove("drag-over-root");

    const droppedId =
      activeDraggedLayerId || event.dataTransfer?.getData("text/plain") || null;
    if (!droppedId) return;

    const didApply = moveLayerToRoot(state, getDescendantLayerIds, droppedId);
    if (!didApply) return;

    onDropApplied(droppedId);
  };

  if (!layersList.dataset.dndRootAttached) {
    layersList.dataset.dndRootAttached = "true";
    layersList.addEventListener("dragover", handleRootDragOver);
    layersList.addEventListener("dragleave", handleRootDragLeave);
    layersList.addEventListener("drop", handleRootDrop);
  }
}

/**
 * Class-backed layers panel drag-and-drop facade.
 */
class LayersPanelDnDController {
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
    attachLayersPanelDragAndDropRuntime(this.options);
  }
}

export function attachLayersPanelDragAndDrop(options) {
  new LayersPanelDnDController(options).attach();
}
