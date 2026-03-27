/**
 * Reusable option panel UI helper methods.
 */
class OptionsUiHelpers {
  /**
   * @param {string} labelText
   * @param {HTMLElement} inputElement
   * @return {HTMLDivElement}
   */
  static createOptionRow(labelText, inputElement) {
    const row = document.createElement("div");
    row.className = "option-row";

    const label = document.createElement("label");
    label.textContent = labelText;

    row.appendChild(label);
    row.appendChild(inputElement);
    return row;
  }

  /**
   * @param {number} value
   * @param {(nextValue:number)=>void} onChange
   * @param {{min?:number,step?:number}} options
   * @return {HTMLInputElement}
   */
  static createNumberInput(value, onChange, { min = -99999, step = 1 } = {}) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(min);
    input.step = String(step);
    input.value = String(Math.round(value));

    const commit = () => {
      const parsed = Number(input.value);
      if (Number.isNaN(parsed)) return;
      onChange(parsed);
    };

    input.addEventListener("change", commit);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commit();
    });

    return input;
  }

  /**
   * @param {string} value
   * @param {(nextValue:string)=>void} onCommit
   * @return {HTMLInputElement}
   */
  static createTextInput(value, onCommit) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;

    const commit = () => {
      onCommit(input.value);
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      input.blur();
    });

    return input;
  }

  /**
   * @param {Array<{value:string,label:string}>} options
   * @param {string} value
   * @param {(nextValue:string)=>void} onChange
   * @return {HTMLSelectElement}
   */
  static createSelectInput(options, value, onChange) {
    const select = document.createElement("select");
    select.className = "option-select";

    for (const option of options) {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      select.appendChild(el);
    }

    select.value = value;
    select.addEventListener("change", () => {
      onChange(select.value);
    });

    return select;
  }

  /**
   * @param {string} labelText
   * @param {HTMLElement} inputElement
   * @return {HTMLDivElement}
   */
  static createMetricField(labelText, inputElement) {
    const field = document.createElement("div");
    field.className = "metric-field";

    const label = document.createElement("label");
    label.className = "metric-label";
    label.textContent = labelText;

    field.appendChild(label);
    field.appendChild(inputElement);
    return field;
  }

  /**
   * @param {Array<{label:string,input:HTMLElement}>} items
   * @return {HTMLDivElement}
   */
  static createMetricsGrid(items) {
    const grid = document.createElement("div");
    grid.className = "metrics-grid";

    for (const item of items) {
      grid.appendChild(OptionsUiHelpers.createMetricField(item.label, item.input));
    }

    return grid;
  }
}

export function createOptionRow(labelText, inputElement) {
  return OptionsUiHelpers.createOptionRow(labelText, inputElement);
}

export function createNumberInput(value, onChange, options) {
  return OptionsUiHelpers.createNumberInput(value, onChange, options);
}

export function createTextInput(value, onCommit) {
  return OptionsUiHelpers.createTextInput(value, onCommit);
}

export function createSelectInput(options, value, onChange) {
  return OptionsUiHelpers.createSelectInput(options, value, onChange);
}

export function createMetricsGrid(items) {
  return OptionsUiHelpers.createMetricsGrid(items);
}
