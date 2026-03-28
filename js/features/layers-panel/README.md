# Layers Panel Feature

## Purpose

Implements drag-and-drop ordering and parenting behavior in the layers side panel.

## Main File

- LayersPanelDragDrop.js

## Workflow

1. User drags a layer item.
2. Drop on another item to make child and reposition block.
3. Drop on empty root area to move layer back to root.
4. Normalize z-order after movement.

## How To Use

- Use attachLayersPanelDragAndDrop({ item, layerId, layersList, ... }).
- Call refresh + commitHistory in onDropApplied callback.

## Notes

- Prevents cyclic parent-child relationships.
- Moves full descendant blocks together.

## Extended Feature Documentation

### Responsibility Matrix

- Handles DnD interactions inside layer hierarchy panel.
- Applies parent-child assignment and block reordering.
- Maintains valid z-order after drop actions.

### Detailed Runtime Flow

1. Drag starts from source layer item.
2. Hover target computes child-attach intent.
3. Drop applies parenting and movement logic.
4. Root-drop path detaches layer to top-level.
5. Normalize z-order and trigger refresh/commit.

### Safety Rules

- Prevent descendant cycle creation.
- Preserve block integrity for descendants.
- Ignore invalid drop targets.

### Integration Points

- Layer list rendering in main runtime.
- Selection updates after successful drop.
- History commits via drop callback.

### Performance Notes

- Keep hover class updates minimal.
- Avoid repeated full list regeneration during dragover.

### Maintenance Checklist

- Validate parent badges and indentation after reorder.
- Verify drop behavior with deep nesting.

### Future Enhancements

- Add drop indicators for before/after placement.
- Add multi-select layer move support.
- Add collapse/expand tree view state.

## Implementation Playbook

### Test Scenarios

- Reorder sibling layers and verify z-order.
- Attach layer as child and verify hierarchy.
- Drop to root and verify parent reset.
- Undo/redo hierarchy changes.

### Edge Cases

- Deep hierarchy moves with many descendants.
- Drop on invalid target or self-target.
- Rapid drag enter/leave flicker paths.

### Integration Checklist

- Selection persists appropriately after drop.
- Commit occurs once per completed drop.
- Visual badges update after hierarchy changes.

### Troubleshooting

- If cycles appear, inspect descendant-check function.
- If order is wrong, inspect block extraction/insertion logic.
- If panel desyncs, verify refresh call timing.

### Extension Ideas

- Add keyboard-assisted reordering.
- Add tree virtualization for large projects.
- Add lock-aware drop restrictions.

### Quick Validation Notes

- Confirm drop highlights clear after drag end.
- Confirm moved block keeps internal child order.
- Confirm root detachment removes parent reference.
- Confirm z-order normalization matches visual order.
