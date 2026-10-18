// Genera build/icon.png (512x512) usato da electron-builder per l'icona dell'exe/installer.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { iconSvg } = require('../src/icon');

(async () => {
  const dir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(dir, { recursive: true });
  const bg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="112" fill="#120e24"/></svg>');
  const wheel = await sharp(Buffer.from(iconSvg()), { density: 1200 }).resize(400, 400).png().toBuffer();
  await sharp(bg).composite([{ input: wheel, gravity: 'center' }]).png().toFile(path.join(dir, 'icon.png'));
  console.log('build/icon.png creato');
})();
