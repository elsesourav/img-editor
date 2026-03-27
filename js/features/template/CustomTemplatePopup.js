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
      grid-template-columns: 44px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }

    .custom-template-item:hover {
      border-color: rgba(167, 243, 208, 0.8);
      background: rgba(16, 185, 129, 0.16);
    }

    .custom-template-thumb {
      width: 44px;
      height: 44px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.06);
      object-fit: cover;
      display: block;
    }

    .custom-template-thumb.placeholder {
      background: linear-gradient(135deg, rgba(20, 184, 166, 0.2), rgba(59, 130, 246, 0.2));
    }

    .custom-template-item-info {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .custom-template-item strong {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .custom-template-item span {
      font-size: 11px;
      color: rgba(228, 228, 231, 0.74);
    }

    .custom-template-item-actions {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      justify-self: end;
    }

    .custom-template-icon-btn {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
    }

    .custom-template-icon-btn svg {
      width: 14px;
      height: 14px;
      display: block;
    }

    .custom-template-icon-btn:hover {
      border-color: rgba(167, 243, 208, 0.84);
      background: rgba(16, 185, 129, 0.2);
    }

    .custom-template-icon-btn.delete:hover {
      border-color: rgba(251, 113, 133, 0.84);
      background: rgba(244, 63, 94, 0.22);
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

    .custom-template-edit-btn {
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
      font-size: 11px;
      padding: 6px 8px;
      cursor: pointer;
    }

    .custom-template-edit-btn:hover {
      border-color: rgba(167, 243, 208, 0.84);
      background: rgba(16, 185, 129, 0.2);
    }

    .custom-template-name-input {
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
      font-size: 12px;
      padding: 8px;
    }

    .template-toast {
      position: fixed;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      z-index: 1500;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      background: rgba(16, 24, 39, 0.95);
      color: #e5e7eb;
      font-size: 12px;
      line-height: 1.3;
      padding: 9px 12px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
      opacity: 0;
      transition: opacity 150ms ease, transform 150ms ease;
      pointer-events: none;
    }

    .template-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
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
 * @param {{id:string,name:string,createdAt:number,layersCount:number,thumb?:string|null}[]} templates - Saved templates.
 * @return {Promise<{type:"select"|"edit-open"|"delete"|"export-json",id:string}|{type:"import-json",jsonText:string}|null>} - Picker action payload.
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
              <div class="custom-template-item" data-role="template" data-id="${template.id}" tabindex="0" role="button" aria-label="Open template ${template.name}">
                ${template.thumb ? `<img class="custom-template-thumb" src="${template.thumb}" alt="${template.name} thumbnail" />` : '<span class="custom-template-thumb placeholder" aria-hidden="true"></span>'}
                <span class="custom-template-item-info">
                  <strong>${template.name}</strong>
                  <span>${template.layersCount} layers</span>
                  <span>${formatDateTime(template.createdAt)}</span>
                </span>
                <span class="custom-template-item-actions">
                  <button type="button" class="custom-template-icon-btn delete" data-role="delete" data-id="${template.id}" aria-label="Delete template" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M10 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M6 7l1 12c.06.89.8 1.57 1.7 1.57h6.6c.9 0 1.64-.68 1.7-1.57L18 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M9 7V5.8C9 4.8 9.8 4 10.8 4h2.4C14.2 4 15 4.8 15 5.8V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                  <button type="button" class="custom-template-icon-btn" data-role="export" data-id="${template.id}" aria-label="Export template JSON" title="Export JSON">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M12 16V4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M8 8l4-4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                  <button type="button" class="custom-template-icon-btn" data-role="edit" data-id="${template.id}" aria-label="Edit template in editor" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                      <path d="M13 7l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                </span>
              </div>
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
          <button type="button" class="custom-template-btn" data-role="import">Import JSON</button>
          <button type="button" class="custom-template-btn" data-role="cancel">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = ".json,application/json";
    importInput.style.display = "none";
    overlay.appendChild(importInput);

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

    overlay
      .querySelector('[data-role="cancel"]')
      .addEventListener("click", () => {
        close(null);
      });

    overlay
      .querySelector('[data-role="import"]')
      .addEventListener("click", () => {
        importInput.click();
      });

    importInput.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const jsonText = await file.text();
        close({ type: "import-json", jsonText });
      } catch {
        close(null);
      }
    });

    overlay.querySelectorAll('[data-role="template"]').forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-id") || "";
        if (!id) return;
        close({ type: "select", id });
      });
      button.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const id = button.getAttribute("data-id") || "";
        if (!id) return;
        close({ type: "select", id });
      });
    });

    overlay.querySelectorAll('[data-role="edit"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = button.getAttribute("data-id") || "";
        if (!id) return;
        close({ type: "edit-open", id });
      });
    });

    overlay.querySelectorAll('[data-role="delete"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = button.getAttribute("data-id") || "";
        if (!id) return;
        close({ type: "delete", id });
      });
    });

    overlay.querySelectorAll('[data-role="export"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = button.getAttribute("data-id") || "";
        if (!id) return;
        close({ type: "export-json", id });
      });
    });

    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      close(null);
    });
  });
}

/**
 * Opens custom template name edit popup.
 * @param {{initialName:string}} options - Input defaults.
 * @return {Promise<string|null>} - New name or null when canceled.
 */
export function openTemplateNameEditor({ initialName = "" } = {}) {
  ensureStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "custom-template-overlay";
    overlay.innerHTML = `
      <div class="custom-template-modal" role="dialog" aria-modal="true" aria-label="Edit template name">
        <h3 class="custom-template-title">Edit Template</h3>
        <p class="custom-template-message">Update template name.</p>
        <input data-role="name" class="custom-template-name-input" type="text" maxlength="80" value="${String(initialName).replace(/"/g, "&quot;")}" />
        <div class="custom-template-actions">
          <button type="button" class="custom-template-btn" data-role="cancel">Cancel</button>
          <button type="button" class="custom-template-btn primary" data-role="save">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('[data-role="name"]');

    const close = (result) => {
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const submit = () => {
      const value = String(input?.value || "").trim();
      if (!value) {
        close(null);
        return;
      }
      close(value);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(null);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    overlay
      .querySelector('[data-role="cancel"]')
      .addEventListener("click", () => close(null));
    overlay
      .querySelector('[data-role="save"]')
      .addEventListener("click", submit);
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      close(null);
    });

    if (input) {
      input.focus();
      input.select();
    }
  });
}

let activeToast = null;

/**
 * Shows a bottom-center custom toast message.
 * @param {string} message - Toast message.
 * @param {{durationMs?:number}} options - Toast display options.
 * @return {void}
 */
export function showTemplateToast(message, { durationMs = 1700 } = {}) {
  ensureStyles();

  if (activeToast?.el) {
    activeToast.el.remove();
    if (activeToast.timeoutId) {
      clearTimeout(activeToast.timeoutId);
    }
  }

  const el = document.createElement("div");
  el.className = "template-toast";
  el.textContent = String(message || "Done");
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add("show");
  });

  const timeoutId = setTimeout(
    () => {
      el.classList.remove("show");
      setTimeout(() => {
        el.remove();
        if (activeToast?.el === el) {
          activeToast = null;
        }
      }, 160);
    },
    Math.max(600, Number(durationMs) || 1700),
  );

  activeToast = {
    el,
    timeoutId,
  };
}
