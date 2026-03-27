let stylesMounted = false;

function ensureStyles() {
  if (stylesMounted) return;
  stylesMounted = true;

  const style = document.createElement("style");
  style.textContent = `
    .custom-template-overlay {
      position: fixed;
      inset: 0;
      z-index: 1300;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgba(0, 0, 0, 0.58);
    }

    .custom-template-modal {
      width: min(560px, 100%);
      max-height: min(86vh, 720px);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      background: #111317;
      color: #e4e4e7;
      box-shadow: 0 20px 80px rgba(0, 0, 0, 0.5);
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 10px;
      padding: 14px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
    }

    .custom-template-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .custom-template-message {
      margin: 0;
      font-size: 12px;
      color: rgba(228, 228, 231, 0.84);
    }

    .custom-template-list {
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
      padding: 10px;
      overflow: auto;
      display: grid;
      gap: 8px;
      align-content: start;
    }

    .custom-template-empty {
      border: 1px dashed rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 14px;
      text-align: center;
      font-size: 12px;
      color: rgba(228, 228, 231, 0.72);
    }

    .custom-template-item {
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.04);
      color: #e4e4e7;
      padding: 9px 10px;
      cursor: pointer;
      text-align: left;
      display: grid;
      gap: 4px;
    }

    .custom-template-item:hover {
      border-color: rgba(167, 243, 208, 0.8);
      background: rgba(16, 185, 129, 0.16);
    }

    .custom-template-item strong {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    .custom-template-item span {
      font-size: 11px;
      color: rgba(228, 228, 231, 0.74);
    }

    .custom-template-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .custom-template-btn {
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
      font-size: 12px;
      padding: 8px 12px;
      cursor: pointer;
    }

    .custom-template-btn.primary {
      border-color: rgba(167, 243, 208, 0.84);
      background: rgba(16, 185, 129, 0.2);
    }
  `;

  document.head.appendChild(style);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

/**
 * Shows a custom yes/no confirmation before saving template.
 * @param {{message?: string}} options - Dialog content options.
 * @return {Promise<boolean>} - True when user confirms save.
 */
export function openTemplateSaveConfirm({
  message = "Save current layout as a custom template?",
} = {}) {
  ensureStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "custom-template-overlay";
    overlay.innerHTML = `
      <div class="custom-template-modal" role="dialog" aria-modal="true" aria-label="Save template confirmation">
        <h3 class="custom-template-title">Save Template</h3>
        <p class="custom-template-message">${message}</p>
        <div></div>
        <div class="custom-template-actions">
          <button type="button" class="custom-template-btn" data-role="no">No</button>
          <button type="button" class="custom-template-btn primary" data-role="yes">Yes</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = (result) => {
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(false);
    };

    window.addEventListener("keydown", onKeyDown);

    overlay.querySelector('[data-role="yes"]').addEventListener("click", () => {
      close(true);
    });

    overlay.querySelector('[data-role="no"]').addEventListener("click", () => {
      close(false);
    });

    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      close(false);
    });
  });
}

/**
 * Opens template picker popup and resolves selected template id.
 * @param {{id:string,name:string,createdAt:number,layersCount:number}[]} templates - Saved templates.
 * @return {Promise<string|null>} - Selected template id.
 */
export function openCustomTemplatePicker(templates) {
  ensureStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "custom-template-overlay";

    const itemsMarkup = templates.length
      ? templates
          .map(
            (template) => `
              <button type="button" class="custom-template-item" data-role="template" data-id="${template.id}">
                <strong>${template.name}</strong>
                <span>${template.layersCount} layers</span>
                <span>${formatDateTime(template.createdAt)}</span>
              </button>
            `,
          )
          .join("")
      : '<div class="custom-template-empty">No saved template found.</div>';

    overlay.innerHTML = `
      <div class="custom-template-modal" role="dialog" aria-modal="true" aria-label="Custom templates">
        <h3 class="custom-template-title">Custom Template</h3>
        <p class="custom-template-message">Choose a saved template to apply layout, filter, crop, and style data.</p>
        <div class="custom-template-list">${itemsMarkup}</div>
        <div class="custom-template-actions">
          <button type="button" class="custom-template-btn" data-role="cancel">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = (result) => {
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(null);
    };

    window.addEventListener("keydown", onKeyDown);

    overlay.querySelector('[data-role="cancel"]').addEventListener("click", () => {
      close(null);
    });

    overlay.querySelectorAll('[data-role="template"]').forEach((button) => {
      button.addEventListener("click", () => {
        close(button.getAttribute("data-id") || null);
      });
    });

    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      close(null);
    });
  });
}
