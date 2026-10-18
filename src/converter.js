const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { current } = require('./i18n');

let ffmpegPath = 'ffmpeg';
try {
  ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
} catch { /* usa ffmpeg dal PATH */ }

const IMG = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tif', 'tiff', 'bmp', 'heic', 'heif', 'ico', 'svg'];
const VID = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'wmv', 'flv', 'mpg', 'mpeg', '3gp'];
const AUD = ['mp3', 'wav', 'flac', 'ogg', 'oga', 'm4a', 'aac', 'opus', 'wma'];

function categoryOf(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (IMG.includes(ext)) return 'image';
  if (VID.includes(ext)) return 'video';
  if (AUD.includes(ext)) return 'audio';
  return null;
}

function uniquePath(dir, base, ext) {
  let candidate = path.join(dir, base + ext);
  for (let i = 1; fs.existsSync(candidate); i++) candidate = path.join(dir, `${base} (${i})${ext}`);
  return candidate;
}

function tmpPathFor(out) {
  const p = path.parse(out);
  return path.join(p.dir, `.${p.name}.dtc-${process.pid}${p.ext}`);
}

function lastLines(text) {
  return text.trim().split(/\r?\n/).slice(-3).join(' ').slice(0, 300);
}

/* ---------------------------------- ffmpeg --------------------------------- */

function runFfmpeg(args, onProgress = () => {}, stdinBuffer = null) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ['-hide_banner', '-y', ...(stdinBuffer ? [] : ['-nostdin']), ...args], { windowsHide: true });
    let duration = 0;
    let errText = '';
    p.stderr.on('data', (d) => {
      const s = d.toString();
      errText = (errText + s).slice(-4000);
      if (!duration) {
        const m = /Duration:\s*(\d+):(\d+):(\d+\.?\d*)/.exec(s);
        if (m) duration = +m[1] * 3600 + +m[2] * 60 + +m[3];
      }
      const times = [...s.matchAll(/time=(\d+):(\d+):(\d+\.?\d*)/g)];
      if (times.length && duration) {
        const t = times[times.length - 1];
        onProgress(Math.min(0.99, (+t[1] * 3600 + +t[2] * 60 + +t[3]) / duration));
      }
    });
    p.on('error', (e) => reject(new Error(current().err.noFfmpeg + e.message)));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg: ' + lastLines(errText)))));
    if (stdinBuffer) {
      p.stdin.on('error', () => {});
      p.stdin.end(stdinBuffer);
    }
  });
}

function ffmpegToPng(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ['-hide_banner', '-nostdin', '-i', file, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], { windowsHide: true });
    const chunks = [];
    let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => (err = (err + d.toString()).slice(-2000)));
    p.on('error', reject);
    p.on('close', (c) => (c === 0 && chunks.length ? resolve(Buffer.concat(chunks)) : reject(new Error(current().err.readImage + lastLines(err)))));
  });
}

const X264 = ['-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p'];
const EVEN = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
const AUDIO_ENC = {
  mp3: ['-c:a', 'libmp3lame', '-q:a', '2'],
  wav: ['-c:a', 'pcm_s16le'],
  flac: ['-c:a', 'flac'],
  ogg: ['-c:a', 'libvorbis', '-q:a', '5'],
  m4a: ['-c:a', 'aac', '-b:a', '192k'],
  aac: ['-c:a', 'aac', '-b:a', '192k'],
  opus: ['-c:a', 'libopus', '-b:a', '128k'],
};

/** Restituisce { ext, suffix, args } per l'azione richiesta su video/audio. */
function mediaPlan(cat, srcExt, action) {
  const { mode, id } = action;
  if (cat === 'video') {
    if (mode === 'format') {
      switch (id) {
        case 'mp4': return { ext: '.mp4', args: ['-map', '0:v:0', '-map', '0:a:0?', ...X264, '-crf', '21', '-vf', EVEN, '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart'] };
        case 'mov': return { ext: '.mov', args: ['-map', '0:v:0', '-map', '0:a:0?', ...X264, '-crf', '21', '-vf', EVEN, '-c:a', 'aac', '-b:a', '160k'] };
        case 'mkv': return { ext: '.mkv', args: ['-map', '0:v:0', '-map', '0:a:0?', ...X264, '-crf', '21', '-vf', EVEN, '-c:a', 'aac', '-b:a', '160k'] };
        case 'webm': return { ext: '.webm', args: ['-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-row-mt', '1', '-cpu-used', '4', '-c:a', 'libopus', '-b:a', '128k'] };
        case 'gif': return { ext: '.gif', args: ['-an', '-filter_complex', "[0:v:0]fps=15,scale='min(640,iw)':-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse[out]", '-map', '[out]', '-loop', '0'] };
        case 'mp3': return { ext: '.mp3', args: ['-map', '0:a:0', '-vn', ...AUDIO_ENC.mp3] };
      }
    } else {
      switch (id) {
        case 'compress': return { ext: '.mp4', suffix: 'compress', args: ['-map', '0:v:0', '-map', '0:a:0?', ...X264, '-crf', '28', '-vf', EVEN, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'] };
        case 'p720': return { ext: '.mp4', suffix: 'p720', args: ['-map', '0:v:0', '-map', '0:a:0?', ...X264, '-crf', '23', '-vf', 'scale=-2:min(720\\,trunc(ih/2)*2)', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'] };
        case 'p480': return { ext: '.mp4', suffix: 'p480', args: ['-map', '0:v:0', '-map', '0:a:0?', ...X264, '-crf', '24', '-vf', 'scale=-2:min(480\\,trunc(ih/2)*2)', '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart'] };
        case 'mute': return { ext: '.' + srcExt, suffix: 'mute', args: ['-map', '0:v:0', '-c:v', 'copy', '-an'] };
      }
    }
  } else if (cat === 'audio') {
    const vn = ['-map', '0:a:0', '-vn'];
    if (mode === 'format' && AUDIO_ENC[id]) return { ext: '.' + id, args: [...vn, ...AUDIO_ENC[id]] };
    if (mode === 'tool') {
      const keep = AUDIO_ENC[srcExt] ? srcExt : 'mp3';
      switch (id) {
        case 'compress': return { ext: '.mp3', suffix: 'compress', args: [...vn, '-c:a', 'libmp3lame', '-b:a', '128k'] };
        case 'normalize': return { ext: '.' + keep, suffix: 'normalize', args: [...vn, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', ...AUDIO_ENC[keep]] };
        case 'mono': return { ext: '.' + keep, suffix: 'mono', args: [...vn, '-ac', '1', ...AUDIO_ENC[keep]] };
      }
    }
  }
  throw new Error(current().err.unsupportedAction);
}

async function convertMedia(file, cat, action, onProgress) {
  const srcExt = path.extname(file).slice(1).toLowerCase();
  const plan = mediaPlan(cat, srcExt, action);
  const { dir, name } = path.parse(file);
  const out = uniquePath(dir, plan.suffix ? `${name} (${current().suffix[plan.suffix]})` : name, plan.ext);
  const tmp = tmpPathFor(out);
  try {
    await runFfmpeg(['-i', file, ...plan.args, tmp], onProgress);
    fs.renameSync(tmp, out);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  return out;
}

/* --------------------------------- immagini -------------------------------- */

async function loadImage(file, ext, animated) {
  if (ext === 'heic' || ext === 'heif') {
    const convert = require('heic-convert');
    const png = await convert({ buffer: fs.readFileSync(file), format: 'PNG' });
    return sharp(Buffer.from(png), { limitInputPixels: false });
  }
  if (ext === 'bmp' || ext === 'ico') return sharp(await ffmpegToPng(file));
  const opts = { limitInputPixels: false };
  if (animated) opts.animated = true;
  if (ext === 'svg') opts.density = 192;
  return sharp(file, opts);
}

function orient(img) {
  return typeof img.autoOrient === 'function' ? img.autoOrient() : img.rotate();
}

async function encodeBmp(img) {
  const { data, info } = await img.flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const row = (w * 3 + 3) & ~3;
  const out = Buffer.alloc(54 + row * h);
  out.write('BM', 0);
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(w, 18);
  out.writeInt32LE(h, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(row * h, 34);
  out.writeInt32LE(2835, 38);
  out.writeInt32LE(2835, 42);
  for (let y = 0; y < h; y++) {
    let o = 54 + (h - 1 - y) * row;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      out[o++] = data[i + 2];
      out[o++] = data[i + 1];
      out[o++] = data[i];
    }
  }
  return out;
}

async function encodeIco(img) {
  const meta = await img.metadata();
  const maxDim = Math.max(meta.width || 256, meta.height || 256);
  let sizes = [256, 128, 64, 48, 32, 16].filter((s) => s <= maxDim);
  if (!sizes.length) sizes = [16];
  const pngs = [];
  for (const s of sizes) {
    pngs.push(await img.clone().ensureAlpha().resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
  }
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => {
    const o = 6 + i * 16;
    head[o] = s === 256 ? 0 : s;
    head[o + 1] = s === 256 ? 0 : s;
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(pngs[i].length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += pngs[i].length;
  });
  return Buffer.concat([head, ...pngs]);
}

async function encodePdf(img, srcExt) {
  const lossy = srcExt === 'jpg' || srcExt === 'jpeg';
  const buf = lossy ? await img.jpeg({ quality: 92 }).toBuffer() : await img.png().toBuffer();
  const doc = await PDFDocument.create();
  const embedded = lossy ? await doc.embedJpg(buf) : await doc.embedPng(buf);
  const k = Math.min(0.75, 14000 / Math.max(embedded.width, embedded.height));
  const page = doc.addPage([embedded.width * k, embedded.height * k]);
  page.drawImage(embedded, { x: 0, y: 0, width: embedded.width * k, height: embedded.height * k });
  return Buffer.from(await doc.save());
}

/** Codifica `img` nel formato `fmt`; con compress=true usa qualità ridotta. */
async function encode(img, fmt, srcExt, compress = false) {
  switch (fmt) {
    case 'jpg': return img.flatten({ background: '#ffffff' }).jpeg({ quality: compress ? 72 : 90, mozjpeg: true }).toBuffer();
    case 'png': return img.png(compress ? { palette: true, quality: 80, effort: 8, compressionLevel: 9 } : { compressionLevel: 9 }).toBuffer();
    case 'webp': return img.webp({ quality: compress ? 70 : 85 }).toBuffer();
    case 'avif': return img.avif({ quality: compress ? 42 : 60, effort: 4 }).toBuffer();
    case 'tiff': return img.tiff({ compression: 'lzw' }).toBuffer();
    case 'gif': return img.gif().toBuffer();
    case 'bmp': return encodeBmp(img);
    case 'ico': return encodeIco(img);
    case 'pdf': return encodePdf(img, srcExt);
    default: throw new Error('Formato non supportato');
  }
}

const KEEP_FORMAT = { jpg: 'jpg', jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', tif: 'tiff', tiff: 'tiff', gif: 'gif', heic: 'jpg', heif: 'jpg', bmp: 'png', ico: 'png', svg: 'png' };

async function convertImage(file, action, onProgress) {
  const srcExt = path.extname(file).slice(1).toLowerCase();
  const { dir, name } = path.parse(file);
  let fmt;
  let suffix = '';
  if (action.mode === 'format') {
    fmt = action.id;
  } else {
    fmt = KEEP_FORMAT[srcExt];
    suffix = current().suffix[action.id];
    if (!suffix) throw new Error(current().err.unsupportedAction);
  }
  const animated = (srcExt === 'gif' || srcExt === 'webp') && (fmt === 'gif' || fmt === 'webp');
  let img = await loadImage(file, srcExt, animated);
  if (!animated) img = orient(img);
  onProgress(0.3);

  if (action.mode === 'tool') {
    const meta = await img.metadata();
    const w = meta.orientation >= 5 ? meta.height : meta.width;
    if (action.id === 'half') img = img.resize({ width: Math.max(1, Math.round(w * 0.5)) });
    if (action.id === 'quarter') img = img.resize({ width: Math.max(1, Math.round(w * 0.25)) });
    if (action.id === 'gray') img = img.grayscale();
    if (action.id === 'rotate') img = img.rotate(90);
  }
  const buf = await encode(img, fmt, srcExt, action.mode === 'tool' && action.id === 'compress');
  onProgress(0.9);
  const ext = '.' + fmt;
  const out = uniquePath(dir, suffix ? `${name} (${suffix})` : name, ext);
  const tmp = tmpPathFor(out);
  try {
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, out);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  return out;
}

/** Esegue l'azione su un file e restituisce il percorso del nuovo file. */
async function run(file, action, onProgress = () => {}) {
  const cat = categoryOf(file);
  if (!cat) throw new Error(current().err.unsupportedType);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) throw new Error(current().err.notFound);
  return cat === 'image' ? convertImage(file, action, onProgress) : convertMedia(file, cat, action, onProgress);
}

module.exports = { run, categoryOf };
