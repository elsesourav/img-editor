# Background Removal Feature

## Purpose

Handles AI/background utilities such as subject isolation and background blur generation.

## Main File

- BackgroundRemovalController.js

## Workflow

1. User triggers remove background or blur operation.
2. Controller prepares source image and calls processing routine.
3. Processed result is applied to layer(s).
4. Editor refreshes and history commits.

## How To Use

- Create controller with createBackgroundRemovalController().
- Call methods from toolbar handlers in main runtime.

## Notes

- Operations are async and should set busy flags in UI.
- Flash tokens and transient flags are used for visual feedback.

## Extended Feature Documentation

### Responsibility Matrix

- Handles background isolation and blur-support operations.
- Provides async processing lifecycle for heavy image tasks.
- Ensures UI flags reflect running state accurately.

### Detailed Runtime Flow

1. Validate selected layer and processing capability.
2. Prepare source drawable and masks.
3. Execute operation (remove background or blur path).
4. Apply resulting image/layer updates.
5. Trigger refresh and history commit.

### Controller Contracts

- createBackgroundRemovalController(): returns operation API.
- removeBackground/applyBlur methods are called from toolbar handlers.

### Error Handling

- Wrap heavy operations in try/catch.
- Keep selected layer stable on failures.
- Provide user-readable failure message when action fails.

### UX Notes

- Busy state must disable conflicting actions.
- Visual flash helps user confirm successful apply.

### Performance Notes

- Operations should not run concurrently on same layer.
- Use transient flags instead of frequent full commits.

### Maintenance Checklist

- Keep flag names consistent between controller and UI.
- Verify linked-layer behavior after background operations.
- Confirm undo/redo consistency for generated results.

### Future Enhancements

- Add operation cancellation support.
- Add quality/performance mode options.
- Add queued batch processing.

## Implementation Playbook

### Test Scenarios

- Remove background on regular image layer.
- Blur-support path on selected image layer.
- Busy state blocks repeated trigger clicks.
- Undo restores original layer state after apply.

### Edge Cases

- Very large images with long processing time.
- Layer deleted while operation is running.
- Unsupported source data format.

### Integration Checklist

- Operation start sets transient processing flag.
- Completion clears flag and emits refresh.
- Successful apply commits exactly once.
- Failed apply leaves editor consistent.

### Troubleshooting

- If no visible result, inspect returned mask/asset payload.
- If UI remains blocked, verify flag clear in finally branch.
- If undo is broken, verify commit placement.

### Extension Ideas

- Add comparative before/after split view.
- Add cached mask reuse for repeated edits.
- Add automatic feather controls.

### Quick Validation Notes

- Confirm operation buttons re-enable after completion.
- Confirm status badge resets on error paths.
- Confirm linked preview state does not persist unexpectedly.
- Confirm layer selection remains unchanged unless explicitly updated.
