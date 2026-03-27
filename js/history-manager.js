import { getLayerIdCounter, setLayerIdCounter, state } from "./state.js";

function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function snapshotToSignature(snapshot) {
  return JSON.stringify(snapshot);
}

function createSnapshot() {
  return {
    mode: state.mode,
    layers: deepClone(state.layers),
    selectedLayerId: state.selectedLayerId,
    cropSelection: state.cropSelection ? deepClone(state.cropSelection) : null,
    editorZoom: state.editorZoom,
    editorOffsetX: state.editorOffsetX,
    editorOffsetY: state.editorOffsetY,
    layerIdCounter: getLayerIdCounter(),
  };
}

function applySnapshot(snapshot) {
  state.mode = snapshot.mode;
  state.layers = deepClone(snapshot.layers);
  state.selectedLayerId = snapshot.selectedLayerId;
  state.cropSelection = snapshot.cropSelection
    ? deepClone(snapshot.cropSelection)
    : null;
  state.editorZoom = snapshot.editorZoom;
  state.editorOffsetX = snapshot.editorOffsetX;
  state.editorOffsetY = snapshot.editorOffsetY;
  setLayerIdCounter(snapshot.layerIdCounter);
}

/**
 * Class-based history stack for editor snapshots.
 */
class HistoryManager {
  /**
   * @param {{onStateApplied?:Function,maxEntries?:number}} options
   */
  constructor({ onStateApplied, maxEntries = 200 } = {}) {
    this.onStateApplied = onStateApplied;
    this.maxEntries = maxEntries;
    this.past = [createSnapshot()];
    this.future = [];
  }

  /**
   * @return {void}
   */
  notify() {
    if (typeof this.onStateApplied === "function") {
      this.onStateApplied();
    }
  }

  /**
   * @return {void}
   */
  commit() {
    const nextSnapshot = createSnapshot();
    const lastSnapshot = this.past[this.past.length - 1];
    if (
      snapshotToSignature(lastSnapshot) === snapshotToSignature(nextSnapshot)
    ) {
      return;
    }

    this.past.push(nextSnapshot);
    if (this.past.length > this.maxEntries) {
      this.past.shift();
    }

    this.future.length = 0;
  }

  /**
   * @return {boolean}
   */
  undo() {
    if (this.past.length <= 1) return false;

    const current = this.past.pop();
    this.future.push(current);

    applySnapshot(this.past[this.past.length - 1]);
    this.notify();
    return true;
  }

  /**
   * @return {boolean}
   */
  redo() {
    if (!this.future.length) return false;

    const restored = this.future.pop();
    this.past.push(restored);

    applySnapshot(restored);
    this.notify();
    return true;
  }

  /**
   * @return {boolean}
   */
  canUndo() {
    return this.past.length > 1;
  }

  /**
   * @return {boolean}
   */
  canRedo() {
    return this.future.length > 0;
  }
}

export function createHistoryManager(options = {}) {
  return new HistoryManager(options);
}
