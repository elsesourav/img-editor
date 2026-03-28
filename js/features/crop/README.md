# Crop Feature

## Purpose

Provides crop selection box interaction, handles resize handles, constraints, and crop mode behavior.

## Main File

- CropSelectionController.js

## Workflow

1. Enter crop mode for selected layer.
2. Draw or adjust crop rectangle via handles.
3. Apply crop to commit pixel changes.

## How To Use

- Attach with attachCropSelection({ stage, refresh, onCommit }).
- Keep state.cropSelection synchronized with selected layer.

## Notes

- Supports free ratio and fixed ratios.
- Honors viewport zoom/offset coordinate transforms.

## Extended Feature Documentation

### Responsibility Matrix

- Manages crop rectangle interaction and constraints.
- Converts pointer positions from client to world coordinates.
- Applies ratio logic and min-size boundaries.

### Detailed Runtime Flow

1. Enter crop mode for selected layer.
2. Initialize crop selection from current layer bounds.
3. Handle drag/resize events from crop handles.
4. Enforce constraints (ratio/min bounds).
5. Apply crop operation and commit.

### Constraints

- Ratio modes include free, presets, and fixed-current behavior.
- Width/height values are clamped to minimum size.
- Crop rect is synchronized with selected layer changes.

### Integration Points

- Viewport world conversion.
- Main mode switch logic.
- History commit after apply.

### Error Handling

- Ignore operations when no valid selected layer exists.
- Reset crop selection if target layer changes unexpectedly.

### Performance Notes

- Keep handle drag updates lightweight.
- Avoid expensive operations until apply step.

### Maintenance Checklist

- Validate ratio and fixed mode transitions.
- Ensure crop overlay sync at non-100% zoom.
- Confirm apply flow with parent-child layer chains.

### Future Enhancements

- Add rule-of-thirds overlay.
- Add constrained crop to visible canvas option.
- Add keyboard nudges for crop handles.

## Implementation Playbook

### Test Scenarios

- Drag each crop handle at multiple zoom levels.
- Switch ratio presets while dragging.
- Apply crop and verify new layer bounds.
- Undo and redo crop repeatedly.

### Edge Cases

- Minimum-size clamp near zero dimension.
- Crop rect partially outside source bounds.
- Selected layer changes during crop mode.

### Integration Checklist

- Coordinate conversion uses viewport world mapping.
- Crop overlays re-render on zoom/pan updates.
- Apply path commits one history snapshot.

### Troubleshooting

- If handles drift, verify world-to-client mapping.
- If ratio breaks, inspect fixed-ratio constraint math.
- If apply is wrong, inspect source rect normalization.

### Extension Ideas

- Add center-resize modifier key behavior.
- Add pixel-grid snap for precise crops.
- Add numeric crop entry fields.

### Quick Validation Notes

- Confirm crop box redraws during viewport pan.
- Confirm apply respects source image bounds.
- Confirm cancel/exit does not mutate pixel data.
- Confirm crop ratios persist across mode re-entry.
