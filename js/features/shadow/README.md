# Shadow Feature

## Purpose

Manages object shadow and stroke controls (size, color, opacity, offsets, blur).

## Main File

- ShadowTools.js

## Workflow

1. Enter shadow mode.
2. Runtime creates preview draft state.
3. User adjusts controls (shadow + stroke).
4. Apply commits draft to history.

## How To Use

- Create tools with createShadowTools({...deps}).
- Call renderShadowOptions(selected, optionsPanel, runtimeHelpers).
- Call applyShadowSelection(layerId) on Apply.

## Notes

- Stroke size is UI-mapped to internal values in current implementation.
- Stroke background opacity is supported.

## Extended Feature Documentation

### Responsibility Matrix

- Owns object shadow and stroke option controls.
- Manages draft state for live preview.
- Applies finalized settings through explicit apply action.

### Detailed Runtime Flow

1. Enter shadow mode and initialize draft.
2. Render controls for offsets, blur, opacity, colors, and stroke.
3. Preview updates layer shadowStyle continuously.
4. Apply commits draft and clears snapshot.

### Stroke Model

- Supports stroke size, color, and background opacity.
- Uses mapped UI scale for stroke size.
- Works with text and image layers.

### Integration Points

- getLayerShadowStyle normalization in core layer store.
- Live stage rendering filter chain.
- Export/bake utilities for consistency.

### Error Handling

- Ensure defaults when fields are missing.
- Clamp all numeric values to supported ranges.

### Performance Notes

- Keep preview path light for frequent updates.
- Optimize text stroke path to reduce lag.

### Maintenance Checklist

- Verify stroke around behavior on text and PNG layers.
- Verify opacity mapping for stroke color.

### Future Enhancements

- Add fast/high quality stroke toggle.
- Add per-layer shadow presets.
- Add directional light preset controls.

## Implementation Playbook

### Test Scenarios

- Update shadow offsets and blur with live preview.
- Update stroke color and opacity on text layer.
- Apply shadow and verify undo/redo behavior.
- Switch layers while in shadow mode.

### Edge Cases

- Missing shadowStyle object on legacy layer data.
- Extreme blur/stroke values near bounds.
- Rapid slider interaction at high frame rates.

### Integration Checklist

- Draft state initializes from normalized layer style.
- Preview update path is non-destructive until apply.
- Apply path commits one history snapshot.

### Troubleshooting

- If preview differs from export, inspect bake pipeline parity.
- If stroke opacity appears wrong, inspect color alpha mapping.
- If lag occurs, inspect heavy blur/stroke fallback path.

### Extension Ideas

- Add reusable effect preset library.
- Add per-layer effect disable toggle.
- Add advanced blend mode controls.

### Quick Validation Notes

- Confirm preview and apply values match exactly.
- Confirm stroke opacity slider maps to final alpha correctly.
- Confirm defaults are restored for missing style fields.
- Confirm performance remains acceptable on large text layers.
