// OpenUI mounts an inspector button in development unless this flag is already set. The chat has
// its own button, so the inspector is kept out. This module must be imported before OpenUI.
;(globalThis as Record<symbol, unknown>)[Symbol.for('openui.devtools.autoMount')] = true
