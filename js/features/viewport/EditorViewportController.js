function clampZoom(value, minZoom, maxZoom) {
  return Math.max(minZoom, Math.min(maxZoom, value));
}

function isZoomInShortcut(event) {
  return (
    event.key === "+" ||
    event.key === "=" ||
    event.key === "Add" ||
    (event.code === "Equal" && event.shiftKey)
  );
}

function isZoomOutShortcut(event) {
  return (
    event.key === "-" ||
    event.key === "_" ||
    event.key === "Subtract" ||
    event.code === "Minus"
  );
}

/**
 * Class-based viewport controller for zoom and pan transform behavior.
 */
class EditorViewportController {
  /**
   * @param {Object} config
   */
  constructor({
    state,
    stage,
    zoomOut,
    zoomIn,
    zoomReset,
    buttonZoomStep,
    wheelZoomStep,
    minZoom = 0.5,
    maxZoom = 3,
    onViewportUpdated,
  }) {
    this.state = state;
    this.stage = stage;
    this.zoomOut = zoomOut;
    this.zoomIn = zoomIn;
    this.zoomReset = zoomReset;
    this.buttonZoomStep = buttonZoomStep;
    this.wheelZoomStep = wheelZoomStep;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.onViewportUpdated = onViewportUpdated;
  }

  /**
   * @return {void}
   */
  triggerViewportUpdate() {
    if (typeof this.onViewportUpdated === "function") {
      this.onViewportUpdated();
    }
  }

  /**
   * @return {void}
   */
  applyViewportTransform() {
    this.stage.style.setProperty("--editor-zoom", String(this.state.editorZoom));
    this.stage.style.setProperty("--editor-offset-x", `${this.state.editorOffsetX}px`);
    this.stage.style.setProperty("--editor-offset-y", `${this.state.editorOffsetY}px`);

    const gridSize = 32 * this.state.editorZoom;
    const gridOffsetX =
      ((this.state.editorOffsetX % gridSize) + gridSize) % gridSize;
    const gridOffsetY =
      ((this.state.editorOffsetY % gridSize) + gridSize) % gridSize;
    this.stage.style.setProperty("--grid-size", `${gridSize}px`);
    this.stage.style.setProperty("--grid-offset-x", `${gridOffsetX}px`);
    this.stage.style.setProperty("--grid-offset-y", `${gridOffsetY}px`);

    if (this.zoomReset) {
      this.zoomReset.textContent = `${Math.round(this.state.editorZoom * 100)}%`;
    }
  }

  /**
   * @param {number} nextZoom
   * @param {{x:number,y:number}|null} anchorPoint
   * @return {void}
   */
  setZoom(nextZoom, anchorPoint = null) {
    const previousZoom = this.state.editorZoom;
    const clampedZoom = clampZoom(nextZoom, this.minZoom, this.maxZoom);

    if (clampedZoom === previousZoom) {
      this.applyViewportTransform();
      this.triggerViewportUpdate();
      return;
    }

    const defaultAnchor = {
      x: this.stage.clientWidth / 2,
      y: this.stage.clientHeight / 2,
    };
    const anchor = anchorPoint || defaultAnchor;

    const worldX = (anchor.x - this.state.editorOffsetX) / previousZoom;
    const worldY = (anchor.y - this.state.editorOffsetY) / previousZoom;

    this.state.editorZoom = clampedZoom;
    this.state.editorOffsetX = anchor.x - worldX * clampedZoom;
    this.state.editorOffsetY = anchor.y - worldY * clampedZoom;

    this.applyViewportTransform();
    this.triggerViewportUpdate();
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @return {{x:number,y:number}}
   */
  getWorldPointFromClient(clientX, clientY) {
    const stageRect = this.stage.getBoundingClientRect();
    const zoom = Math.max(0.001, this.state.editorZoom || 1);
    const offsetX = this.state.editorOffsetX || 0;
    const offsetY = this.state.editorOffsetY || 0;

    return {
      x: (clientX - stageRect.left - offsetX) / zoom,
      y: (clientY - stageRect.top - offsetY) / zoom,
    };
  }

  /**
   * @return {void}
   */
  setupZoomControls() {
    this.zoomOut.addEventListener("click", () => {
      this.setZoom(this.state.editorZoom - this.buttonZoomStep);
    });

    this.zoomIn.addEventListener("click", () => {
      this.setZoom(this.state.editorZoom + this.buttonZoomStep);
    });

    this.zoomReset.addEventListener("click", () => {
      this.setZoom(1);
    });

    this.stage.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey) return;

        event.preventDefault();
        const stageRect = this.stage.getBoundingClientRect();
        const anchor = {
          x: event.clientX - stageRect.left,
          y: event.clientY - stageRect.top,
        };
        const delta =
          event.deltaY > 0 ? -this.wheelZoomStep : this.wheelZoomStep;
        this.setZoom(this.state.editorZoom + delta, anchor);
      },
      { passive: false },
    );
  }

  /**
   * @return {void}
   */
  preventBrowserPinchZoom() {
    const preventPinch = (event) => {
      event.preventDefault();
    };

    window.addEventListener("gesturestart", preventPinch, { passive: false });
    window.addEventListener("gesturechange", preventPinch, { passive: false });
    window.addEventListener("gestureend", preventPinch, { passive: false });
    window.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
      },
      { passive: false },
    );

    window.addEventListener(
      "keydown",
      (event) => {
        const hasPrimaryModifier = event.ctrlKey || event.metaKey;
        if (!hasPrimaryModifier) return;

        if (
          isZoomInShortcut(event) ||
          isZoomOutShortcut(event) ||
          event.key === "0"
        ) {
          event.preventDefault();
        }
      },
      { passive: false },
    );
  }
}

export function createEditorViewportController(config) {
  return new EditorViewportController(config);
}
