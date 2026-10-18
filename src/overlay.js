const api = window.dtc;
const body = document.body;
const svg = document.getElementById('wheel');
const $ = (id) => document.getElementById(id);

/* Geometria (coordinate CSS = DIP della finestra): anello interno = strumenti, esterno = formati */
const CX = 290, CY = 300;
const RINGS = {
  tools: { r0: 96, r1: 170, hues: [172, 192, 212, 234, 160, 252] },
  formats: { r0: 177, r1: 262, hues: [268, 322, 352, 22, 42, 168, 196, 222, 246] },
};
const NS = 'http://www.w3.org/2000/svg';

const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif',
  'image/tiff': 'tiff', 'image/bmp': 'bmp', 'image/x-ms-bmp': 'bmp', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/flac': 'flac', 'audio/ogg': 'ogg',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/opus': 'opus',
};

const ICONS = {
  compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  resize: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  gray: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="#fff"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/>',
  strip: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  mute: '<path d="M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>',
  norm: '<path d="M3 12h2M7 8v8M11 4v16M15 8v8M19 10v4"/>',
  mono: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
};

let catalog = null;
let S = {}; // stringhe localizzate fornite dal processo principale
let category = 'image';
let excluded = new Set();
let fileCount = 1;
let segments = []; // { kind, opt, a0, a1, mid, ring }
let hover = -1;
let state = 'idle'; // idle | busy | done | error
let lastOutput = null;
let hideTimeout = null;

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};

function sectorPath(r0, r1, a0, a1) {
  const p = (r, a) => `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)}A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

function setState(s) {
  state = s;
  body.classList.remove('idle', 'busy', 'done', 'error');
  body.classList.add(s);
}

function optionsFor(kind) {
  return (catalog[kind][category] || []).filter((o) => kind === 'tools' || !excluded.has(o.id));
}

function buildWheel() {
  svg.innerHTML = '';
  hover = -1;
  body.classList.remove('has-hover');
  segments = [];
  const defs = el('defs', {}, svg);
  const sheen = el('linearGradient', { id: 'sheen', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.28 }, sheen);
  el('stop', { offset: 0.55, 'stop-color': '#fff', 'stop-opacity': 0 }, sheen);

  let order = 0;
  for (const kind of ['formats', 'tools']) {
    const opts = optionsFor(kind);
    const n = opts.length;
    if (!n) continue;
    const { r0, r1, hues } = RINGS[kind];
    const step = (Math.PI * 2) / n;
    const start = -Math.PI / 2 - step / 2;
    const pad = 5;
    const gapAngle = kind === 'tools' ? 0.06 : 0.045;

    opts.forEach((opt, i) => {
      const idx = segments.length;
      const hue = hues[i % hues.length];
      const a0 = start + i * step + gapAngle + pad / r1;
      const a1 = start + (i + 1) * step - gapAngle - pad / r1;
      const mid = start + (i + 0.5) * step;
      segments.push({ kind, opt, mid, r0, r1, step, start, i, n });

      const grad = el('linearGradient', { id: `g${idx}`, gradientUnits: 'userSpaceOnUse', x1: CX + Math.cos(mid) * r0, y1: CY + Math.sin(mid) * r0, x2: CX + Math.cos(mid) * r1, y2: CY + Math.sin(mid) * r1 }, defs);
      el('stop', { offset: 0, 'stop-color': `hsl(${hue} 78% ${kind === 'tools' ? 36 : 40}%)` }, grad);
      el('stop', { offset: 1, 'stop-color': `hsl(${(hue + 28) % 360} 92% ${kind === 'tools' ? 52 : 58}%)` }, grad);

      const pop = el('g', { class: 'seg-pop', style: `--i:${order++}` }, svg);
      const g = el('g', { class: 'seg ' + kind, 'data-i': idx, style: `--dx:${(Math.cos(mid) * 12).toFixed(1)}px;--dy:${(Math.sin(mid) * 12).toFixed(1)}px;--glow:hsl(${hue} 100% 62% / .85)` }, pop);
      const d = sectorPath(r0 + pad, r1 - pad, a0, a1);
      el('path', { class: 'body', d, fill: `url(#g${idx})`, stroke: `url(#g${idx})` }, g);
      el('path', { class: 'sheen', d }, g);

      const rm = (r0 + r1) / 2 + 1;
      const tx = CX + Math.cos(mid) * rm;
      const ty = CY + Math.sin(mid) * rm;
      if (kind === 'tools') {
        const ic = el('g', { class: 'ico', transform: `translate(${(tx - 9).toFixed(1)} ${(ty - 22).toFixed(1)}) scale(0.75)` }, g);
        ic.innerHTML = ICONS[opt.icon] || '';
        const t = el('text', { class: 'lbl tool', x: tx.toFixed(1), y: (ty + 14).toFixed(1) }, g);
        t.textContent = opt.label;
      } else {
        const t = el('text', { class: 'lbl', x: tx.toFixed(1), y: (ty + 3).toFixed(1) }, g);
        t.textContent = opt.label;
        const s = el('text', { class: 'sub', x: tx.toFixed(1), y: (ty + 21).toFixed(1) }, g);
        s.textContent = opt.sub;
      }
    });
  }
  updateHub();
}

const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);

function updateHub() {
  const eyebrow = $('eyebrow'), big = $('bigLabel'), small = $('smallLabel');
  const seg = segments[hover];
  if (seg) {
    eyebrow.textContent = seg.kind === 'tools' ? S.apply : S.convertTo;
    big.textContent = seg.opt.label;
    big.className = 'big' + (seg.opt.label.length > 6 ? ' fit' : '');
    small.textContent = fileCount > 1 ? fmt(S.releaseN, { n: fileCount }) : seg.kind === 'tools' ? seg.opt.sub : S.dropHere;
  } else {
    eyebrow.textContent = fileCount > 1 ? fmt(S.nFiles, { n: fileCount }) : S.dropOn;
    big.textContent = S.choose;
    big.className = 'big';
    small.textContent = S.formatOrTool;
  }
}

function setHover(i) {
  if (i === hover) return;
  const prev = svg.querySelector('.seg.hover');
  if (prev) prev.classList.remove('hover');
  hover = i;
  if (i >= 0) {
    const g = svg.querySelector(`.seg[data-i="${i}"]`);
    if (g) g.classList.add('hover');
  }
  body.classList.toggle('has-hover', i >= 0);
  updateHub();
}

function hitTest(x, y) {
  const dx = x - CX, dy = y - CY;
  const dist = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const firstTools = segments.findIndex((s) => s.kind === 'tools');
  const first = { formats: segments.findIndex((s) => s.kind === 'formats'), tools: firstTools };
  let kind = null;
  if (dist >= RINGS.tools.r0 - 4 && dist < (RINGS.tools.r1 + RINGS.formats.r0) / 2) kind = 'tools';
  else if (dist >= (RINGS.tools.r1 + RINGS.formats.r0) / 2 && dist <= RINGS.formats.r1 + 36) kind = 'formats';
  if (!kind || first[kind] < 0) return -1;
  const s = segments[first[kind]];
  let rel = ang - s.start;
  rel = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return first[kind] + Math.min(s.n - 1, Math.floor(rel / s.step));
}

/* ------------------------------ eventi di drag ------------------------------ */

function inspectDrag(dt) {
  const items = [...dt.items].filter((it) => it.kind === 'file');
  fileCount = Math.max(1, items.length);
  const mimes = items.map((it) => it.type || '');
  const first = mimes.find(Boolean) || 'image/';
  category = first.startsWith('video/') ? 'video' : first.startsWith('audio/') ? 'audio' : 'image';
  const uniq = [...new Set(mimes)];
  excluded = new Set();
  if (uniq.length === 1 && MIME_EXT[uniq[0]]) excluded.add(MIME_EXT[uniq[0]]);
}

function reveal() {
  setState('idle');
  body.classList.add('visible');
}

document.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault();
  if (state !== 'idle') return;
  if (!body.classList.contains('visible') || !segments.length) {
    inspectDrag(e.dataTransfer);
    api.dragActive();
    reveal();
    buildWheel();
  }
});

document.addEventListener('dragover', (e) => {
  if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault();
  // Mai "move": non deve eliminare il file originale.
  const allowed = e.dataTransfer.effectAllowed;
  e.dataTransfer.dropEffect = allowed === 'move' ? 'none' : allowed.toLowerCase().includes('copy') || allowed === 'all' || allowed === 'uninitialized' ? 'copy' : 'link';
  if (state === 'idle') setHover(hitTest(e.clientX, e.clientY));
});

document.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null && (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight)) setHover(-1);
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (state !== 'idle') return;
  const idx = hitTest(e.clientX, e.clientY);
  const files = [...(e.dataTransfer?.files || [])];
  if (idx < 0 || !files.length) {
    api.cancel();
    return;
  }
  const paths = files.map((f) => api.pathFor(f)).filter(Boolean);
  const seg = segments[idx];
  startBusy(seg, paths.length);
  api.convert(paths, { mode: seg.kind, id: seg.opt.id });
});

/* ------------------------------ avanzamento ------------------------------ */

const CIRC = 2 * Math.PI * 92;
function setProgress(p) {
  $('ringFg').style.strokeDashoffset = String(CIRC * (1 - Math.max(0.02, Math.min(1, p))));
  $('pct').textContent = `${Math.round(p * 100)}%`;
}

function startBusy(seg, n) {
  setHover(-1);
  $('ringFg').style.strokeDasharray = String(CIRC);
  $('busyName').textContent = (seg.kind === 'tools' ? seg.opt.label : `→ ${seg.opt.label}`) + (n > 1 ? ` · ${fmt(S.nFiles, { n })}` : '');
  setProgress(0);
  setState('busy');
}

api.on('progress', ({ p, i, n, name }) => {
  if (state !== 'busy') return;
  setProgress(p);
  $('busyName').textContent = n > 1 ? `${i + 1}/${n} · ${name}` : name;
});

api.on('done', ({ ok, failed, n }) => {
  if (ok.length) {
    lastOutput = ok[ok.length - 1];
    const parts = lastOutput.split(/[\\/]/);
    $('doneTitle').textContent = failed.length ? fmt(S.partial, { ok: ok.length, n }) : n > 1 ? fmt(S.nFiles, { n }) : S.done;
    $('doneName').textContent = failed.length ? fmt(S.failedN, { n: failed.length }) : parts[parts.length - 1];
    setState('done');
  } else {
    $('errTitle').textContent = S.error;
    $('errMsg').textContent = (failed[0] && failed[0].error) || S.convFail;
    $('errMsg').title = $('errMsg').textContent;
    setState('error');
  }
});

$('hubDone').addEventListener('click', () => lastOutput && api.reveal(lastOutput));
$('hub').addEventListener('pointerenter', () => api.hold(true));
$('hub').addEventListener('pointerleave', () => api.hold(false));

/* ------------------------------ messaggi da main ------------------------------ */

api.on('overlay:prepare', () => {
  clearTimeout(hideTimeout);
  segments = [];
  svg.innerHTML = '';
  body.classList.remove('visible');
  setState('idle');
});
api.on('overlay:hide', () => {
  body.classList.remove('visible');
  hideTimeout = setTimeout(() => { segments = []; svg.innerHTML = ''; setState('idle'); }, 300);
});

/* Anteprima statica per screenshot / sviluppo (--demo) */
api.on('overlay:demo', ({ mime, hover: h, state: st, clean }) => {
  if (clean) document.documentElement.style.background = body.style.background = 'transparent'; // senza l'alpha minima anti-click-through

  category = mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'image';
  excluded = new Set(MIME_EXT[mime] ? [MIME_EXT[mime]] : []);
  fileCount = 1;
  reveal();
  buildWheel();
  if (st === 'wheel') setHover(h);
  if (st === 'busy') { startBusy(segments[0], 1); setProgress(0.62); $('busyName').textContent = 'holiday.mp4'; }
  if (st === 'done') { $('doneTitle').textContent = S.done; $('doneName').textContent = 'photo.webp'; $('ringFg').style.strokeDasharray = String(CIRC); setState('done'); }
});

(async () => {
  ({ catalog, strings: S } = await api.catalog());
  setState('idle');
})();

