# Select Feature

## Purpose

Drives selection, move, resize, snapping, guide rendering, and canvas pan behavior.

## Main Files

- DragSelectionController.js
- DragSelectionRuntime.js
- LayerBorderController.js
- SelectGeometry.js

## Workflow

1. Pointer down resolves target: handle, layer, or empty canvas.
2. Runtime updates drag state and processes movement per frame.
3. Snapping/guides are calculated in world coordinates.
4. Commit once at drag end.

## How To Use

- Attach with attachDragSelection({ stage, marquee, refresh, onCommit, ... }).
- Provide optional onViewportPanBy for canvas panning.

## Notes

- Handles parent-child movement semantics.
- Includes border preview/apply controller integration.

## Extended Feature Documentation

### Responsibility Matrix

- Manages core pointer interactions in select mode.
- Handles move, resize, snap guides, and canvas pan drag.
- Coordinates selection changes and drag commit lifecycle.

### Detailed Runtime Flow

1. Pointer down resolves handle/layer/empty-stage hit.
2. Runtime stores drag snapshot and active pointer.
3. Pointer move updates state using frame batching.
4. Snapping resolves candidate positions and guides.
5. Pointer up finalizes and commits.

### Drag Modes

- dragMove: move selected layer with descendants.
- dragResize: resize selected layer and descendants.
- dragAll: pan viewport when dragging empty stage.

### Integration Points

- Layer APIs for move/selection.
- Viewport APIs for world conversion and panning.
- Main runtime refresh and commit callbacks.

### Performance Notes

- requestAnimationFrame batching for pointer move.
- Lightweight refresh during drag.
- Single history commit at end of action.

### Maintenance Checklist

- Validate snapping at multiple zoom levels.
- Verify child double-click selection logic.
- Verify empty-stage pan does not mutate layers.

### Future Enhancements

- Add marquee multi-select.
- Add smart alignment spacing indicators.
- Add configurable snap strength.

## Implementation Playbook

### Test Scenarios

- Drag move with and without snapping.
- Resize from each handle direction.
- Empty-stage drag pans viewport.
- Double-click child selects nearest parent-aware target.

### Edge Cases

- Pointer leaves stage mid-drag.
- High zoom precision during resize.
- Nested layers with locked states.

### Integration Checklist

- Drag lifecycle sets/clears runtime state predictably.
- Guides render only when snapping is active.
- Commit triggers once on pointer up.

### Troubleshooting

- If drag stutters, inspect frame batching and refresh scope.
- If snapping feels off, inspect world-space guide math.
- If pan mutates layers, verify dragAll route separation.

### Extension Ideas

- Add rotation handle in select mode.
- Add constrained axis drag modifiers.
- Add magnet strength presets.

### Quick Validation Notes

- Confirm snap guides hide after pointer up.
- Confirm drag states are cleared on cancel paths.
- Confirm viewport pan drag does not alter layer geometry.
