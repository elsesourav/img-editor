function hasPrimaryModifier(event) {
  return event.ctrlKey || event.metaKey;
}

function isTypingTarget(target) {
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
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

function isDuplicateShortcut(event) {
  if (!hasPrimaryModifier(event)) return false;
  return event.code === "KeyD" || event.key.toLowerCase() === "d";
}

/**
 * @typedef {Object} KeyboardShortcutHandlers
 * @property {() => any} getHistoryManager
 * @property {() => void} updateHistoryButtons
 * @property {() => void} onDuplicate
 * @property {() => void} onZoomIn
 * @property {() => void} onZoomOut
 * @property {() => void} onZoomReset
 * @property {() => boolean} isEyedropperActive
 * @property {() => void} onDisableEyedropper
 * @property {() => void} onDelete
 * @property {() => void} onMoveMode
 * @property {() => void} onCropMode
 * @property {() => void} onRotateMode
 * @property {() => void} [onFilterMode]
 * @property {() => void} [onShadowMode]
 * @property {() => boolean} isCropMode
 * @property {() => boolean} isRotateMode
 * @property {() => boolean} [isFilterMode]
 * @property {() => boolean} [isShadowMode]
 * @property {() => void} onApplyCrop
 * @property {() => void} onApplyRotate
 * @property {() => void} [onApplyFilter]
 * @property {() => void} [onApplyShadow]
 * @property {() => void} onExport
 * @property {(dx:number, dy:number) => void} onNudge
 */

/**
 * Wires editor keyboard shortcut behavior.
 */
class KeyboardShortcutsController {
  /**
   * @param {KeyboardShortcutHandlers} handlers
   */
  constructor(handlers) {
    this.handlers = handlers;
  }

  /**
   * @return {void}
   */
  setup() {
    const {
      getHistoryManager,
      updateHistoryButtons,
      onDuplicate,
      onZoomIn,
      onZoomOut,
      onZoomReset,
      isEyedropperActive,
      onDisableEyedropper,
      onDelete,
      onMoveMode,
      onCropMode,
      onRotateMode,
      onFilterMode,
      onShadowMode,
      isCropMode,
      isRotateMode,
      isFilterMode,
      isShadowMode,
      onApplyCrop,
      onApplyRotate,
      onApplyFilter,
      onApplyShadow,
      onExport,
      onNudge,
    } = this.handlers;

    window.addEventListener("keydown", (event) => {
      if (hasPrimaryModifier(event) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          getHistoryManager()?.redo();
        } else {
          getHistoryManager()?.undo();
        }
        updateHistoryButtons();
        return;
      }

      if (hasPrimaryModifier(event) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        getHistoryManager()?.redo();
        updateHistoryButtons();
        return;
      }

      if (isDuplicateShortcut(event) && !isTypingTarget(event.target)) {
        event.preventDefault();
        onDuplicate();
        return;
      }

      if (hasPrimaryModifier(event) && isZoomInShortcut(event)) {
        event.preventDefault();
        onZoomIn();
        return;
      }

      if (hasPrimaryModifier(event) && isZoomOutShortcut(event)) {
        event.preventDefault();
        onZoomOut();
        return;
      }

      if (hasPrimaryModifier(event) && event.key === "0") {
        event.preventDefault();
        onZoomReset();
        return;
      }

      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape" && isEyedropperActive()) {
        event.preventDefault();
        onDisableEyedropper();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onDelete();
        return;
      }

      if (event.key.toLowerCase() === "v" || event.key.toLowerCase() === "m") {
        event.preventDefault();
        onMoveMode();
        return;
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        onCropMode();
        return;
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        onRotateMode();
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (typeof onFilterMode === "function") {
          onFilterMode();
        }
        return;
      }

      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        if (typeof onShadowMode === "function") {
          onShadowMode();
        }
        return;
      }

      if (event.key === "Enter" && isCropMode()) {
        event.preventDefault();
        onApplyCrop();
        return;
      }

      if (event.key === "Enter" && isRotateMode()) {
        event.preventDefault();
        onApplyRotate();
        return;
      }

      if (
        event.key === "Enter" &&
        typeof isFilterMode === "function" &&
        isFilterMode()
      ) {
        event.preventDefault();
        if (typeof onApplyFilter === "function") {
          onApplyFilter();
        }
        return;
      }

      if (
        event.key === "Enter" &&
        typeof isShadowMode === "function" &&
        isShadowMode()
      ) {
        event.preventDefault();
        if (typeof onApplyShadow === "function") {
          onApplyShadow();
        }
        return;
      }

      if (hasPrimaryModifier(event) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        onExport();
        return;
      }

      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowLeft") onNudge(-step, 0);
        if (event.key === "ArrowRight") onNudge(step, 0);
        if (event.key === "ArrowUp") onNudge(0, -step);
        if (event.key === "ArrowDown") onNudge(0, step);
      }
    });
  }
}

export function setupKeyboardShortcuts(handlers) {
  new KeyboardShortcutsController(handlers).setup();
}
