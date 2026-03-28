# Rotate Feature

## Purpose

Controls interactive layer rotation with preview and apply/revert behavior.

## Main File

- RotateController.js

## Workflow

1. Enter rotate mode.
2. Drag rotate handle to preview angle.
3. Apply to commit or leave mode to revert preview state.

## How To Use

- Create controller with dependencies from main runtime.
- Call ensureSession/revert/apply from mode and toolbar actions.

## Notes

- Uses world coordinates from viewport controller.
- Works with selection bounds and children.

## Extended Feature Documentation

### Responsibility Matrix

- Owns rotate preview sessions and angle state.
- Provides apply and revert semantics.
- Keeps child transforms synchronized where required.

### Detailed Runtime Flow

1. Enter rotate mode and capture baseline session.
2. Pointer drag computes candidate angle.
3. Preview renders updated rotation bounds.
4. Apply commits final angle.
5. Leaving mode can revert unfinished preview.

### Integration Points

- Selection overlay updates from main runtime.
- Viewport coordinate conversion for handle drag.
- History commit on apply.

### Error Handling

- Ignore rotate actions when no selected layer.
- Revert safely if mode changes unexpectedly.

### Performance Notes

- Keep trigonometry and bounds calculations efficient.
- Avoid heavy rerender paths during pointer move.

### Maintenance Checklist

- Validate rotate handle behavior at high zoom.
- Verify rotate + crop + template mode interactions.

### Future Enhancements

- Add numeric angle input.
- Add snap increments (15-degree).
- Add rotation center reposition support.

## Implementation Playbook

### Test Scenarios

- Rotate selected layer with handle drag.
- Apply and verify persisted final angle.
- Leave mode without apply and verify revert.
- Undo/redo applied rotation.

### Edge Cases

- Tiny layers with small handle hit area.
- Very high zoom and very low zoom cases.
- Parent-child transforms after rotation.

### Integration Checklist

- Session starts only with valid selected layer.
- Preview updates stage overlays continuously.
- Apply triggers one history commit.

### Troubleshooting

- If angle jumps, inspect initial pointer baseline math.
- If revert fails, verify captured session snapshot.
- If children mismatch, verify transform propagation path.

### Extension Ideas

- Add direct keyboard angle nudge.
- Add horizontal/vertical alignment snap.
- Add custom pivot UI.

### Quick Validation Notes

- Confirm rotation preview tracks pointer smoothly.
- Confirm apply commits final angle only once.
- Confirm revert restores baseline transform.
- Confirm overlays remain aligned while rotating.

### Release Notes

- Re-validate rotate handle hit target after style updates.
- Re-validate apply/revert behavior after session lifecycle changes.
