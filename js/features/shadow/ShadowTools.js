function normalizeHexColor(value, fallback = "#000000") {
  const candidate = String(value || "").trim();
  const withHash = candidate.startsWith("#") ? candidate : `#${candidate}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return fallback;
  }
  return withHash.toUpperCase();
}

function createShadowToolsRuntime({
  getLayerById,
  getLayerShadowStyle,
  refresh,
  commitHistory,
  createOptionRow,
  createFilterControl,
  appendOptionDivider,
  createInlineNameEditor,
}) {
  const shadowDraftSnapshots = new Map();

  function getDefaultShadowStyle() {
    return {
      enabled: false,
      mode: "object",
      x: 0,
      y: 0,
      blur: 5,
      opacity: 45,
      color: "#000000",
      strokeSize: 0,
      strokeColor: "#000000",
      strokeOpacity: 100,
    };
  }

  function ensureLayerShadowDefaults(layer) {
    const defaults = getDefaultShadowStyle();
    const current = layer.shadowStyle || {};

    layer.shadowStyle = {
      enabled: Boolean(current.enabled),
      mode: "object",
      x: Number.isFinite(Number(current.x)) ? Number(current.x) : defaults.x,
      y: Number.isFinite(Number(current.y)) ? Number(current.y) : defaults.y,
      blur: Number.isFinite(Number(current.blur))
        ? Math.max(0, Number(current.blur))
        : defaults.blur,
      opacity: Number.isFinite(Number(current.opacity))
        ? Math.max(0, Math.min(100, Number(current.opacity)))
        : defaults.opacity,
      color: normalizeHexColor(current.color, defaults.color),
      strokeSize: Number.isFinite(Number(current.strokeSize))
        ? Math.max(0, Number(current.strokeSize))
        : defaults.strokeSize,
      strokeColor: normalizeHexColor(current.strokeColor, defaults.strokeColor),
      strokeOpacity: Number.isFinite(Number(current.strokeOpacity))
        ? Math.max(0, Math.min(100, Number(current.strokeOpacity)))
        : defaults.strokeOpacity,
    };
  }

  function startShadowDraft(layer) {
    if (!layer || shadowDraftSnapshots.has(layer.id)) return;
    ensureLayerShadowDefaults(layer);
    shadowDraftSnapshots.set(layer.id, {
      shadowStyle: { ...layer.shadowStyle },
    });
  }

  function revertShadowDraft(layerId) {
    if (!layerId || !shadowDraftSnapshots.has(layerId)) return;
    const layer = getLayerById(layerId);
    const snapshot = shadowDraftSnapshots.get(layerId);
    shadowDraftSnapshots.delete(layerId);
    if (!layer || !snapshot) return;
    layer.shadowStyle = { ...snapshot.shadowStyle };
  }

  function clearShadowDraft(layerId) {
    if (!layerId) return;
    shadowDraftSnapshots.delete(layerId);
  }

  function clearAllShadowDrafts() {
    for (const layerId of shadowDraftSnapshots.keys()) {
      revertShadowDraft(layerId);
    }
  }

  function applyShadowSelection(selectedLayerId) {
    if (!selectedLayerId) return;
    clearShadowDraft(selectedLayerId);
    refresh({ rerenderOptions: true, rerenderLayersPanel: false });
    commitHistory();
  }

  function handleModeChange(prevMode, nextMode) {
    if (prevMode === "shadow-adjust" && nextMode !== "shadow-adjust") {
      clearAllShadowDrafts();
    }
  }

  function beginShadowPreview(selectedLayerId) {
    if (!selectedLayerId) return;
    const selected = getLayerById(selectedLayerId);
    if (!selected) return;

    ensureLayerShadowDefaults(selected);
    startShadowDraft(selected);
    selected.shadowStyle.enabled = true;
  }

  function renderShadowOptions(
    selected,
    optionsPanel,
    { isEyedropperActive, setEyedropperActive },
  ) {
    if (isEyedropperActive()) {
      setEyedropperActive(false);
    }

    optionsPanel.innerHTML = "";
    ensureLayerShadowDefaults(selected);
    const shadowStyle = getLayerShadowStyle(selected);

    const nameEditor = createInlineNameEditor(selected.id);
    optionsPanel.appendChild(createOptionRow("Name", nameEditor));
    appendOptionDivider();

    const addShadowControl = (
      label,
      key,
      min,
      max,
      step = 1,
      {
        formatValue = (nextValue) => String(Math.round(nextValue)),
        toUiValue = (rawValue) => rawValue,
        fromUiValue = (uiValue) => uiValue,
      } = {},
    ) => {
      const rawValue = Number(selected.shadowStyle?.[key]) || 0;
      const control = createFilterControl({
        min,
        max,
        step,
        value: toUiValue(rawValue),
        formatValue,
        onPreview: (uiValue) => {
          startShadowDraft(selected);
          selected.shadowStyle[key] = fromUiValue(uiValue);
          refresh({ rerenderOptions: false, rerenderLayersPanel: false });
        },
        onCommit: () => {},
      });
      optionsPanel.appendChild(createOptionRow(label, control));
    };

    appendOptionDivider();
    addShadowControl("Offset X", "x", -200, 200, 1);
    addShadowControl("Offset Y", "y", -200, 200, 1);
    addShadowControl("Blur", "blur", 0, 30, 1);
    addShadowControl("Opacity", "opacity", 0, 100, 1);

    const shadowColorInput = document.createElement("input");
    shadowColorInput.type = "color";
    shadowColorInput.value = shadowStyle.color;
    shadowColorInput.setAttribute("aria-label", "Shadow color");
    shadowColorInput.addEventListener("input", () => {
      startShadowDraft(selected);
      selected.shadowStyle.color = shadowColorInput.value.toUpperCase();
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    });
    optionsPanel.appendChild(createOptionRow("Color", shadowColorInput));

    appendOptionDivider();
    const strokeCaption = document.createElement("div");
    strokeCaption.className = "option-caption";
    strokeCaption.textContent = "Stroke";
    optionsPanel.appendChild(strokeCaption);

    addShadowControl("Size", "strokeSize", 0, 200, 1, {
      formatValue: (nextValue) => String(Math.round(nextValue)),
      toUiValue: (rawValue) => rawValue * 10,
      fromUiValue: (uiValue) => uiValue / 10,
    });

    const strokeColorInput = document.createElement("input");
    strokeColorInput.type = "color";
    strokeColorInput.value = shadowStyle.strokeColor;
    strokeColorInput.setAttribute("aria-label", "Stroke color");
    strokeColorInput.addEventListener("input", () => {
      startShadowDraft(selected);
      selected.shadowStyle.strokeColor = strokeColorInput.value.toUpperCase();
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    });
    optionsPanel.appendChild(createOptionRow("Stroke Color", strokeColorInput));

    addShadowControl("BG Opacity", "strokeOpacity", 0, 100, 1);

    appendOptionDivider();

    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.className = "button option-button";
    applyButton.textContent = "Apply";
    applyButton.setAttribute("data-hint", "Apply (Enter)");
    applyButton.addEventListener("click", () => {
      applyShadowSelection(selected.id);
    });
    const applyRow = createOptionRow("", applyButton);
    applyRow.classList.add("full");
    optionsPanel.appendChild(applyRow);
  }

  return {
    applyShadowSelection,
    beginShadowPreview,
    ensureLayerShadowDefaults,
    handleModeChange,
    renderShadowOptions,
  };
}

/**
 * Class-backed shadow tools facade.
 */
class ShadowToolsController {
  /**
   * @param {Object} deps
   */
  constructor(deps) {
    this.impl = createShadowToolsRuntime(deps);
  }

  applyShadowSelection(selectedLayerId) {
    this.impl.applyShadowSelection(selectedLayerId);
  }

  beginShadowPreview(selectedLayerId) {
    this.impl.beginShadowPreview(selectedLayerId);
  }

  ensureLayerShadowDefaults(layer) {
    this.impl.ensureLayerShadowDefaults(layer);
  }

  handleModeChange(prevMode, nextMode) {
    this.impl.handleModeChange(prevMode, nextMode);
  }

  renderShadowOptions(selected, optionsPanel, options) {
    this.impl.renderShadowOptions(selected, optionsPanel, options);
  }
}

export function createShadowTools(deps) {
  return new ShadowToolsController(deps);
}
