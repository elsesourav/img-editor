# Keyboard Shortcuts Feature

## Purpose

Centralizes global keyboard shortcuts for editor modes, zoom, layer actions, and history.

## Main File

- KeyboardShortcuts.js

## Workflow

1. Register shortcut map at app startup.
2. Resolve modifiers and active mode restrictions.
3. Trigger delegated callbacks.

## How To Use

- Call setupKeyboardShortcuts({...callbacks}).
- Provide handlers for zoom, mode switch, duplicate, delete, apply actions.

## Notes

- Prevent default browser zoom conflicts.
- Keep shortcuts mode-aware to avoid accidental actions.

## Extended Feature Documentation

### Responsibility Matrix

- Maps keyboard combinations to editor actions.
- Enforces mode and context guards.
- Prevents browser-level shortcut conflicts when required.

### Detailed Runtime Flow

1. Register global keydown listeners.
2. Resolve modifier combo and active context.
3. Route to callback API from main runtime.
4. Prevent default for conflicting browser shortcuts.

### Integration Contracts

- setupKeyboardShortcuts receives action callbacks.
- Runtime must provide mode-aware action handlers.

### Reliability Rules

- Never trigger destructive actions without valid selection.
- Respect template mode restrictions.

### Performance Notes

- Key handling is lightweight and synchronous.
- Avoid expensive recomputation in keydown handlers.

### Maintenance Checklist

- Keep hint labels aligned with shortcut behavior.
- Validate shortcuts on macOS and Windows keyboard layouts.

### Future Enhancements

- Add customizable shortcut mapping.
- Add shortcut cheat sheet modal.
- Add focus-scope aware shortcut routing.

## Implementation Playbook

### Test Scenarios

- Undo/redo shortcuts on macOS and Windows.
- Zoom shortcuts with active input and without.
- Mode switch shortcuts in template mode.
- Delete/duplicate shortcuts with selection.

### Edge Cases

- Browser-level shortcut conflicts.
- Repeated keydown auto-repeat behavior.
- Focus inside popup/input controls.

### Integration Checklist

- Callbacks are defined before registration.
- Mode guards are validated per action.
- PreventDefault is used only where necessary.

### Troubleshooting

- If shortcut is ignored, inspect focused element guard.
- If browser zoom triggers, verify modifier match logic.
- If wrong action fires, inspect key normalization.

### Extension Ideas

- Add command palette integration.
- Add user profile shortcut sets.
- Add telemetry for shortcut discoverability.

### Quick Validation Notes

- Confirm shortcuts are ignored inside text inputs.
- Confirm modifier keys map correctly on macOS.
- Confirm mode-gated shortcuts remain blocked when expected.
- Confirm duplicate/delete shortcuts require valid selection.

### Release Notes

- Keep this mapping list synced with toolbar hint labels.
- Re-test critical shortcuts after any mode or focus logic change.
