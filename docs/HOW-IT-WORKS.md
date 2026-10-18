# How DragToConvert works

The idea is simple (a wheel of formats appears while you drag a file), but Windows makes it less obvious than it sounds: the drag belongs to *another* process (Explorer), and our overlay has to show up in the middle of it and become a valid drop target. This page explains the pieces.

```
 mouse/keyboard                    Explorer (drag source)
      │                                   │  OLE drag & drop (DoDragDrop)
      ▼                                   ▼
 ┌─────────────┐  trigger   ┌──────────────────────────┐   drop    ┌───────────────┐
 │ uiohook-napi│──────────▶│ Overlay window (Electron) │──────────▶│ converter.js  │
 │ global hook │  show at   │ transparent, topmost,     │ paths +   │ sharp / ffmpeg│
 └─────────────┘  cursor    │ HTML5 drag & drop         │ action    └───────┬───────┘
        ▲                   └──────────────────────────┘                    │
        │ koffi: which window is under the cursor?                          ▼
        └── Win32 WindowFromPoint / GetAncestor / GetClassNameW      file saved next to
                                                                       the original
```

## 1. Knowing when a file drag starts

`src/main.js` installs a global low-level mouse and keyboard hook with [`uiohook-napi`](https://github.com/SnosMe/uiohook-napi). It tracks three things: is the left button down, has the pointer moved more than 8 px since, and is `Shift` held.

To avoid popping up when you select text or rubber-band select files, the hook also checks **where the drag started**. With `koffi` the app calls the Win32 functions `WindowFromPoint`, `GetAncestor(GA_ROOT)` and `GetClassNameW` on the point where the button went down. Only drags starting in File Explorer (`CabinetWClass`), the desktop (`Progman`/`WorkerW`) or a file dialog (`#32770`) arm the trigger, unless *Also work outside File Explorer* is on.

Two triggers exist: **Shift** (instant) and **Pause** (the pointer stays still for 450 ms while the button is held).

## 2. Showing an overlay *during* someone else's drag

The overlay is a frameless, transparent, always-on-top, non-focusable `BrowserWindow`. A few details make it work reliably:

- **It is always "visible", but parked off-screen** at `(-20000, -20000)`. A window that was never painted is not hit-testable, so showing a hidden window mid-drag would miss the first moments of the drag. Moving a painted window on-screen is instant.
- **It has a near-invisible background** (`rgba(0,0,0,0.02)`). Fully transparent pixels of a layered window are click-through, and a drag cannot enter a window that mouse input passes through. 2 % alpha makes the whole window a valid target without being visible.
- **`moveTop()`** puts it above other topmost windows.
- **A 1 px mouse "nudge"** (`mouse_event` ±1 px) is sent right after showing it. The OLE drag loop only re-evaluates the window under the cursor on a mouse move, so without it the first `dragenter` can be delayed until the user moves.
- A **probe timer** hides the overlay if no `dragenter` arrives within 1.2 s. That's how a plain `Shift` + rubber-band selection (not a file drag) gets rejected without any visible flash.

## 3. Receiving the drop

Chromium registers the window as an OLE drop target, so the wheel is just HTML5 drag-and-drop: `dragenter` reveals the wheel (and tells us which MIME types are being dragged so the right formats are listed), `dragover` does geometry-based hit-testing on the two rings (angle + distance from the hub, so there are no dead gaps between slices), and `drop` hands the file paths to the main process through `webUtils.getPathForFile`.

The drop effect is forced to `copy` (never `move`), so Explorer will never delete the source file.

## 4. Converting

`src/converter.js` picks a pipeline from the file extension:

| Kind | Engine | Notes |
| --- | --- | --- |
| Images | [`sharp`](https://sharp.pixelplumbing.com) (libvips) | HEIC input via `heic-convert`; BMP/ICO input decoded by FFmpeg; BMP, ICO and PDF output are encoded in JS (`pdf-lib`, hand-written BMP/ICO writers) |
| Video / audio | FFmpeg (`ffmpeg-static`) | Progress is parsed from FFmpeg's `time=` output against the `Duration:` line |

Outputs are written to a hidden temporary file in the same folder and then renamed, so you never see a half-written result, and a name that exists is never overwritten (`name (1).ext`).

## Project layout

```
src/
  main.js        tray, global hook, overlay lifecycle, IPC
  converter.js   conversion pipelines
  catalog.js     what appears on each ring, per file type
  i18n.js        English / Italian strings
  overlay.*      the wheel UI (HTML, CSS, JS)
  preload.js     safe bridge between the overlay and the main process
scripts/         self-test, icon and screenshot generators
docs/            this page and README images
```

## Security notes

The overlay runs with `contextIsolation` and `sandbox` enabled, a strict Content-Security-Policy, and navigation is blocked. The only API exposed to the page is the small bridge in `preload.js`. The app does not open any network connection.
