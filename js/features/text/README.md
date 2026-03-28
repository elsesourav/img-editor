# Text Feature

## Purpose

Creates and edits text layers, including popup-based text creation and options panel text updates.

## Main File

- TextTools.js

## Workflow

1. Open Add Text popup.
2. Generate text asset from typography inputs.
3. Insert text layer and allow editing in options panel.
4. Rebuild text asset when metadata changes.

## How To Use

- Create with createTextTools({...deps}).
- Call createTextLayer() from toolbar.
- Call applyTextMetaToLayer(layer, nextMeta, options) for updates.

## Notes

- Text is rendered to image assets for consistent filter/shadow pipeline behavior.
- Includes family/size/weight/color controls.

## Extended Feature Documentation

### Responsibility Matrix

- Handles text creation popup and metadata editing.
- Converts text metadata to renderable layer asset.
- Synchronizes text updates with editor selection workflow.

### Detailed Runtime Flow

1. User opens Add Text popup.
2. Runtime builds preview from typography fields.
3. Confirm creates text layer asset and inserts layer.
4. Option panel edits rebuild text asset in place.
5. Commit persists change in history.

### Metadata Contract

- content
- color
- fontSize
- fontWeight
- fontFamily

### Integration Points

- Uses createLayer and selection APIs from main runtime.
- Works with shadow/filter/stroke pipeline through layer image output.

### Error Handling

- Enforces font size and weight bounds.
- Applies fallback values for missing metadata.

### Performance Notes

- Asset rebuild should be scoped to edited text layer only.
- Avoid expensive rerenders for non-selected layers.

### Maintenance Checklist

- Validate popup controls for all supported fonts.
- Verify text editing under template mode where applicable.

### Future Enhancements

- Add multiline alignment controls.
- Add letter spacing and line height controls.
- Add text style preset library.

## Implementation Playbook

### Test Scenarios

- Create text with each supported font family.
- Update color/size/weight and verify preview.
- Apply shadow and stroke on text layer output.
- Undo/redo text metadata updates.

### Edge Cases

- Empty content string handling.
- Very large font size and long strings.
- Missing font availability in browser.

### Integration Checklist

- Text popup output maps to metadata contract.
- Asset rebuild updates only the target layer.
- History commits once per confirmed apply path.

### Troubleshooting

- If blurry output appears, inspect canvas scale and DPR handling.
- If style mismatch appears, inspect metadata-to-render mapping.
- If edits not visible, inspect selected layer identity and refresh timing.

### Extension Ideas

- Add curved text path rendering.
- Add gradients and outline presets.
- Add rich text span styling.

### Quick Validation Notes

- Confirm text baseline and bounds are stable after edits.
- Confirm style changes regenerate only selected text layer.
- Confirm font fallback is applied when family is unavailable.
- Confirm edited text participates in export pipeline correctly.
