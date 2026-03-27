import { DragSelectionRuntime } from "./DragSelectionRuntime.js";

/**
 * @typedef {Object} DragSelectionControllerOptions
 * @property {HTMLElement} stage - Stage element that receives pointer events.
 * @property {HTMLElement} marquee - Marquee element shown during selection interactions.
 * @property {(opts?: {rerenderOptions?: boolean, rerenderLayersPanel?: boolean}) => void} refresh - UI refresh callback.
 * @property {() => void} [onCommit] - Called after a completed interaction mutates state.
 * @property {(layerId: string) => void} [onTextLayerTripleClick] - Called when a text layer is triple-clicked.
 */

/**
 * Facade that wires drag selection runtime into the app lifecycle.
 */
export class DragSelectionController {
  /**
   * @param {DragSelectionControllerOptions} options - Dependencies for drag selection runtime.
   */
  constructor(options) {
    this.runtime = new DragSelectionRuntime(options);
  }

  /**
   * Attaches pointer listeners for drag selection interactions.
   * @return {void}
   */
  attach() {
    this.runtime.attach();
  }
}

/**
 * Creates and attaches drag selection behavior.
 * @param {DragSelectionControllerOptions} options - Dependencies for drag selection runtime.
 * @return {void}
 */
export function attachDragSelection(options) {
  new DragSelectionController(options).attach();
}
