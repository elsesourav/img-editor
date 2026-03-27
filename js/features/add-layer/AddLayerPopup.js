let stylesMounted = false;

const DEFAULT_TEMPLATE_COLORS = [
  "#FFFFFF",
  "#000000",
  "#EF4444",
  "#F59E0B",
  "#FDE047",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
];

function ensureStyles() {
  if (stylesMounted) return;
  stylesMounted = true;

  const style = document.createElement("style");
  style.textContent = `
    .add-layer-overlay {
      position: fixed;
      inset: 0;
      z-index: 1300;
      background: rgba(0, 0, 0, 0.52);
      display: grid;
      place-items: center;
      padding: 16px;
    }

    .add-layer-popup {
      width: min(760px, 100%);
      max-height: min(86vh, 760px);
      overflow: auto;
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

    .add-layer-title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
    }

    .add-layer-subtitle {
      font-size: 12px;
      color: rgba(228, 228, 231, 0.74);
      margin: 0;
    }

    .add-layer-group {
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
      padding: 10px;
      display: grid;
      gap: 8px;
    }

    .add-layer-dropzone {
      border: 1px dashed rgba(125, 211, 252, 0.7);
      border-radius: 10px;
      background: rgba(14, 116, 144, 0.12);
      padding: 14px;
      display: grid;
      gap: 6px;
      align-content: center;
      justify-items: center;
      text-align: center;
      color: rgba(224, 242, 254, 0.95);
      transition: border-color 120ms ease, background 120ms ease;
      min-height: 94px;
    }

    .add-layer-dropzone.active {
      border-color: rgba(167, 243, 208, 0.96);
      background: rgba(16, 185, 129, 0.18);
    }

    .add-layer-dropzone-title {
      font-size: 12px;
      font-weight: 700;
    }

    .add-layer-dropzone-note {
      font-size: 11px;
      color: rgba(224, 242, 254, 0.84);
    }

    .add-layer-group-title {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: rgba(228, 228, 231, 0.9);
    }

    .add-layer-field-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    .add-layer-field {
      display: grid;
      gap: 4px;
    }

    .add-layer-field span {
      font-size: 11px;
      color: rgba(228, 228, 231, 0.76);
    }

    .add-layer-popup input[type="number"],
    .add-layer-popup input[type="text"],
    .add-layer-popup select,
    .add-layer-popup input[type="color"] {
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
      font-size: 12px;
      padding: 7px 8px;
    }

    .add-layer-popup input[type="color"] {
      padding: 2px;
      height: 34px;
    }

    .add-layer-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .add-layer-btn-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      align-items: center;
    }

    .add-layer-btn {
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
      font-size: 12px;
      padding: 8px 12px;
      cursor: pointer;
    }

    .add-layer-btn.primary {
      border-color: rgba(167, 243, 208, 0.85);
      background: rgba(16, 185, 129, 0.2);
    }

    .add-layer-presets {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
    }

    .add-layer-preset {
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.04);
      overflow: hidden;
      cursor: pointer;
      text-align: left;
      padding: 0;
      color: inherit;
    }

    .add-layer-preset img {
      width: 100%;
      height: 88px;
      object-fit: cover;
      display: block;
      border-bottom: 1px solid rgba(255, 255, 255, 0.14);
    }

    .add-layer-preset span {
      display: block;
      font-size: 11px;
      padding: 7px 8px;
      color: rgba(228, 228, 231, 0.88);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .add-layer-color-presets {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      gap: 8px;
    }

    .add-layer-color-btn {
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      cursor: pointer;
      background: transparent;
      position: relative;
      overflow: hidden;
    }

    .add-layer-color-btn.active {
      box-shadow: 0 0 0 2px rgba(167, 243, 208, 0.94);
    }

    .add-layer-color-btn.custom {
      border-style: dashed;
      display: grid;
      place-items: center;
      background: linear-gradient(
        120deg,
        #ff4d6d,
        #ffb703,
        #80ed99,
        #4cc9f0,
        #8e7dff,
        #ff4d6d
      );
      background-size: 200% 200%;
      animation: add-layer-rainbow 4s linear infinite;
    }

    .add-layer-color-btn.custom::after {
      content: "Custom";
      font-size: 9px;
      color: rgba(228, 228, 231, 0.92);
      padding: 2px 4px;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.65);
    }

    .add-layer-color-btn.transparent {
      border-style: dashed;
      background:
        linear-gradient(45deg, rgba(255, 255, 255, 0.12) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(255, 255, 255, 0.12) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.12) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.12) 75%);
      background-size: 14px 14px;
      background-position: 0 0, 0 7px, 7px -7px, -7px 0;
    }

    .add-layer-color-btn.transparent::after {
      content: "Transparent";
      position: absolute;
      inset: auto 4px 4px 4px;
      font-size: 9px;
      text-align: center;
      color: rgba(228, 228, 231, 0.92);
      padding: 2px 4px;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.7);
    }

    .add-layer-color-native {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }

    .add-layer-template-size {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    @keyframes add-layer-rainbow {
      0% {
        background-position: 0% 50%;
      }

      100% {
        background-position: 200% 50%;
      }
    }
  `;

  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openAddLayerPopupRuntime({
  presetImages = [],
  customTemplates = [],
  startup = false,
  templateDefaults = { width: 1200, height: 800 },
  templateColorPresets = DEFAULT_TEMPLATE_COLORS,
} = {}) {
  ensureStyles();

  return new Promise((resolve) => {
    const presetCards = presetImages
      .map(
        (preset, index) => `
          <button type="button" class="add-layer-preset" data-role="preset" data-index="${index}">
            <img src="${escapeHtml(preset.src)}" alt="${escapeHtml(preset.label)}" loading="lazy" />
            <span>${escapeHtml(preset.label)}</span>
          </button>
        `,
      )
      .join("");

    const customTemplateCards = customTemplates
      .map(
        (template, index) => `
          <button type="button" class="add-layer-preset" data-role="custom-template" data-index="${index}">
            ${template.thumb ? `<img src="${escapeHtml(template.thumb)}" alt="${escapeHtml(template.name)}" loading="lazy" />` : '<div style="height:88px;display:grid;place-items:center;border-bottom:1px solid rgba(255,255,255,0.14);font-size:11px;color:rgba(228,228,231,0.7);">Template</div>'}
            <span>${escapeHtml(template.name)}</span>
          </button>
        `,
      )
      .join("");

    const initialWidth = Math.max(
      32,
      Math.round(Number(templateDefaults.width) || 1200),
    );
    const initialHeight = Math.max(
      32,
      Math.round(Number(templateDefaults.height) || 800),
    );

    const colorPresetMarkup = [
      '<button type="button" class="add-layer-color-btn custom active" data-role="templateColorCustom" data-hint="Custom Color" title="Custom color"><input class="add-layer-color-native" data-role="templateColorNative" type="color" value="#ffffff" aria-label="Choose custom template color" /></button>',
      ...templateColorPresets.map(
        (color) =>
          `<button type="button" class="add-layer-color-btn" data-role="templateColorPreset" data-color="${escapeHtml(color)}" data-hint="Color ${escapeHtml(color)}" style="background:${escapeHtml(color)};" title="${escapeHtml(color)}"></button>`,
      ),
      '<button type="button" class="add-layer-color-btn transparent" data-role="templateColorTransparent" data-hint="Transparent" title="Transparent"></button>',
    ].join("");
    let selectedTemplateColor = "#ffffff";
    let selectedTemplateType = "custom";

    const overlay = document.createElement("div");
    overlay.className = "add-layer-overlay";
    overlay.innerHTML = `
      <div class="add-layer-popup" role="dialog" aria-modal="true" aria-label="Add layer options">
        <h3 class="add-layer-title">${startup ? "Start Project" : "Add Layer"}</h3>
        <p class="add-layer-subtitle">Create a base layer, choose a preset, or import one or more images at once.</p>

        ${
          startup && customTemplates.length
            ? `
          <div class="add-layer-group">
            <h4 class="add-layer-group-title">Your Saved Templates</h4>
            <div class="add-layer-presets">
              ${customTemplateCards}
            </div>
          </div>
        `
            : ""
        }

        <div class="add-layer-group">
          <h4 class="add-layer-group-title">Import Images</h4>
          <div class="add-layer-dropzone" data-role="dropzone">
            <div class="add-layer-dropzone-title">Drop images here</div>
            <div class="add-layer-dropzone-note">or use the button to choose multiple files</div>
          </div>
          <div class="add-layer-btn-row">
            <button type="button" class="add-layer-btn primary" data-role="importImages" data-hint="Import Images">Import Images</button>
          </div>
        </div>

        <div class="add-layer-group">
          <h4 class="add-layer-group-title">Blank Template</h4>
          <div class="add-layer-template-size">
            <label class="add-layer-field">
              <span>Width</span>
              <input type="number" data-role="templateWidth" min="32" step="1" value="${initialWidth}" />
            </label>
            <label class="add-layer-field">
              <span>Height</span>
              <input type="number" data-role="templateHeight" min="32" step="1" value="${initialHeight}" />
            </label>
            <label class="add-layer-field">
              <span>Opacity (%)</span>
              <input type="number" data-role="templateOpacity" min="0" max="100" step="1" value="100" />
            </label>
          </div>
          <div class="add-layer-template-size">
            <div class="add-layer-subtitle">Defaulted to preset image dimensions.</div>
            <div class="add-layer-subtitle" style="text-align:right;">${initialWidth} x ${initialHeight}</div>
          </div>
          <div class="add-layer-color-presets">
            ${colorPresetMarkup}
          </div>
        </div>

        <div class="add-layer-group">
          <h4 class="add-layer-group-title">Preset Images</h4>
          <div class="add-layer-presets">
            ${presetCards}
          </div>
        </div>

        <div class="add-layer-actions">
          <span class="add-layer-subtitle">Tip: you can add more layers any time from the Add button.</span>
          <div class="add-layer-btn-row">
            <button type="button" class="add-layer-btn" data-role="cancel">${startup ? "Skip" : "Close"}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const templateWidth = overlay.querySelector('[data-role="templateWidth"]');
    const templateHeight = overlay.querySelector(
      '[data-role="templateHeight"]',
    );
    const templateOpacity = overlay.querySelector(
      '[data-role="templateOpacity"]',
    );
    const importImagesBtn = overlay.querySelector('[data-role="importImages"]');
    const dropzone = overlay.querySelector('[data-role="dropzone"]');
    const cancelBtn = overlay.querySelector('[data-role="cancel"]');
    const templateColorNative = overlay.querySelector(
      '[data-role="templateColorNative"]',
    );
    const templateColorCustom = overlay.querySelector(
      '[data-role="templateColorCustom"]',
    );
    const templateColorTransparent = overlay.querySelector(
      '[data-role="templateColorTransparent"]',
    );
    const presetColorButtons = [
      ...overlay.querySelectorAll('[data-role="templateColorPreset"]'),
    ];
    let isCustomTemplateArmed = false;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    overlay.appendChild(fileInput);

    function close(result) {
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(result);
    }

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(null);
    }

    function setTemplateColor(nextColor, source = "custom") {
      selectedTemplateColor = nextColor;
      templateColorNative.value = nextColor;

      if (source === "custom") {
        templateColorCustom.style.background = nextColor;
        templateColorCustom.style.animation = "none";
      }

      selectedTemplateType = source;

      templateColorCustom.classList.toggle("active", source === "custom");
      templateColorTransparent.classList.toggle(
        "active",
        source === "transparent",
      );
      for (const button of presetColorButtons) {
        button.classList.toggle(
          "active",
          source === "preset" &&
            button.getAttribute("data-color") === nextColor,
        );
      }
    }

    function getTemplateBase() {
      return {
        width: Math.max(32, Number(templateWidth.value) || initialWidth),
        height: Math.max(32, Number(templateHeight.value) || initialHeight),
        opacity: Math.max(0, Math.min(100, Number(templateOpacity.value) || 0)),
      };
    }

    function createTemplateFromCurrentSelection() {
      const base = getTemplateBase();
      close({
        type: "template",
        template: {
          ...base,
          transparent: selectedTemplateType === "transparent",
          color: selectedTemplateColor,
          opacity: selectedTemplateType === "transparent" ? 0 : base.opacity,
        },
      });
    }

    function closeWithFiles(fileList) {
      const files = [...(fileList || [])].filter(
        (file) => file && String(file.type || "").startsWith("image/"),
      );
      if (!files.length) return;

      close({
        type: "import-files",
        files,
      });
    }

    function markDropzoneActive(active) {
      dropzone.classList.toggle("active", Boolean(active));
    }

    importImagesBtn.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", () => {
      closeWithFiles(fileInput.files);
    });

    templateColorNative.addEventListener("input", () => {
      isCustomTemplateArmed = true;
      setTemplateColor(templateColorNative.value || "#ffffff", "custom");
    });

    templateColorCustom.addEventListener("pointerdown", () => {
      if (selectedTemplateType === "custom" && isCustomTemplateArmed) {
        createTemplateFromCurrentSelection();
      }
    });

    templateColorCustom.addEventListener("click", (event) => {
      if (selectedTemplateType === "custom" && isCustomTemplateArmed) {
        event.preventDefault();
        return;
      }
      isCustomTemplateArmed = false;
      setTemplateColor(templateColorNative.value || "#ffffff", "custom");
      templateColorNative.click();
    });

    for (const button of presetColorButtons) {
      button.addEventListener("click", () => {
        isCustomTemplateArmed = false;
        const color = button.getAttribute("data-color") || "#ffffff";
        setTemplateColor(color, "preset");
        createTemplateFromCurrentSelection();
      });
    }

    templateColorTransparent.addEventListener("click", () => {
      isCustomTemplateArmed = false;
      setTemplateColor("#ffffff", "transparent");
      createTemplateFromCurrentSelection();
    });

    for (const targetEl of [
      dropzone,
      overlay.querySelector(".add-layer-popup"),
    ]) {
      targetEl.addEventListener("dragenter", (event) => {
        event.preventDefault();
        markDropzoneActive(true);
      });

      targetEl.addEventListener("dragover", (event) => {
        event.preventDefault();
        markDropzoneActive(true);
      });

      targetEl.addEventListener("dragleave", (event) => {
        const related = event.relatedTarget;
        if (related && targetEl.contains(related)) return;
        markDropzoneActive(false);
      });

      targetEl.addEventListener("drop", (event) => {
        event.preventDefault();
        markDropzoneActive(false);
        closeWithFiles(event.dataTransfer?.files || []);
      });
    }

    overlay.querySelectorAll('[data-role="preset"]').forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-index"));
        const preset = presetImages[index];
        if (!preset) return;
        close({
          type: "preset",
          src: preset.src,
        });
      });
    });

    overlay
      .querySelectorAll('[data-role="custom-template"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-index"));
          const template = customTemplates[index];
          if (!template?.id) return;
          close({
            type: "custom-template",
            templateId: template.id,
          });
        });
      });

    cancelBtn.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      close(null);
    });

    window.addEventListener("keydown", onKeyDown);
  });
}

/**
 * Class-backed popup facade for add-layer dialog.
 */
class AddLayerPopup {
  /**
   * @param {Object} options
   * @return {Promise<any|null>}
   */
  static async open(options = {}) {
    return openAddLayerPopupRuntime(options);
  }
}

export function openAddLayerPopup(options = {}) {
  return AddLayerPopup.open(options);
}
