# Third-party notices

DragToConvert's own source code is released under the [MIT License](LICENSE).

The installer and the packaged app (the release binaries) also contain the third-party components below, each under its own license. Their full license texts ship with the installed app (`resources/app.asar.unpacked/node_modules/**` and `LICENSES.chromium.html` next to the executable).

| Component | Used for | License |
| --- | --- | --- |
| [Electron](https://www.electronjs.org) (includes Chromium) | App shell and overlay UI | MIT, plus Chromium's third-party licenses |
| [FFmpeg](https://ffmpeg.org) via [`ffmpeg-static`](https://github.com/eugeneware/ffmpeg-static) | Video and audio conversion | **GPL-3.0-or-later** (the static build includes GPL components such as x264) |
| [sharp](https://sharp.pixelplumbing.com) and libvips | Image conversion | Apache-2.0; libvips and bundled libraries are LGPL-3.0-or-later and others |
| [heic-convert](https://github.com/catdad-experiments/heic-convert) and libheif-js | Reading HEIC/HEIF | ISC; libheif-js is LGPL-3.0 |
| [pdf-lib](https://pdf-lib.js.org) | Writing PDF | MIT |
| [uiohook-napi](https://github.com/SnosMe/uiohook-napi) and libuiohook | Global mouse/keyboard hook | MIT |
| [koffi](https://koffi.dev) | Calling Win32 APIs | MIT |
| [electron-builder](https://www.electron.build) | Packaging (build time only) | MIT |

## About FFmpeg and the GPL

DragToConvert runs FFmpeg as a **separate program** (a child process); the two are not linked together. The FFmpeg binary comes unmodified from the `ffmpeg-static` npm package, which downloads the build published at <https://github.com/eugeneware/ffmpeg-static/releases> (FFmpeg release `b6.1.1`). The corresponding FFmpeg source code is available from <https://ffmpeg.org/download.html> and the build scripts from the `ffmpeg-static` repository.

If you want a build that avoids GPL components, point DragToConvert at your own LGPL FFmpeg build by replacing the file in `resources/app.asar.unpacked/node_modules/ffmpeg-static/`, or remove `ffmpeg-static` and have `ffmpeg` available on your `PATH` (the app falls back to it automatically).

This is a good-faith summary, not legal advice. If you redistribute binaries, check that your use complies with each license above.
