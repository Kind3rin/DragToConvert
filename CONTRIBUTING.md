# Contributing

Thanks for wanting to help! DragToConvert is a small personal project, so the process is light.

## Getting started

```bash
git clone https://github.com/Kind3rin/DragToConvert.git
cd DragToConvert
npm install
npm start
```

Useful while working:

- `npm run demo -- --hover=3 --mime=video/mp4` shows the wheel without needing to drag anything.
- `npm run selftest -- <folder>` runs every converter on a `pic.png` and a `clip.mp4` placed in `<folder>`. Create them with FFmpeg: `ffmpeg -f lavfi -i testsrc=size=400x300 -frames:v 1 pic.png` and `ffmpeg -f lavfi -i testsrc=duration=2:size=320x240:rate=25 -f lavfi -i sine=d=2 -shortest clip.mp4`.
- `npm run screenshots` regenerates the images in `docs/img` (do this if you change the look of the wheel).
- Read [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) first: the drag-and-drop part has a few non-obvious tricks.

## Adding a format or tool

1. Add the entry to `src/catalog.js` (and its label/sub-label to both languages in `src/i18n.js`).
2. Implement it in `src/converter.js` (`mediaPlan` for audio/video, `encode` or the tool switch for images).
3. Add it to `scripts/selftest.js` and run the self-test.
4. Update the table in `README.md` and `README.it.md`.

## Guidelines

- Keep the file you drag untouched: conversions must always write a *new* file.
- Keep the app offline: no telemetry, no update pings, no remote assets.
- UI strings go through `src/i18n.js`, never hard-coded.
- Small, focused pull requests with a short description of what you tested.

## Reporting bugs

Open an issue with your Windows version, how you start the drag (Explorer, desktop, other app), the file type, and what happened. A screenshot of the tray menu settings helps too.
