# Viewport Feature

## Purpose

Handles zoom, fit-to-content, pan, and coordinate transforms between client and world space.

## Main File

- EditorViewportController.js

## Workflow

1. Apply CSS transform variables to stage.
2. Convert pointer coordinates with zoom and offsets.
3. Manage zoom controls and fit-to-content reset.
4. Pan viewport for canvas drag behavior.

## How To Use

- Create with createEditorViewportController({...config}).
- Call applyViewportTransform() on startup/state restore.
- Use setZoom(), fitToContent(), and panBy() during runtime.

## Notes

- Grid offset is derived from viewport pan offsets.
- Designed to keep updates lightweight and smooth.

## Extended Feature Documentation

### Responsibility Matrix

- Maintains viewport transform state application.
- Converts coordinate spaces between client and world.
- Handles zoom controls, fit-to-content, and panning.

### Detailed Runtime Flow

1. Apply CSS custom properties for zoom and offsets.
2. Update grid sizing/offset to match viewport motion.
3. Process zoom interactions from toolbar/wheel/shortcuts.
4. Process pan-by deltas for canvas drag panning.
5. Trigger lightweight update callback.

### Key Methods

- applyViewportTransform()
- setZoom(nextZoom, anchor)
- fitToContent(options)
- panBy(deltaX, deltaY, options)
- getWorldPointFromClient(clientX, clientY)

### Integration Points

- Select runtime for empty-stage panning.
- Main runtime for zoom reset/fit behavior.
- Crop/rotate/select coordinate math.

### Error Handling

- Clamp zoom to safe range.
- Handle empty content bounds in fit logic.
- Guard against invalid stage dimensions.

### Performance Notes

- Pan uses incremental offset updates.
- Avoids unnecessary full refresh in drag path.
- Grid and layer transforms stay aligned.

### Maintenance Checklist

- Verify grid and canvas move together under pan.
- Verify fit-to-content with very large images.

### Future Enhancements

- Add inertial pan option.
- Add smooth animated fit transitions.
- Add zoom-to-selection command.

## Implementation Playbook

### Test Scenarios

- Zoom in/out centered on cursor.
- Fit-to-content on very large and very small layers.
- Pan by empty-stage drag and toolbar controls.
- Grid alignment under repeated pan operations.

### Edge Cases

- Zero-content bounds when no valid layers exist.
- Large offset values after prolonged panning.
- Rapid alternating zoom and pan actions.

### Integration Checklist

- Coordinate mapping is shared by select/crop/rotate features.
- Pan operations do not mutate layer model.
- Transform application stays in sync with grid variables.

### Troubleshooting

- If guides drift, inspect transform and coordinate conversion.
- If fit is too tight/loose, inspect fit margin strategy.
- If grid desyncs, inspect offset derivation and update ordering.

### Extension Ideas

- Add mini-map viewport navigator.
- Add user-defined zoom presets.
- Add smooth wheel zoom acceleration settings.
