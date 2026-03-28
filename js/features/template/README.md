# Template Feature

## Purpose

Provides custom template save/open/edit/import/export workflows with template mode inputs.

## Main Files

- CustomTemplateController.js
- CustomTemplatePopup.js

## Workflow

1. Save current state as template with lock choices.
2. Persist in localStorage.
3. Open template in template mode or editor mode.
4. Fill editable slots and export/update as needed.

## How To Use

- Create controller with createCustomTemplateController({...deps}).
- Use pickTemplate() for popup action routing.
- Use applyTemplate(template) to instantiate runtime layers.

## Notes

- Supports JSON import/export.
- Enforces template size cap for localStorage safety.

## Extended Feature Documentation

### Responsibility Matrix

- Manages template persistence and retrieval.
- Handles popup-driven template actions.
- Applies saved template snapshots to live state.

### Detailed Runtime Flow

1. Save flow collects lock preferences and template name.
2. Snapshot captures layers and related metadata.
3. Data is written to localStorage.
4. Picker flow resolves open/edit/delete/export/import action.
5. Apply flow reconstructs runtime layer state.

### Template Mode

- Hides non-template actions and focuses slot inputs.
- Locked slots keep fixed content.
- Editable slots expose upload/text controls.

### Integration Points

- Startup popup can display saved templates.
- Export popup includes save-template shortcut.
- Main runtime controls template session mode.

### Error Handling

- Validate imported JSON payload structure.
- Guard against duplicate IDs.
- Return safe null/false on invalid template.

### Performance Notes

- Cap number of stored templates.
- Enforce size threshold for storage reliability.

### Maintenance Checklist

- Keep snapshot schema backward compatible.
- Verify lock behavior with nested layers.

### Future Enhancements

- Add template tags and search.
- Add template version migration utility.
- Add cloud sync integration path.

## Implementation Playbook

### Test Scenarios

- Save template with mixed locked/unlocked slots.
- Open template in template mode and fill editable slots.
- Import valid JSON and export same template.
- Delete template and verify storage cleanup.

### Edge Cases

- Corrupt JSON import content.
- Duplicate template IDs in imported payload.
- Storage quota limit reached.

### Integration Checklist

- Startup add-layer includes saved templates.
- Export popup save-template shortcut remains functional.
- Template mode restrictions are applied consistently.

### Troubleshooting

- If load fails, inspect schema validation and fallback paths.
- If lock state breaks, inspect slot metadata mapping.
- If template not listed, inspect storage key retrieval.

### Extension Ideas

- Add thumbnail regeneration command.
- Add project-level template categories.
- Add shared library sync endpoint.

### Quick Validation Notes

- Confirm imported templates appear immediately in picker.
- Confirm delete action removes storage entry reliably.
- Confirm slot locks remain stable after reopen.
- Confirm template mode exits cleanly to normal editor mode.
