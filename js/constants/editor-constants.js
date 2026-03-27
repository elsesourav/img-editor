/**
 * Shared editor constants and presets.
 */
export class EditorConstants {
  static BUTTON_ZOOM_STEP = 0.05;

  static WHEEL_ZOOM_STEP = 0.04;

  static KEYBOARD_ZOOM_STEP = 0.05;

  static MIN_LAYER_SIZE = 24;

  static PRESET_COLORS = [
    "#FFFFFF",
    "#000000",
    "#EF4444",
    "#F59E0B",
    "#FDE047",
    "#22C55E",
    "#06B6D4",
    "#3B82F6",
    "#A855F7",
    "#EC4899",
  ];

  static FILTER_PRESETS = {
    original: {
      brightness: 100,
      contrast: 100,
      saturate: 100,
      hue: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      blur: 0,
    },
    vivid: {
      brightness: 108,
      contrast: 118,
      saturate: 138,
      hue: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      blur: 0,
    },
    mono: {
      brightness: 100,
      contrast: 115,
      saturate: 0,
      hue: 0,
      grayscale: 100,
      sepia: 0,
      invert: 0,
      blur: 0,
    },
    warm: {
      brightness: 106,
      contrast: 110,
      saturate: 112,
      hue: -12,
      grayscale: 0,
      sepia: 28,
      invert: 0,
      blur: 0,
    },
    cool: {
      brightness: 102,
      contrast: 106,
      saturate: 108,
      hue: 16,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      blur: 0,
    },
    dramatic: {
      brightness: 95,
      contrast: 140,
      saturate: 120,
      hue: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      blur: 0.6,
    },
    dreamy: {
      brightness: 110,
      contrast: 90,
      saturate: 118,
      hue: 8,
      grayscale: 0,
      sepia: 10,
      invert: 0,
      blur: 1.2,
    },
  };

  static TOOLBAR_HINTS = {
    addAction: "Add Layer",
    textAction: "Add Text",
    customTemplateAction: "Custom Template",
    modeSelect: "Select Mode (M / V)",
    modeCrop: "Crop Mode (C)",
    modeRotate: "Rotate Mode (R)",
    modeFilter: "Filter Mode (F)",
    modeShadow: "Shadow Mode (H)",
    undoAction: "Undo (Ctrl/Cmd+Z)",
    redoAction: "Redo (Ctrl/Cmd+Shift+Z)",
    duplicateAction: "Duplicate (Ctrl/Cmd+D)",
    removeBgAction: "Remove Background",
    upscaleAction: "Upscale 2x",
    deleteAction: "Delete (Delete / Backspace)",
    exportSelected: "Export (Ctrl/Cmd+E)",
    saveTemplateAction: "Save Template",
    zoomOut: "Zoom Out (Ctrl/Cmd+-)",
    zoomReset: "Reset Zoom (Ctrl/Cmd+0)",
    zoomIn: "Zoom In (Ctrl/Cmd++)",
  };
}

export const BUTTON_ZOOM_STEP = EditorConstants.BUTTON_ZOOM_STEP;
export const WHEEL_ZOOM_STEP = EditorConstants.WHEEL_ZOOM_STEP;
export const KEYBOARD_ZOOM_STEP = EditorConstants.KEYBOARD_ZOOM_STEP;
export const MIN_LAYER_SIZE = EditorConstants.MIN_LAYER_SIZE;
export const PRESET_COLORS = EditorConstants.PRESET_COLORS;
export const FILTER_PRESETS = EditorConstants.FILTER_PRESETS;
export const TOOLBAR_HINTS = EditorConstants.TOOLBAR_HINTS;
