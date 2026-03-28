# Img Editor

A modular, feature-driven web image editor built with vanilla JavaScript modules.
It supports layered editing, text, crop, rotate, filter, shadow/stroke, export presets, template workflows, history, and viewport controls.

## Highlights

- Layer-based editing with parent/child relationships.
- Select, move, resize, snap guides, and canvas panning.
- Crop and rotate workflows with apply/revert behavior.
- Advanced filters and shadow/stroke controls.
- Text layer creation and editing pipeline.
- Export popup with format/quality/target controls.
- Custom templates (save/open/edit/import/export JSON).
- Undo/redo history manager.
- Keyboard shortcut support.

## Project Structure

- index.html: App shell and stage layout.
- styles.css: Main visual styles.
- js/main.js: Application bootstrap and runtime orchestration.
- js/core: Shared state, layer store logic, geometry, and helpers.
- js/features: Feature modules (each folder has its own README).

## Feature Modules

Each feature folder includes a README with purpose, workflow, and usage.

- js/features/add-layer
- js/features/background-removal
- js/features/crop
- js/features/export
- js/features/history
- js/features/keyboard
- js/features/layers-panel
- js/features/rotate
- js/features/select
- js/features/shadow
- js/features/template
- js/features/text
- js/features/viewport

## Main Runtime Workflow

1. App starts in js/main.js and initializes shared state/controllers.
2. Viewport transform and layer rendering are applied to stage.
3. Toolbars and keyboard shortcuts dispatch feature actions.
4. Feature modules mutate state through clear action boundaries.
5. UI refresh redraws stage, options panel, and layers panel.
6. History commits are performed after meaningful completed actions.

## Template Workflow

1. Save current editor state as custom template.
2. Lock selected slots if needed.
3. Open template in template mode (slot filling) or editor mode.
4. Import/export templates as JSON.

## Performance Notes

- Drag interactions update at frame boundaries.
- Heavy operations are async and guarded with runtime flags.
- Recent optimizations reduce stroke lag and improve large-image zoom handling.

## How To Run

This is a static browser app.

1. Open the project folder.
2. Serve via local static server (recommended) or open index.html directly.
3. Start editing from startup popup.

## Social Links

- GitHub: https://github.com/elsesourav
- Instagram: https://instagram.com/elsesourav
- X: https://x.com/elsesourav
- Facebook: https://facebook.com/elsesourav

## License

This project is licensed under the MIT License. See LICENSE.

Copyright SouravBarui 2026

## In-Depth System Documentation

### Architecture Overview

- The editor is organized around a modular feature architecture where each domain has isolated runtime logic.
- The `js/main.js` file acts as the composition root and wires all controllers, views, and state helpers.
- Core state and rendering math live in `js/core` to keep reusable logic centralized.
- Feature controllers in `js/features` focus on behavior and interaction contracts rather than global bootstrapping.
- Utility helpers in `js/utils` handle image/canvas heavy work and encoding flows.

### Runtime Data Model

- `state.layers` stores all layer entities used for rendering and interaction.
- `state.selectedLayerId` tracks active selection for option panel and mode operations.
- `state.mode` controls tool behavior: select, crop, rotate, filter, shadow, and template states.
- `state.cropSelection` is used in crop mode and synced with selected layer context.
- `state.editorZoom`, `state.editorOffsetX`, and `state.editorOffsetY` control viewport transform.

### Layer Rendering Rules

- Layers are painted in z-order with parent-child ordering guarantees.
- Parent clipping rules are applied to descendants when intersections are required.
- Background fill can be conditional depending on mode and layer metadata.
- Filter/shadow/stroke are applied in a composed path for live stage rendering.
- Selection and crop overlays are rendered separately from layer content for clarity.

### Main Interaction Lifecycle

1. User action triggers toolbar/keyboard/pointer event.
2. Event is routed to the active feature runtime.
3. Feature validates state and mode before mutation.
4. Preview mutations update stage quickly with lightweight refresh.
5. Final apply path commits one history snapshot.
6. UI control state is synchronized after commit.

### Mode Workflow Summary

- Select mode: move, resize, snap, canvas pan.
- Crop mode: crop box manipulation and ratio enforcement.
- Rotate mode: angle preview and apply/revert cycle.
- Filter mode: slider-driven previews and apply bake.
- Shadow mode: shadow/stroke preview with apply boundary.
- Template mode: editable slot-driven content population.

### Export and Template Relationship

- Export can run in quality or target-size mode.
- Template save is integrated via export action workflow.
- Template JSON supports import/export for portability.
- Locked template slots preserve fixed assets while editable slots remain user-driven.

### Startup Workflow

1. Initialize viewport, history, and feature controllers.
2. Render stage and side panels.
3. If no layer exists, open startup popup.
4. User can start from import, preset, blank template, or saved custom template.
5. Initial layer insertion refreshes stage and creates baseline history state.

### Performance Design Notes

- Pointer move operations are frame-batched where needed.
- History commits are deferred to interaction end.
- Heavy image operations run async with status flags.
- Stroke/shadow paths are optimized to reduce lag on text/image workflows.
- Viewport fit and pan operations avoid unnecessary full rerenders.

### Error Handling Principles

- Fail early on missing layer IDs and invalid state references.
- Use bounded defaults for numeric fields.
- Keep runtime resilient against partial/corrupt imported payloads.
- Surface user alerts only for actionable failures.

### Development Guidelines

- Keep feature logic in its feature folder.
- Keep shared math and normalization in core modules.
- Avoid mutating unrelated state slices in a feature controller.
- Preserve public contracts used by `js/main.js` wiring.
- Update feature-level README when behavior changes.

### Suggested Test Matrix

- Zoom, pan, and selection interactions at multiple scales.
- Parent-child movement and clipping behavior.
- Crop/rotate/filter apply + undo/redo cycles.
- Shadow/stroke performance with text and images.
- Template save/open/edit/import/export flows.
- Export outputs across PNG/JPEG/WebP and size modes.

### Build and Run Notes

- This project runs as a static browser app.
- Local server usage is recommended for consistent file loading.
- Modern browser support is expected for canvas and module features.

### Frequently Used Entry Files

- `index.html`
- `styles.css`
- `js/main.js`
- `js/core/LayerStore.js`
- `js/features/select/DragSelectionRuntime.js`
- `js/features/viewport/EditorViewportController.js`
- `js/features/template/CustomTemplateController.js`

### Documentation Policy

- Every feature folder contains a dedicated README.
- Root README provides cross-feature architecture view.
- Keep this document aligned with runtime behavior and user-visible flows.

### Creator and Community

- Author: SouravBarui
- GitHub: https://github.com/elsesourav
- Instagram: https://instagram.com/elsesourav
- X: https://x.com/elsesourav
- Facebook: https://facebook.com/elsesourav

### Additional Notes

- This documentation intentionally favors explicit workflows and implementation context.
- Sections are designed to help both users and contributors understand behavior quickly.
- For feature-level deep dives, see `js/features/*/README.md` files.

### Contribution Workflow

1. Pick a feature folder and read its local README first.
2. Review shared contracts in `js/main.js` and `js/core` before editing.
3. Keep commits scoped to one behavior change at a time.
4. Validate undo/redo and viewport behavior after interaction changes.
5. Update docs for user-visible behavior changes.

### Stability Checklist

- Verify toolbar actions across all modes.
- Verify keyboard shortcuts with and without selection.
- Verify template mode slot behavior and export outcome.
- Verify large image handling with fit-to-content and pan.
