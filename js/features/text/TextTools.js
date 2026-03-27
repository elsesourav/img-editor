function normalizeHexColor(value, fallback = "#000000") {
  const candidate = String(value || "").trim();
  const withHash = candidate.startsWith("#") ? candidate : `#${candidate}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return fallback;
  }
  return withHash.toUpperCase();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FONT_GROUPS = [
  {
    label: "Sans Serif",
    items: ["Arial", "Verdana", "Trebuchet MS", "Tahoma", "Helvetica"],
  },
  {
    label: "Serif",
    items: ["Georgia", "Times New Roman", "Garamond"],
  },
  {
    label: "Monospace",
    items: ["Courier New", "Menlo", "Monaco"],
  },
];

const FONT_SIZE_PRESETS = [24, 32, 48, 64, 72, 96, 120, 160];

const FONT_WEIGHT_OPTIONS = [
  { value: 100, label: "100 Thin" },
  { value: 200, label: "200 Extra Light" },
  { value: 300, label: "300 Light" },
  { value: 400, label: "400 Regular" },
  { value: 500, label: "500 Medium" },
  { value: 600, label: "600 Semi Bold" },
  { value: 700, label: "700 Bold" },
  { value: 800, label: "800 Extra Bold" },
  { value: 900, label: "900 Black" },
];

function buildFontFamilyOptions() {
  return FONT_GROUPS.flatMap((group) =>
    group.items.map((font) => ({ value: font, label: font })),
  );
}

function createTextToolsRuntime({
  createLayer,
  state,
  setSelectedLayer,
  bringLayerToFront,
  refresh,
  commitHistory,
  createOptionRow,
  createSelectInput,
  appendOptionDivider,
}) {
  function getDefaultTextMeta() {
    return {
      content: "Text",
      color: "#FFFFFF",
      fontSize: 72,
      fontWeight: 700,
      fontFamily: "Arial",
    };
  }

  function ensureLayerTextDefaults(layer) {
    if (!layer?.textMeta) return;
    layer.textMeta = getTextMetaFromLayer(layer);
    if (!layer.cropBackgroundMode) {
      layer.cropBackgroundMode = "transparent";
    }
    if (!layer.cropBackgroundColor) {
      layer.cropBackgroundColor = "#ffffff";
    }
  }

  function getTextMetaFromLayer(layer) {
    const defaults = getDefaultTextMeta();
    const current = layer?.textMeta || {};
    const content = String(current.content || defaults.content).slice(0, 240);

    return {
      content: content || defaults.content,
      color: normalizeHexColor(current.color, defaults.color),
      fontSize: Math.max(
        12,
        Math.min(280, Number(current.fontSize) || defaults.fontSize),
      ),
      fontWeight: Math.max(
        100,
        Math.min(900, Number(current.fontWeight) || defaults.fontWeight),
      ),
      fontFamily:
        String(current.fontFamily || defaults.fontFamily).trim() ||
        defaults.fontFamily,
    };
  }

  function buildTextLayerAsset(metaInput) {
    const meta = getTextMetaFromLayer({ textMeta: metaInput });
    const lines = meta.content
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
    const safeLines = lines.length ? lines : ["Text"];

    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    const fontSpec = `${meta.fontWeight} ${meta.fontSize}px ${meta.fontFamily}`;
    let maxWidth = meta.fontSize * 1.6;
    if (measureCtx) {
      measureCtx.font = fontSpec;
      for (const line of safeLines) {
        maxWidth = Math.max(maxWidth, measureCtx.measureText(line).width);
      }
    }

    const lineHeight = Math.round(meta.fontSize * 1.22);
    const paddingX = Math.max(14, Math.round(meta.fontSize * 0.35));
    const paddingY = Math.max(12, Math.round(meta.fontSize * 0.3));
    const width = Math.max(32, Math.ceil(maxWidth + paddingX * 2));
    const height = Math.max(
      32,
      Math.ceil(safeLines.length * lineHeight + paddingY * 2),
    );

    const textNodes = safeLines
      .map((line, index) => {
        const y = paddingY + Math.round(meta.fontSize) + index * lineHeight;
        return `<text x="${paddingX}" y="${y}" fill="${meta.color}" font-family="${escapeXml(meta.fontFamily)}" font-size="${Math.round(meta.fontSize)}" font-weight="${Math.round(meta.fontWeight)}">${escapeXml(line)}</text>`;
      })
      .join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${textNodes}</svg>`;
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    return { src, width, height, meta };
  }

  function getPresetSizeValue(size) {
    return FONT_SIZE_PRESETS.includes(size) ? String(size) : "custom";
  }

  function openTextLayerPopup(initialMeta) {
    const start = getTextMetaFromLayer({ textMeta: initialMeta });

    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "text-popup-backdrop";

      const modal = document.createElement("div");
      modal.className = "text-popup";

      const title = document.createElement("h3");
      title.className = "text-popup-title";
      title.textContent = "Add Text";

      const contentLabel = document.createElement("label");
      contentLabel.className = "text-popup-label";
      contentLabel.textContent = "Text";
      const contentInput = document.createElement("textarea");
      contentInput.className = "text-popup-textarea";
      contentInput.rows = 4;
      contentInput.value = start.content;

      const familyLabel = document.createElement("label");
      familyLabel.className = "text-popup-label";
      familyLabel.textContent = "Font Family";
      const familySelect = document.createElement("select");
      familySelect.className = "text-popup-input";
      for (const group of FONT_GROUPS) {
        const groupEl = document.createElement("optgroup");
        groupEl.label = group.label;
        for (const font of group.items) {
          const option = document.createElement("option");
          option.value = font;
          option.textContent = font;
          groupEl.appendChild(option);
        }
        familySelect.appendChild(groupEl);
      }
      familySelect.value = start.fontFamily;

      const row = document.createElement("div");
      row.className = "text-popup-row";

      const sizeWrap = document.createElement("div");
      const sizeLabel = document.createElement("label");
      sizeLabel.className = "text-popup-label";
      sizeLabel.textContent = "Size";
      const sizePresetSelect = document.createElement("select");
      sizePresetSelect.className = "text-popup-input";
      for (const preset of FONT_SIZE_PRESETS) {
        const option = document.createElement("option");
        option.value = String(preset);
        option.textContent = `${preset}px`;
        sizePresetSelect.appendChild(option);
      }
      const customSizeOption = document.createElement("option");
      customSizeOption.value = "custom";
      customSizeOption.textContent = "Custom";
      sizePresetSelect.appendChild(customSizeOption);

      const sizeInput = document.createElement("input");
      sizeInput.type = "number";
      sizeInput.min = "12";
      sizeInput.max = "280";
      sizeInput.className = "text-popup-input";
      sizeInput.value = String(start.fontSize);
      sizePresetSelect.value = getPresetSizeValue(start.fontSize);

      const sizeInline = document.createElement("div");
      sizeInline.className = "option-input-combo";
      sizeInline.appendChild(sizePresetSelect);
      sizeInline.appendChild(sizeInput);

      sizeWrap.appendChild(sizeLabel);
      sizeWrap.appendChild(sizeInline);

      const weightWrap = document.createElement("div");
      const weightLabel = document.createElement("label");
      weightLabel.className = "text-popup-label";
      weightLabel.textContent = "Weight";
      const weightInput = document.createElement("select");
      weightInput.className = "text-popup-input";
      for (const optionMeta of FONT_WEIGHT_OPTIONS) {
        const option = document.createElement("option");
        option.value = String(optionMeta.value);
        option.textContent = optionMeta.label;
        weightInput.appendChild(option);
      }
      weightInput.value = String(
        Math.max(100, Math.min(900, Math.round(start.fontWeight / 100) * 100)),
      );
      weightWrap.appendChild(weightLabel);
      weightWrap.appendChild(weightInput);

      const colorWrap = document.createElement("div");
      const colorLabel = document.createElement("label");
      colorLabel.className = "text-popup-label";
      colorLabel.textContent = "Color";
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.className = "text-popup-color";
      colorInput.value = start.color;
      colorWrap.appendChild(colorLabel);
      colorWrap.appendChild(colorInput);

      row.appendChild(sizeWrap);
      row.appendChild(weightWrap);
      row.appendChild(colorWrap);

      const previewLabel = document.createElement("label");
      previewLabel.className = "text-popup-label";
      previewLabel.textContent = "Preview";
      const preview = document.createElement("div");
      preview.className = "text-popup-preview";

      const actions = document.createElement("div");
      actions.className = "text-popup-actions";
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "button";
      cancelButton.textContent = "Cancel";
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "button";
      addButton.textContent = "Add Text";
      actions.appendChild(cancelButton);
      actions.appendChild(addButton);

      modal.appendChild(title);
      modal.appendChild(contentLabel);
      modal.appendChild(contentInput);
      modal.appendChild(familyLabel);
      modal.appendChild(familySelect);
      modal.appendChild(row);
      modal.appendChild(previewLabel);
      modal.appendChild(preview);
      modal.appendChild(actions);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      const getPopupSize = () => {
        const value = Number(sizeInput.value);
        return Math.max(
          12,
          Math.min(280, Number.isFinite(value) ? value : start.fontSize),
        );
      };

      const getPopupWeight = () => {
        const value = Number(weightInput.value);
        return Math.max(
          100,
          Math.min(900, Number.isFinite(value) ? value : start.fontWeight),
        );
      };

      sizePresetSelect.addEventListener("change", () => {
        if (sizePresetSelect.value === "custom") return;
        sizeInput.value = sizePresetSelect.value;
        updatePreview();
      });

      sizeInput.addEventListener("input", () => {
        sizePresetSelect.value = getPresetSizeValue(Math.round(getPopupSize()));
        updatePreview();
      });

      const updatePreview = () => {
        const fontSize = getPopupSize();
        const fontWeight = getPopupWeight();
        preview.style.color = normalizeHexColor(colorInput.value, start.color);
        preview.style.fontFamily = familySelect.value || start.fontFamily;
        preview.style.fontSize = `${fontSize}px`;
        preview.style.fontWeight = String(fontWeight);
        preview.textContent = String(contentInput.value || "Text");
      };

      const close = (result) => {
        backdrop.remove();
        resolve(result);
      };

      cancelButton.addEventListener("click", () => close(null));
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) close(null);
      });

      const submit = () => {
        close({
          content: String(contentInput.value || "Text"),
          color: normalizeHexColor(colorInput.value, start.color),
          fontSize: getPopupSize(),
          fontWeight: getPopupWeight(),
          fontFamily: String(familySelect.value || start.fontFamily),
        });
      };

      addButton.addEventListener("click", submit);
      contentInput.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      });

      for (const control of [
        contentInput,
        familySelect,
        weightInput,
        colorInput,
      ]) {
        control.addEventListener("input", updatePreview);
      }

      updatePreview();
      contentInput.focus();
      contentInput.select();
    });
  }

  function applyTextMetaToLayer(layer, nextMeta, { commit = false } = {}) {
    if (!layer) return;
    const asset = buildTextLayerAsset(nextMeta);
    layer.textMeta = asset.meta;
    layer.src = asset.src;
    layer.width = asset.width;
    layer.height = asset.height;
    refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    if (commit) {
      commitHistory();
    }
  }

  async function createTextLayer() {
    const nextMeta = await openTextLayerPopup(getDefaultTextMeta());
    if (!nextMeta) return;

    const asset = buildTextLayerAsset(nextMeta);
    const layer = createLayer(asset.src, asset.width, asset.height);
    layer.textMeta = asset.meta;
    layer.cropBackgroundMode = "transparent";
    layer.cropBackgroundColor = "#ffffff";

    state.layers.push(layer);
    setSelectedLayer(layer.id);
    bringLayerToFront(layer.id);
    refresh();
    commitHistory();
  }

  function renderMoveTextOptions(selected, optionsPanel) {
    if (!selected?.textMeta) return;

    const textMeta = getTextMetaFromLayer(selected);

    appendOptionDivider();
    const textCaption = document.createElement("div");
    textCaption.className = "option-caption";
    textCaption.textContent = "Text";
    optionsPanel.appendChild(textCaption);

    const textContent = document.createElement("textarea");
    textContent.className = "option-textarea";
    textContent.rows = 4;
    textContent.value = textMeta.content;
    textContent.placeholder = "Write text...";
    textContent.addEventListener("input", () => {
      applyTextMetaToLayer(selected, {
        ...getTextMetaFromLayer(selected),
        content: textContent.value,
      });
    });
    textContent.addEventListener("change", () => {
      applyTextMetaToLayer(
        selected,
        {
          ...getTextMetaFromLayer(selected),
          content: textContent.value,
        },
        { commit: true },
      );
    });
    optionsPanel.appendChild(createOptionRow("Content", textContent));

    const fontFamilyInput = createSelectInput(
      buildFontFamilyOptions(),
      textMeta.fontFamily,
      (nextValue) => {
        applyTextMetaToLayer(
          selected,
          {
            ...getTextMetaFromLayer(selected),
            fontFamily: nextValue,
          },
          { commit: true },
        );
      },
    );
    optionsPanel.appendChild(createOptionRow("Font", fontFamilyInput));

    const sizeControl = document.createElement("div");
    sizeControl.className = "option-input-combo";
    const sizePresetInput = document.createElement("select");
    sizePresetInput.className = "option-select";
    for (const preset of FONT_SIZE_PRESETS) {
      const option = document.createElement("option");
      option.value = String(preset);
      option.textContent = `${preset}px`;
      sizePresetInput.appendChild(option);
    }
    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = "Custom";
    sizePresetInput.appendChild(customOption);

    const sizeCustomInput = document.createElement("input");
    sizeCustomInput.type = "number";
    sizeCustomInput.min = "12";
    sizeCustomInput.max = "280";
    sizeCustomInput.step = "1";
    sizeCustomInput.value = String(textMeta.fontSize);
    sizePresetInput.value = getPresetSizeValue(textMeta.fontSize);

    const getMoveSize = () => {
      const parsed = Number(sizeCustomInput.value);
      if (!Number.isFinite(parsed)) return textMeta.fontSize;
      return Math.max(12, Math.min(280, Math.round(parsed)));
    };

    sizePresetInput.addEventListener("change", () => {
      if (sizePresetInput.value === "custom") return;
      sizeCustomInput.value = sizePresetInput.value;
      applyTextMetaToLayer(
        selected,
        {
          ...getTextMetaFromLayer(selected),
          fontSize: getMoveSize(),
        },
        { commit: true },
      );
    });

    sizeCustomInput.addEventListener("input", () => {
      sizePresetInput.value = getPresetSizeValue(getMoveSize());
      applyTextMetaToLayer(selected, {
        ...getTextMetaFromLayer(selected),
        fontSize: getMoveSize(),
      });
    });

    sizeCustomInput.addEventListener("change", () => {
      applyTextMetaToLayer(
        selected,
        {
          ...getTextMetaFromLayer(selected),
          fontSize: getMoveSize(),
        },
        { commit: true },
      );
    });

    sizeControl.appendChild(sizePresetInput);
    sizeControl.appendChild(sizeCustomInput);
    optionsPanel.appendChild(createOptionRow("Size", sizeControl));

    const textWeightInput = document.createElement("select");
    textWeightInput.className = "option-select";
    for (const optionMeta of FONT_WEIGHT_OPTIONS) {
      const option = document.createElement("option");
      option.value = String(optionMeta.value);
      option.textContent = optionMeta.label;
      textWeightInput.appendChild(option);
    }
    const roundedWeight = Math.max(
      100,
      Math.min(900, Math.round(textMeta.fontWeight / 100) * 100),
    );
    textWeightInput.value = String(roundedWeight);
    textWeightInput.addEventListener("change", () => {
      applyTextMetaToLayer(
        selected,
        {
          ...getTextMetaFromLayer(selected),
          fontWeight: Number(textWeightInput.value),
        },
        { commit: true },
      );
    });
    optionsPanel.appendChild(createOptionRow("Weight", textWeightInput));

    const textColorInput = document.createElement("input");
    textColorInput.type = "color";
    textColorInput.value = textMeta.color;
    textColorInput.addEventListener("input", () => {
      applyTextMetaToLayer(selected, {
        ...getTextMetaFromLayer(selected),
        color: textColorInput.value,
      });
    });
    textColorInput.addEventListener("change", () => {
      applyTextMetaToLayer(
        selected,
        {
          ...getTextMetaFromLayer(selected),
          color: textColorInput.value,
        },
        { commit: true },
      );
    });
    optionsPanel.appendChild(createOptionRow("Color", textColorInput));

    appendOptionDivider();
    const bgCaption = document.createElement("div");
    bgCaption.className = "option-caption";
    bgCaption.textContent = "Text BG";
    optionsPanel.appendChild(bgCaption);

    const bgModeInput = createSelectInput(
      [
        { value: "transparent", label: "Transparent" },
        { value: "solid", label: "Solid" },
      ],
      selected.cropBackgroundMode || "transparent",
      (nextMode) => {
        selected.cropBackgroundMode = nextMode;
        textBgColorInput.disabled = nextMode === "transparent";
        refresh({ rerenderOptions: false, rerenderLayersPanel: false });
        commitHistory();
      },
    );
    optionsPanel.appendChild(createOptionRow("Mode", bgModeInput));

    const textBgColorInput = document.createElement("input");
    textBgColorInput.type = "color";
    textBgColorInput.value = normalizeHexColor(
      selected.cropBackgroundColor,
      "#ffffff",
    );
    textBgColorInput.disabled =
      (selected.cropBackgroundMode || "transparent") === "transparent";
    textBgColorInput.addEventListener("input", () => {
      selected.cropBackgroundColor = normalizeHexColor(
        textBgColorInput.value,
        "#ffffff",
      );
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
    });
    textBgColorInput.addEventListener("change", () => {
      selected.cropBackgroundColor = normalizeHexColor(
        textBgColorInput.value,
        "#ffffff",
      );
      refresh({ rerenderOptions: false, rerenderLayersPanel: false });
      commitHistory();
    });
    optionsPanel.appendChild(createOptionRow("Color", textBgColorInput));
  }

  return {
    createTextLayer,
    ensureLayerTextDefaults,
    renderMoveTextOptions,
    applyTextMetaToLayer,
  };
}

/**
 * Class-backed text tools facade.
 */
class TextToolsController {
  /**
   * @param {Object} deps
   */
  constructor(deps) {
    this.impl = createTextToolsRuntime(deps);
  }

  async createTextLayer() {
    await this.impl.createTextLayer();
  }

  ensureLayerTextDefaults(layer) {
    this.impl.ensureLayerTextDefaults(layer);
  }

  renderMoveTextOptions(selected, optionsPanel) {
    this.impl.renderMoveTextOptions(selected, optionsPanel);
  }

  /**
   * @param {any} layer
   * @param {any} nextMeta
   * @param {{commit?: boolean}} options
   * @return {void}
   */
  applyTextMetaToLayer(layer, nextMeta, options = {}) {
    this.impl.applyTextMetaToLayer(layer, nextMeta, options);
  }
}

export function createTextTools(deps) {
  return new TextToolsController(deps);
}
