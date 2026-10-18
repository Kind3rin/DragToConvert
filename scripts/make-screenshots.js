// Genera le immagini della documentazione in docs/img: node scripts/make-screenshots.js
// Cattura la ruota (sfondo trasparente) dall'app in modalità demo e la compone su sfondi puliti.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const electron = require('electron');
const out = path.join(root, 'docs', 'img');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dtc-shots-'));
fs.mkdirSync(out, { recursive: true });

function capture(name, args) {
  const file = path.join(tmp, name + '.png');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // se impostata, Electron girerebbe come semplice Node
  const r = spawnSync(electron, ['.', '--demo', `--capture=${file}`, ...args], { cwd: root, stdio: 'inherit', env });
  if (!fs.existsSync(file)) throw new Error(`cattura fallita: ${name} (exit ${r.status})`);
  return file;
}

const gradient = (w, h, c1, c2, c3) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>
    <radialGradient id="a" cx="0.2" cy="0.1" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity="0.14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#a)"/>
</svg>`);

// Finta finestra di Esplora file con un file "trascinato", per il banner principale
function explorer(w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="Segoe UI, sans-serif">
  <rect x="0" y="0" width="${w}" height="${h}" rx="14" fill="#1f1b36" stroke="#ffffff22"/>
  <rect x="0" y="0" width="${w}" height="40" rx="14" fill="#2a2548"/><rect y="26" width="${w}" height="14" fill="#2a2548"/>
  <circle cx="22" cy="20" r="6" fill="#ff5f57"/><circle cx="42" cy="20" r="6" fill="#febc2e"/><circle cx="62" cy="20" r="6" fill="#28c840"/>
  <text x="${w / 2}" y="25" text-anchor="middle" fill="#cfc8ee" font-size="13">Pictures</text>
  ${[0, 1, 2, 3].map((i) => `<g transform="translate(${36 + i * 132} 72)"><rect width="104" height="80" rx="10" fill="${['#7c3aed', '#db2777', '#f59e0b', '#0d9488'][i]}" opacity="0.85"/><circle cx="30" cy="26" r="9" fill="#fff" opacity="0.6"/><path d="M0 80 L38 44 L62 64 L80 50 L104 72 V70 Q104 80 94 80Z" fill="#000" opacity="0.25"/><text x="52" y="102" text-anchor="middle" fill="#cfc8ee" font-size="11">IMG_${1040 + i}.jpg</text></g>`).join('')}
  </svg>`);
}

(async () => {
  const shots = {
    formats: capture('formats', ['--hover=2', '--lang=en']),
    tools: capture('tools', ['--hover=9', '--lang=en']),
    busy: capture('busy', ['--state=busy', '--mime=video/mp4', '--lang=en']),
    done: capture('done', ['--state=done', '--lang=en']),
    video: capture('video', ['--hover=0', '--mime=video/mp4', '--lang=en']),
  };

  const size = 760;
  const bg = () => sharp(gradient(size, size, '#2b1a5e', '#6d28d9', '#be185d'));
  for (const [name, file] of Object.entries(shots)) {
    const wheel = await sharp(file).resize({ width: 640, height: 640, fit: 'inside' }).toBuffer();
    await bg().composite([{ input: wheel, gravity: 'center' }]).png().toFile(path.join(out, `wheel-${name}.png`));
  }

  // Banner: finestra "Esplora file" a sinistra, ruota a destra
  const W = 1600, H = 820;
  const wheel = await sharp(shots.tools).resize({ width: 700, height: 700, fit: 'inside' }).toBuffer();
  await sharp(gradient(W, H, '#150f33', '#3b1d7a', '#9d174d'))
    .composite([
      { input: explorer(560, 250), left: 110, top: 280 },
      { input: wheel, left: 760, top: 55 },
      { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="170" font-family="Segoe UI, sans-serif"><text x="0" y="62" fill="#fff" font-size="58" font-weight="800">DragToConvert</text><text x="0" y="108" fill="#e9d5ff" font-size="24">Hold a file, pick a format. Done.</text><text x="0" y="146" fill="#c4b5fd" font-size="18">Drag-and-drop file converter for Windows</text></svg>`), left: 110, top: 80 },
    ])
    .png().toFile(path.join(out, 'banner.png'));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('Immagini create in docs/img');
})();
