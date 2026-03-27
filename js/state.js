/**
 * @typedef {Object} EditorState
 * @property {string} mode
 * @property {Array<any>} layers
 * @property {string|null} selectedLayerId
 * @property {any|null} cropSelection
 * @property {number|null} cropAspectRatio
 * @property {number} editorZoom
 * @property {number} editorOffsetX
 * @property {number} editorOffsetY
 */

/**
 * Holds application state and layer ID sequence.
 */
class EditorStateStore {
  constructor() {
    /** @type {EditorState} */
    this.state = {
      mode: "drag-select",
      layers: [],
      selectedLayerId: null,
      cropSelection: null,
      cropAspectRatio: null,
      editorZoom: 1,
      editorOffsetX: 0,
      editorOffsetY: 0,
    };
    this.idCounter = 1;
  }

  /**
   * @return {string}
   */
  nextLayerId() {
    const id = `layer-${this.idCounter}`;
    this.idCounter += 1;
    return id;
  }

  /**
   * @return {number}
   */
  getLayerIdCounter() {
    return this.idCounter;
  }

  /**
   * @param {number} nextValue
   * @return {void}
   */
  setLayerIdCounter(nextValue) {
    const parsed = Number(nextValue);
    this.idCounter =
      Number.isFinite(parsed) && parsed > 1 ? Math.floor(parsed) : 1;
  }
}

const editorStateStore = new EditorStateStore();

export const state = editorStateStore.state;

export function nextLayerId() {
  return editorStateStore.nextLayerId();
}

export function getLayerIdCounter() {
  return editorStateStore.getLayerIdCounter();
}

export function setLayerIdCounter(nextValue) {
  editorStateStore.setLayerIdCounter(nextValue);
}
