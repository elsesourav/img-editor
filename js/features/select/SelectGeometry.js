import { state } from "../../state.js";

/**
 * @typedef {Object} StageViewport
 * @property {number} left - Stage left offset in client space.
 * @property {number} top - Stage top offset in client space.
 * @property {number} zoom - Active editor zoom.
 * @property {number} offsetX - Active editor X offset.
 * @property {number} offsetY - Active editor Y offset.
 */

/**
 * @typedef {Object} SelectionRect
 * @property {number} x - Rectangle X coordinate.
 * @property {number} y - Rectangle Y coordinate.
 * @property {number} width - Rectangle width.
 * @property {number} height - Rectangle height.
 */

/**
 * Converts client coordinates to stage coordinates.
 * @param {StageViewport} viewport - Cached viewport transform values.
 * @param {number} clientX - Pointer X in client coordinates.
 * @param {number} clientY - Pointer Y in client coordinates.
 * @return {{x:number,y:number}} - Point in stage/world coordinates.
 */
export function getStagePoint(viewport, clientX, clientY) {
  const zoom = Math.max(0.001, viewport.zoom || 1);
  const offsetX = viewport.offsetX || 0;
  const offsetY = viewport.offsetY || 0;
  return {
    x: (clientX - viewport.left - offsetX) / zoom,
    y: (clientY - viewport.top - offsetY) / zoom,
  };
}

/**
 * Captures the latest stage viewport values for pointer math.
 * @param {HTMLElement} stage - Stage root element.
 * @return {StageViewport} - Snapshot of stage viewport values.
 */
export function captureStageViewport(stage) {
  const rect = stage.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    zoom: Math.max(0.001, state.editorZoom || 1),
    offsetX: state.editorOffsetX || 0,
    offsetY: state.editorOffsetY || 0,
  };
}

/**
 * Checks whether a point is inside a layer rectangle.
 * @param {{x:number,y:number,width:number,height:number}} layer - Layer bounds.
 * @param {number} x - Point X.
 * @param {number} y - Point Y.
 * @return {boolean} - True when the point is inside the layer bounds.
 */
export function layerContainsPoint(layer, x, y) {
  return (
    x >= layer.x &&
    y >= layer.y &&
    x <= layer.x + layer.width &&
    y <= layer.y + layer.height
  );
}

/**
 * Resizes a rectangle from a drag handle while preserving minimum size.
 * @param {SelectionRect} start - Initial rectangle before resize.
 * @param {"n"|"e"|"s"|"w"|"nw"|"ne"|"sw"|"se"} handle - Active resize handle.
 * @param {number} deltaX - Pointer movement delta on X axis.
 * @param {number} deltaY - Pointer movement delta on Y axis.
 * @return {SelectionRect} - Resized rectangle.
 */
export function resizeSelectionRect(start, handle, deltaX, deltaY) {
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
