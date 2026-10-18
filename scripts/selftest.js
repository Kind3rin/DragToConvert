// Test di fumo del motore di conversione: node scripts/selftest.js <cartella-con-pic.png-e-clip.mp4>
const path = require('path');
const { run } = require('../src/converter');

const dir = process.argv[2];
const F = (f, id) => [f, { mode: 'format', id }];
const T = (f, id) => [f, { mode: 'tool', id }];

(async () => {
  const list = [
    ...['jpg', 'webp', 'avif', 'pdf', 'tiff', 'gif', 'bmp', 'ico'].map((a) => F('pic.png', a)),
    ...['webm', 'gif', 'mp3', 'mov'].map((a) => F('clip.mp4', a)),
    T('pic.png', 'compress'), T('pic.png', 'half'), T('pic.png', 'rotate'), T('pic.png', 'gray'), T('pic.png', 'strip'),
    T('clip.mp4', 'compress'), T('clip.mp4', 'p480'), T('clip.mp4', 'mute'),
    F('pic.bmp', 'png'), F('pic.ico', 'png'), F('clip.mp3', 'opus'), T('clip.mp3', 'normalize'),
  ];
  let bad = 0;
  for (const [f, a] of list) {
    try {
      console.log('OK ', f, a.mode, a.id, '->', path.basename(await run(path.join(dir, f), a)));
    } catch (e) {
      bad++;
      console.log('ERR', f, a.mode, a.id, e.message);
    }
  }
  process.exit(bad ? 1 : 0);
})();
