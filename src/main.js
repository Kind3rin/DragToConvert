const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, shell } = require('electron');
const sharp = require('sharp');
const { uIOhook } = require('uiohook-napi');
const { getCatalog } = require('./catalog');
const i18n = require('./i18n');
const { run } = require('./converter');
const { iconSvg } = require('./icon');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

const DEMO = process.argv.includes('--demo');
const W = 580;
const H = 600;
const SHIFT_KEYS = [42, 54];
const PAUSE_MS = 450;
const EXPLORER_CLASSES = new Set(['CabinetWClass', 'ExploreWClass', 'Progman', 'WorkerW', '#32770']);

/* --------------------------------- settings -------------------------------- */

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
// trigger: 'shift' | 'pause' · language: 'it' | 'en' (assente = lingua di Windows)
let settings = { enabled: true, anyApp: false, trigger: 'shift' };
function loadSettings() {
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch { /* default */ }
}
function saveSettings() {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(settings)); } catch { /* ignore */ }
}

/* ----------------------- origine del trascinamento (Win32) ------------------ */

let classAt = () => '';
let nudge = () => {};
try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const POINT = koffi.struct('POINT', { x: 'int32_t', y: 'int32_t' });
  const WindowFromPoint = user32.func('void* __stdcall WindowFromPoint(POINT pt)');
  const GetAncestor = user32.func('void* __stdcall GetAncestor(void* hwnd, uint32_t flags)');
  const GetClassNameW = user32.func('int __stdcall GetClassNameW(void* hwnd, _Out_ uint16_t* buf, int max)');
  const mouse_event = user32.func('void __stdcall mouse_event(uint32_t flags, int32_t dx, int32_t dy, uint32_t data, uintptr_t extra)');
  // Un micro-movimento (1px e ritorno) fa ricalcolare al drag-loop OLE la finestra sotto il cursore.
  nudge = () => { mouse_event(0x0001, 1, 0, 0, 0); setTimeout(() => mouse_event(0x0001, -1, 0, 0, 0), 15); };
  classAt = (x, y) => {
    const h = WindowFromPoint({ x, y });
    if (!h) return '';
    const root = GetAncestor(h, 2) || h; // GA_ROOT
    const buf = new Uint16Array(256);
    const n = GetClassNameW(root, buf, 256);
    return String.fromCharCode(...buf.subarray(0, n));
  };
} catch (e) {
  console.error('koffi non disponibile, trigger su qualsiasi app:', e.message);
  settings.anyApp = true;
}

/* --------------------------------- overlay --------------------------------- */

let win = null;
let shown = false;
let busy = false;
let dragActive = false;
let holdHide = false;
let probeTimer = null;
let hideTimer = null;
let lastOutput = null;

function createOverlay() {
  win = new BrowserWindow({
    width: W,
    height: H,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    type: 'toolbar',
    focusable: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'overlay.html'));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  if (process.env.DTC_DEBUG) win.webContents.on('console-message', (_e, _l, msg) => dbg('renderer:', msg));
}

function dbg(...a) {
  if (process.env.DTC_DEBUG) fs.appendFileSync(path.join(app.getPath('temp'), 'dtc-debug.log'), a.join(' ') + '\n');
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function placeAt(px, py) {
  const dip = screen.screenToDipPoint({ x: px, y: py });
  const b = screen.getDisplayNearestPoint(dip).bounds;
  win.setBounds({
    x: clamp(Math.round(dip.x - W / 2), b.x, b.x + b.width - W),
    y: clamp(Math.round(dip.y - H / 2), b.y, b.y + b.height - H),
    width: W,
    height: H,
  });
}

// La finestra resta sempre "visibile" (così Chromium continua a dipingerla e risponde subito
// al drag) ma parcheggiata fuori schermo quando non serve.
function parkOverlay() {
  win.setBounds({ x: -20000, y: -20000, width: W, height: H });
}

function showOverlay(px, py) {
  if (!win || shown) return;
  clearTimeout(hideTimer);
  placeAt(px, py);
  win.moveTop(); // sopra qualsiasi altra finestra topmost
  shown = true;
  dragActive = false;
  win.webContents.send('overlay:prepare');
  [60, 160, 320].forEach((ms) => setTimeout(() => { if (shown && !dragActive) nudge(); }, ms));
  // Se entro poco non arriva un dragenter non è un trascinamento di file: nascondi.
  clearTimeout(probeTimer);
  probeTimer = setTimeout(() => { if (!dragActive && !busy) hideOverlay(); }, 1200);
}

function hideOverlay() {
  if (!win || !shown) return;
  dbg('hide dragActive=' + dragActive);
  shown = false;
  busy = false;
  dragActive = false;
  holdHide = false;
  clearTimeout(probeTimer);
  clearTimeout(hideTimer);
  win.webContents.send('overlay:hide');
  hideTimer = setTimeout(() => { if (!shown) parkOverlay(); }, 260);
}

function scheduleHide(ms) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => (holdHide ? scheduleHide(800) : hideOverlay()), ms);
}

/* ------------------------------ hook globale mouse ------------------------- */

let shiftDown = false;
let mouseDown = false;
let armed = false;
let moved = false;
let downPt = { x: 0, y: 0 };
let pausePt = null;
let pauseTimer = null;

function trigger(x, y) {
  clearTimeout(pauseTimer);
  armed = false; // un solo tentativo per trascinamento
  dbg('show', x, y);
  showOverlay(x, y);
}

function startHook() {
  uIOhook.on('keydown', (e) => {
    if (SHIFT_KEYS.includes(e.keycode)) shiftDown = true;
  });
  uIOhook.on('keyup', (e) => {
    if (SHIFT_KEYS.includes(e.keycode)) shiftDown = false;
  });
  uIOhook.on('mousedown', (e) => {
    if (e.button !== 1) return;
    mouseDown = true;
    moved = false;
    downPt = { x: e.x, y: e.y };
    const cls = classAt(e.x, e.y);
    armed = settings.enabled && !busy && (settings.anyApp || EXPLORER_CLASSES.has(cls));
    dbg('mousedown', e.x, e.y, 'class=' + cls, 'armed=' + armed, 'shift=' + shiftDown);
  });
  uIOhook.on('mousemove', (e) => {
    if (!mouseDown || !armed || shown) return;
    if (!moved && Math.hypot(e.x - downPt.x, e.y - downPt.y) > 8) moved = true;
    if (!moved) return;
    if (shiftDown) {
      trigger(e.x, e.y);
    } else if (settings.trigger === 'pause') {
      // Senza Shift: la ruota compare quando ci si ferma un istante durante il trascinamento.
      if (!pausePt || Math.hypot(e.x - pausePt.x, e.y - pausePt.y) > 6) {
        pausePt = { x: e.x, y: e.y };
        clearTimeout(pauseTimer);
        pauseTimer = setTimeout(() => { if (mouseDown && armed && !shown) trigger(pausePt.x, pausePt.y); }, PAUSE_MS);
      }
    }
  });
  uIOhook.on('mouseup', (e) => {
    if (e.button !== 1) return;
    mouseDown = false;
    armed = false;
    pausePt = null;
    clearTimeout(pauseTimer);
    if (shown && !busy && !DEMO) scheduleHide(550);
  });
  uIOhook.start();
}

/* ----------------------------------- IPC ----------------------------------- */

ipcMain.handle('catalog', () => ({ catalog: getCatalog(), strings: i18n.current().ui }));
ipcMain.on('drag-active', () => { dbg('drag-active'); dragActive = true; clearTimeout(probeTimer); });
ipcMain.on('cancel', () => hideOverlay());
ipcMain.on('hold', (_e, on) => { holdHide = !!on; });
ipcMain.on('reveal', (_e, p) => { if (p) shell.showItemInFolder(p); hideOverlay(); });

ipcMain.handle('convert', async (_e, { paths, action: raw }) => {
  const action = { mode: raw.mode === 'tools' ? 'tool' : 'format', id: String(raw.id) };
  busy = true;
  dbg('convert', JSON.stringify(paths), JSON.stringify(action));
  clearTimeout(hideTimer);
  const send = (ch, d) => win && !win.isDestroyed() && win.webContents.send(ch, d);
  const ok = [];
  const failed = [];
  const n = paths.length;
  for (let i = 0; i < n; i++) {
    const file = paths[i];
    const name = path.basename(file);
    send('progress', { p: i / n, i, n, name });
    try {
      ok.push(await run(file, action, (p) => send('progress', { p: (i + p) / n, i, n, name })));
    } catch (err) {
      failed.push({ name, error: err.message });
    }
  }
  dbg('done', JSON.stringify(ok), JSON.stringify(failed));
  lastOutput = ok[ok.length - 1] || null;
  send('done', { ok, failed, n });
  busy = false;
  scheduleHide(failed.length ? 4200 : 2800);
});

/* ------------------------------------ tray --------------------------------- */

let tray = null;

async function trayIcon() {
  const png = await sharp(Buffer.from(iconSvg()), { density: 300 }).resize(32, 32).png().toBuffer();
  return nativeImage.createFromBuffer(png);
}

function buildMenu() {
  const t = i18n.current().tray;
  return Menu.buildFromTemplate([
    { label: 'DragToConvert', enabled: false },
    { type: 'separator' },
    { label: t.enabled, type: 'checkbox', checked: settings.enabled, click: (i) => { settings.enabled = i.checked; saveSettings(); } },
    {
      label: t.trigger,
      submenu: [
        { label: t.shift, type: 'radio', checked: settings.trigger === 'shift', click: () => { settings.trigger = 'shift'; saveSettings(); } },
        { label: t.pause, type: 'radio', checked: settings.trigger === 'pause', click: () => { settings.trigger = 'pause'; saveSettings(); } },
      ],
    },
    { label: t.anyApp, type: 'checkbox', checked: settings.anyApp, click: (i) => { settings.anyApp = i.checked; saveSettings(); } },
    {
      label: t.startup,
      type: 'checkbox',
      enabled: app.isPackaged,
      checked: app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }),
    },
    { type: 'separator' },
    { label: t.quit, click: () => app.quit() },
  ]);
}

async function createTray() {
  tray = new Tray(await trayIcon());
  tray.setToolTip(i18n.current().tray.tooltip);
  tray.setContextMenu(buildMenu());
  tray.on('click', () => tray.popUpContextMenu());
}

/* ------------------------------------- app --------------------------------- */

app.on('second-instance', () => { if (tray) tray.popUpContextMenu(); });
app.on('window-all-closed', (e) => e.preventDefault());

app.whenReady().then(async () => {
  loadSettings();
  const langArg = (process.argv.find((a) => a.startsWith('--lang=')) || '').split('=')[1];
  i18n.setLang(langArg || settings.language || app.getLocale());
  if (process.argv.includes('--any-app')) settings.anyApp = true;
  createOverlay();
  await createTray();
  startHook();
  if (!DEMO) {
    parkOverlay();
    win.showInactive();
  }
  if (DEMO) {
    win.webContents.once('did-finish-load', () => {
      const d = screen.getPrimaryDisplay().bounds;
      win.setBounds({ x: Math.round(d.x + (d.width - W) / 2), y: Math.round(d.y + (d.height - H) / 2), width: W, height: H });
      win.showInactive();
      shown = true;
      const arg = (k, def) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${def}`).split('=')[1];
      const capture = arg('capture', '');
      setTimeout(() => win.webContents.send('overlay:demo', { mime: arg('mime', 'image/png'), hover: +arg('hover', 2), state: arg('state', 'wheel'), clean: !!capture }), 400);
      if (capture) {
        // Salva il solo contenuto della finestra (sfondo trasparente): usato per gli screenshot della documentazione.
        setTimeout(async () => {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(capture, img.toPNG());
          app.quit();
        }, 1800);
      }
    });
  }
});

app.on('will-quit', () => { try { uIOhook.stop(); } catch { /* ignore */ } });
