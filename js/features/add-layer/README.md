# Add Layer Feature

## Purpose

The Add Layer feature is the entry point for creating or importing content into the editor.
It is used both at startup and during normal editing.

## Main Files

- AddLayerPopup.js: UI popup for choosing startup actions.
- AddLayerFlowController.js: Business flow for adding template/preset/imported layers.

## Workflow

1. Open popup from startup or toolbar Add action.
2. User chooses one of the actions:
   - Import images
   - Create blank template layer
   - Pick preset image
   - Pick saved custom template (startup flow)
3. Controller creates one or more layers.
4. Layer selection, refresh, and history commit happen after insertion.

## How To Use

- Programmatic open:
  - Call openFlow({ startup: true }) for first-run experience.
  - Call openFlow() for regular add-layer behavior.
- Direct drag-drop import:
  - attachDirectDropImport(stage) enables dropping image files onto stage.

## Notes

- Imported files are read as data URLs.
- Startup mode can show saved custom templates.
- New layers are inserted with offset logic to avoid complete overlap.

## Extended Feature Documentation

### Responsibility Matrix

- Handles user entry paths for creating project content.
- Normalizes startup and in-session add-layer behavior.
- Provides predictable output payload for controller actions.
- Coordinates file input and dropzone behavior.

### Detailed Runtime Flow

1. Popup is opened with startup flag and option presets.
2. User picks action type (template, preset, import, custom template).
3. Flow controller maps result type to layer creation strategy.
4. New layers are created with source conversion and size normalization.
5. Selection is updated and history is committed.

### Input Handling

- Supports multi-file image import.
- Guards file type to image MIME categories.
- Uses data URL conversion for immediate rendering.
- Handles startup-only sections conditionally.

### Controller Contracts

- openFlow(options): launches action popup and resolves flow.
- attachDirectDropImport(stage): enables direct stage drop import.
- addTemplateLayer(template): creates blank template layer content.
- addPresetLayer(src): creates layer from preset image source.
- addImportedLayers(files): batch imports files into layers.

### State Expectations

- Requires access to shared state and selected layer APIs.
- Expects refresh and commit callbacks to be injected.
- Uses layering helpers for insertion origin and z-order semantics.

### Error Handling

- Skips invalid files silently for resilience.
- Ignores empty file selections without mutation.
- Returns cleanly when popup is canceled.

### UX Notes

- Startup mode focuses project entry decisions.
- In-session mode is optimized for quick content insertion.
- Offsets reduce complete overlap when importing many files.

### Maintenance Checklist

- Keep popup action IDs aligned with flow controller branches.
- Validate startup-only behavior after template feature updates.
- Ensure history commits only occur after successful insertion.

### Performance Checklist

- Avoid redundant image decode during batch import.
- Keep popup rendering lightweight.
- Commit once per batch operation where possible.

### Future Enhancements

- Add progress UI for very large batch imports.
- Add automatic grouping for multi-import sessions.
- Add recent assets quick access panel.

## Implementation Playbook

### Test Scenarios

- Startup flow opens with expected action set.
- Regular flow opens with in-session action set.
- Multi-import inserts all valid images.
- Empty input does not mutate state.
- Cancel action leaves state untouched.

### Edge Cases

- Corrupted image files in multi-select import.
- Extremely large image dimensions.
- Duplicate drop events from browser drag handlers.
- Startup opened when layers already exist.

### Integration Checklist

- Ensure selected layer is set to newest inserted item.
- Ensure refresh callback is called after insertion.
- Ensure commit callback is called exactly once per operation.
- Ensure template startup entries map to correct open behavior.

### Troubleshooting

- If imports fail, validate MIME and file reader path.
- If offsets feel wrong, inspect insertion origin helper.
- If startup options mismatch, compare popup section guards.

### Extension Ideas

- Add clipboard paste image support.
- Add quick-recent upload thumbnails.
- Add drag ghost preview for drop import.
