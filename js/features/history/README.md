# History Feature

## Purpose

Tracks undo/redo snapshots for editor state changes.

## Main File

- HistoryManager.js

## Workflow

1. Commit state after meaningful operations.
2. Undo moves backward in snapshot stack.
3. Redo restores forward snapshots.

## How To Use

- Create with createHistoryManager({ onStateApplied }).
- Call commit() after edits.
- Use canUndo()/canRedo() to update toolbar button state.

## Notes

- Avoid committing every pointer frame.
- Commit once at logical action boundaries.

## Extended Feature Documentation

### Responsibility Matrix

- Maintains undo and redo stacks.
- Applies snapshots back into shared editor state.
- Exposes stack capability helpers for UI.

### Detailed Runtime Flow

1. Feature action mutates state preview.
2. Action completion calls commit().
3. Undo pops current and restores previous snapshot.
4. Redo reapplies forward snapshot.
5. UI updates button enabled states.

### Snapshot Strategy

- Store only required serializable state.
- Keep stack size bounded for memory safety.
- Ensure deep copy semantics for nested layer data.

### Integration Points

- Main runtime toolbar handlers.
- Keyboard shortcut handlers.
- Feature apply boundaries.

### Error Handling

- Ignore undo/redo when unavailable.
- Prevent stack corruption on invalid snapshots.

### Performance Notes

- Avoid commit storms in drag loops.
- Rehydrate state only on user-requested undo/redo.

### Maintenance Checklist

- Verify commit points after each feature change.
- Validate undo/redo in template mode workflows.

### Future Enhancements

- Add grouped transaction API.
- Add lightweight diff snapshots.
- Add visual timeline debugging panel.

## Implementation Playbook

### Test Scenarios

- Undo/redo after move, resize, and crop.
- Undo/redo after filter and shadow apply.
- Undo/redo after template apply/edit.
- Stack limit behavior under repeated commits.

### Edge Cases

- Commit attempts with invalid state references.
- Redo stack clearing after new commit branch.
- Rapid alternating undo/redo commands.

### Integration Checklist

- Commit only at logical operation boundaries.
- Toolbar enabled states reflect stack availability.
- Keyboard shortcuts map consistently to history APIs.

### Troubleshooting

- If undo skips actions, inspect commit timing.
- If redo breaks, inspect stack branch reset logic.
- If snapshots mutate, verify deep clone semantics.

### Extension Ideas

- Add named transactions for grouped actions.
- Add snapshot compression strategy.
- Add time-travel debug inspector.

### Quick Validation Notes

- Confirm undo does nothing at stack floor.
- Confirm redo does nothing at stack ceiling.
- Confirm new commit clears forward redo branch.
- Confirm history state survives mode switches.
