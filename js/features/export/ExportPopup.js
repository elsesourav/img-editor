let stylesMounted = false;

const FORMAT_CONFIG = {
  png: {
    label: "PNG",
    mimeType: "image/png",
    extension: "png",
    isLossy: false,
  },
  jpg: {
    label: "JPG",
    mimeType: "image/jpeg",
    extension: "jpg",
    isLossy: true,
  },
  jpeg: {
    label: "JPEG",
    mimeType: "image/jpeg",
    extension: "jpeg",
    isLossy: true,
  },
  webp: {
    label: "WebP",
    mimeType: "image/webp",
    extension: "webp",
    isLossy: true,
  },
};

function ensureStyles() {
  if (stylesMounted) return;
  stylesMounted = true;

  const style = document.createElement("style");
  style.textContent = `
    .export-popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 1200;
      background: rgba(0, 0, 0, 0.55);
      display: grid;
      place-items: center;
      padding: 16px;
    }

    .export-popup {
      width: min(520px, 100%);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      background: #111317;
      color: #e4e4e7;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      padding: 14px;
      display: grid;
      gap: 12px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
    }

    .export-popup-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .export-popup-group {
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 10px;
      display: grid;
      gap: 8px;
      background: rgba(255, 255, 255, 0.02);
    }

    .export-popup-group[hidden] {
      display: none;
    }

    .export-popup-row {
      display: grid;
      gap: 8px;
    }

    .export-popup-label {
      font-size: 11px;
      color: rgba(228, 228, 231, 0.78);
    }

    .export-popup-size-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .export-popup-field {
      display: grid;
      gap: 4px;
    }

    .export-popup-field span {
      font-size: 11px;
      color: rgba(228, 228, 231, 0.82);
    }

    .export-popup input[type="number"],
    .export-popup select {
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
      font-size: 12px;
      padding: 7px 8px;
    }

    .export-popup input:disabled,
    .export-popup select:disabled,
    .export-popup input[type="range"]:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .export-popup-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .export-popup-tab {
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
      color: #e4e4e7;
      font-size: 12px;
      padding: 8px 10px;
      cursor: pointer;
    }

    .export-popup-tab.active {
      border-color: rgba(167, 243, 208, 0.84);
      background: rgba(16, 185, 129, 0.18);
    }

    .export-popup-target-grid {
      display: grid;
      grid-template-columns: 1fr 90px;
      gap: 8px;
      align-items: center;
    }

    .export-popup-note {
      font-size: 11px;
      color: rgba(228, 228, 231, 0.7);
    }

    .export-popup-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .export-popup-btn {
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
      font-size: 12px;
      padding: 8px 12px;
      cursor: pointer;
    }

    .export-popup-btn.primary {
      border-color: rgba(167, 243, 208, 0.85);
      background: rgba(16, 185, 129, 0.2);
    }
  `;

  document.head.appendChild(style);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function detectSupportedFormats() {
  const testCanvas = document.createElement("canvas");
  const canUse = (mimeType) => {
    try {
      return testCanvas.toDataURL(mimeType).startsWith(`data:${mimeType}`);
    } catch {
      return false;
    }
  };

  const keys = ["png", "jpg", "jpeg"];
  if (canUse("image/webp")) {
    keys.push("webp");
  }

  return keys;
}

function isTargetCapableFormat(formatKey) {
  return FORMAT_CONFIG[formatKey]?.isLossy === true;
}

function openExportPopupRuntime({ width, height }) {
  ensureStyles();

  return new Promise((resolve) => {
    const supportedFormats = detectSupportedFormats();
    const initialWidth = Math.max(1, Math.round(width));
    const initialHeight = Math.max(1, Math.round(height));
    const ratio = initialWidth / Math.max(1, initialHeight);

    const formatOptions = supportedFormats
      .map(
        (key) => `<option value="${key}">${FORMAT_CONFIG[key].label}</option>`,
      )
      .join("");

    const overlay = document.createElement("div");
    overlay.className = "export-popup-overlay";
    overlay.innerHTML = `
      <div class="export-popup" role="dialog" aria-modal="true" aria-label="Export options">
        <h3 class="export-popup-title">Export Options</h3>

        <div class="export-popup-tabs">
          <button type="button" class="export-popup-tab active" data-role="tabQuality">Quality preset</button>
          <button type="button" class="export-popup-tab" data-role="tabTarget">Target file size</button>
        </div>

        <div class="export-popup-group">
          <div class="export-popup-row">
            <div class="export-popup-label">Format</div>
            <select data-role="format">${formatOptions}</select>
          </div>

          <div class="export-popup-row">
            <div class="export-popup-label">Size (ratio locked)</div>
            <div class="export-popup-size-grid">
              <label class="export-popup-field">
                <span>Width</span>
                <input type="number" data-role="width" min="1" step="1" />
              </label>
              <label class="export-popup-field">
                <span>Height</span>
                <input type="number" data-role="height" min="1" step="1" />
              </label>
            </div>
          </div>

          <div class="export-popup-note" data-role="formatNote"></div>
        </div>

        <div class="export-popup-group" data-role="qualityGroup">
          <div class="export-popup-row">
            <div class="export-popup-label">Quality</div>
            <select data-role="qualityPreset">
              <option value="original" selected>Original</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div class="export-popup-group" data-role="targetGroup" hidden>
          <div class="export-popup-row">
            <div class="export-popup-label">Target Size</div>
            <div class="export-popup-target-grid">
              <input type="range" data-role="targetSlider" min="50" max="5000" step="10" value="500" />
              <select data-role="targetUnit">
                <option value="KB" selected>KB</option>
                <option value="MB">MB</option>
              </select>
            </div>
            <input type="number" data-role="targetValue" min="1" step="1" value="500" />
            <div class="export-popup-note" data-role="targetNote">Approx target: 500 KB</div>
          </div>
        </div>

        <div class="export-popup-actions">
          <button type="button" class="export-popup-btn" data-role="cancel">Cancel</button>
          <button type="button" class="export-popup-btn primary" data-role="confirm">Export</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const widthInput = overlay.querySelector('[data-role="width"]');
    const heightInput = overlay.querySelector('[data-role="height"]');
    const formatSelect = overlay.querySelector('[data-role="format"]');
    const qualityPreset = overlay.querySelector('[data-role="qualityPreset"]');
    const qualityGroup = overlay.querySelector('[data-role="qualityGroup"]');
    const targetGroup = overlay.querySelector('[data-role="targetGroup"]');
    const targetSlider = overlay.querySelector('[data-role="targetSlider"]');
    const targetUnit = overlay.querySelector('[data-role="targetUnit"]');
    const targetValue = overlay.querySelector('[data-role="targetValue"]');
    const targetNote = overlay.querySelector('[data-role="targetNote"]');
    const formatNote = overlay.querySelector('[data-role="formatNote"]');
    const tabQuality = overlay.querySelector('[data-role="tabQuality"]');
    const tabTarget = overlay.querySelector('[data-role="tabTarget"]');
    const cancelButton = overlay.querySelector('[data-role="cancel"]');
    const confirmButton = overlay.querySelector('[data-role="confirm"]');
    let currentMode = "quality";

    widthInput.value = String(initialWidth);
    heightInput.value = String(initialHeight);
    formatSelect.value = supportedFormats.includes("png")
      ? "png"
      : supportedFormats[0];

    function updateTargetRangeByUnit() {
      if (targetUnit.value === "KB") {
        targetSlider.min = "4";
        targetSlider.max = "1024";
        targetSlider.step = "4";
        targetValue.min = "4";
        targetValue.step = "4";
      } else {
        targetSlider.min = "0.1";
        targetSlider.max = "15";
        targetSlider.step = "0.1";
        targetValue.min = "0.1";
        targetValue.step = "0.1";
      }

      const minValue = Number(targetSlider.min);
      const maxValue = Number(targetSlider.max);
      const current = clamp(
        Number(targetValue.value) || minValue,
        minValue,
        maxValue,
      );
      targetValue.value = String(current);
      targetSlider.value = String(current);
      updateTargetNote();
    }

    function updateTargetNote() {
      targetNote.textContent = `Approx target: ${targetValue.value} ${targetUnit.value}`;
    }

    function ensureFormatForTargetMode() {
      // Do not auto-change user-selected format.
      // If a non-lossy format is selected in target mode, we keep it and
      // explain behavior in the format note.
    }

    function updateFormatNote() {
      if (currentMode === "target" && formatSelect.value === "png") {
        formatNote.textContent =
          "PNG target size is achieved by reducing dimensions while keeping true PNG format.";
      } else if (formatSelect.value === "png") {
        formatNote.textContent =
          "PNG is lossless and best for original/high-detail export.";
      } else {
        formatNote.textContent = "";
      }
    }

    function updateEnabledState() {
      const qualityMode = currentMode === "quality";
      const formatKey = formatSelect.value;

      tabQuality.classList.toggle("active", qualityMode);
      tabTarget.classList.toggle("active", !qualityMode);

      qualityGroup.hidden = !qualityMode;
      targetGroup.hidden = qualityMode;

      qualityPreset.disabled = !qualityMode;
      targetSlider.disabled = qualityMode;
      targetUnit.disabled = qualityMode;
      targetValue.disabled = qualityMode;

      updateFormatNote();
    }

    function syncHeightFromWidth() {
      const nextWidth = Math.max(1, Number(widthInput.value) || initialWidth);
      const nextHeight = Math.max(1, Math.round(nextWidth / ratio));
      widthInput.value = String(nextWidth);
      heightInput.value = String(nextHeight);
    }

    function syncWidthFromHeight() {
      const nextHeight = Math.max(
        1,
        Number(heightInput.value) || initialHeight,
      );
      const nextWidth = Math.max(1, Math.round(nextHeight * ratio));
      heightInput.value = String(nextHeight);
      widthInput.value = String(nextWidth);
    }

    function close(result) {
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(result);
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(null);
      }
    }

    tabQuality.addEventListener("click", () => {
      currentMode = "quality";
      updateEnabledState();
    });

    tabTarget.addEventListener("click", () => {
      currentMode = "target";
      ensureFormatForTargetMode();
      updateEnabledState();
    });

    formatSelect.addEventListener("change", () => {
      ensureFormatForTargetMode();
      updateEnabledState();
    });

    widthInput.addEventListener("input", syncHeightFromWidth);
    heightInput.addEventListener("input", syncWidthFromHeight);

    targetSlider.addEventListener("input", () => {
      targetValue.value = targetSlider.value;
      updateTargetNote();
    });

    targetValue.addEventListener("input", () => {
      const minValue = Number(targetSlider.min);
      const maxValue = Number(targetSlider.max);
      const next = clamp(
        Number(targetValue.value) || minValue,
        minValue,
        maxValue,
      );
      targetValue.value = String(next);
      targetSlider.value = String(next);
      updateTargetNote();
    });

    targetUnit.addEventListener("change", updateTargetRangeByUnit);

    cancelButton.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      close(null);
    });

    confirmButton.addEventListener("click", () => {
      const exportWidth = Math.max(1, Number(widthInput.value) || initialWidth);
      const exportHeight = Math.max(
        1,
        Number(heightInput.value) || initialHeight,
      );

      const mode = currentMode;
      const unit = targetUnit.value;
      const targetSizeValue = Math.max(1, Number(targetValue.value) || 1);
      const targetBytes =
        unit === "MB"
          ? Math.round(targetSizeValue * 1024 * 1024)
          : Math.round(targetSizeValue * 1024);

      close({
        width: exportWidth,
        height: exportHeight,
        mode,
        format: formatSelect.value,
        qualityPreset: qualityPreset.value,
        targetBytes,
      });
    });

    updateTargetRangeByUnit();
    ensureFormatForTargetMode();
    updateEnabledState();
    window.addEventListener("keydown", onKeyDown);
  });
}

/**
 * Class-backed popup facade for export dialog.
 */
class ExportPopup {
  /**
   * @param {{width:number,height:number}} options
   * @return {Promise<any|null>}
   */
  static async open(options) {
    return openExportPopupRuntime(options);
  }
}

export function openExportPopup(options) {
  return ExportPopup.open(options);
}
