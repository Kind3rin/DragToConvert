# Security policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's private
[security advisory form](https://github.com/Kind3rin/DragToConvert/security/advisories/new) instead.
You can expect a first reply within a few days.

## Design notes relevant to security

- The app is fully offline: it opens no network connections and has no auto-update or telemetry.
- It installs a global low-level mouse and keyboard hook, but only uses it to detect the start of a drag (button state, pointer movement, Shift). Keystrokes are never stored or logged.
- Source files are never modified or deleted; conversions always write a new file.
- The overlay window runs with `contextIsolation`, `sandbox` and a strict Content-Security-Policy, and navigation is blocked.
