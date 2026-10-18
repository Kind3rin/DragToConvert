# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-10-18

### Fixed
- Installer file name no longer contains spaces, so it matches the entries in `SHA256SUMS.txt` and downloads cleanly.

## [1.0.0] - 2026-10-18

First public release.

### Added
- Drag a file in File Explorer or on the desktop with **Shift** held: a two-ring wheel opens around the cursor (formats on the outer ring, tools on the inner ring) and the converted copy is saved next to the original.
- Optional **Just drag** trigger: the wheel appears after a short pause, no modifier key needed.
- Image conversion between JPG, PNG, WEBP, AVIF, TIFF, GIF, BMP, ICO and PDF; HEIC/HEIF, SVG, BMP and ICO input.
- Video conversion to MP4, WEBM, MOV, MKV, GIF and MP3; audio conversion to MP3, WAV, FLAC, OGG, M4A and OPUS.
- Quick tools: compress, resize, grayscale, rotate, strip EXIF, 720p/480p, mute, normalize, mono.
- Batch conversion with live progress, English and Italian interface, tray menu with settings and per-user installer.
