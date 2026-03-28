# Export Feature

## Purpose

Collects export settings (size, format, quality/target mode) and drives output generation.

## Main File

- ExportPopup.js

## Workflow

1. User opens export popup.
2. Selects dimensions, format, and mode.
3. Confirm export or choose Save Template shortcut action.
4. Main runtime performs encoding and download.

## How To Use

- Call openExportPopup({ width, height }).
- Handle returned action payload in main runtime.

## Notes

- PNG/JPG/JPEG/WebP support depends on browser capabilities.
- Target-size mode is optimized for lossy formats.

## Extended Feature Documentation

### Responsibility Matrix

- Captures export options through popup UI.
- Returns structured payload for runtime export engine.
- Supports quality and target-size workflows.

### Detailed Runtime Flow

1. Main runtime computes source canvas bounds.
2. Popup opens with initial dimensions.
3. User selects format, mode, and output target.
4. Runtime encodes using selected strategy.
5. Output download is triggered.

### Popup Contracts

- openExportPopup({ width, height }) returns action payload.
- Action can be export or save-template shortcut.

### Mode Behavior

- Quality mode prioritizes visual fidelity options.
- Target mode aims approximate output bytes.
- PNG uses dimension strategy where quality factor is limited.

### Error Handling

- Cancel returns null and causes no mutations.
- Invalid values are clamped in popup controls.

### Performance Notes

- Keep popup interactions client-side and lightweight.
- Defer encoding until user confirms.

### Maintenance Checklist

- Keep payload keys aligned with main runtime.
- Re-test target-size behavior for format changes.

### Future Enhancements

- Add transparent background controls.
- Add export presets save/load.
- Add multi-page or sprite-sheet export modes.

## Implementation Playbook

### Test Scenarios

- Export PNG at default dimensions.
- Export JPEG/WebP with quality adjustment.
- Target-size mode with reasonable byte target.
- Cancel popup and ensure no output action.

### Edge Cases

- Extremely large output dimensions.
- Unsupported browser format fallback behavior.
- Invalid numeric input bounds from popup fields.

### Integration Checklist

- Payload keys match runtime export parser.
- Save-template action path remains intact.
- Download filename and extension are aligned.

### Troubleshooting

- If size target is inaccurate, inspect iterative quality strategy.
- If output is clipped, validate source bounds calculation.
- If format fails, verify browser codec support.

### Extension Ideas

- Add metadata stripping toggle.
- Add color-profile choice where supported.
- Add export history presets.

### Quick Validation Notes

- Confirm output dimensions match selected values.
- Confirm format extension matches encoded blob type.
- Confirm cancel path returns control without side effects.
- Confirm target-size mode converges within reasonable attempts.
