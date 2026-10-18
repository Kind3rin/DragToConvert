// Catalogo delle azioni mostrate nella ruota, per categoria di file: anello esterno = formati, interno = strumenti.
const { current } = require('./i18n');

function getCatalog() {
  const s = current();
  const f = (id, label, subKey = id) => ({ id, label, sub: s.formats[subKey] });
  const tool = (id, icon, key = id) => ({ id, label: s.tools[key][0], sub: s.tools[key][1], icon });
  return {
    formats: {
      image: [f('jpg', 'JPG'), f('png', 'PNG'), f('webp', 'WEBP'), f('avif', 'AVIF'), f('pdf', 'PDF'), f('tiff', 'TIFF'), f('gif', 'GIF'), f('bmp', 'BMP'), f('ico', 'ICO')],
      video: [f('mp4', 'MP4'), f('webm', 'WEBM'), f('gif', 'GIF'), f('mov', 'MOV'), f('mkv', 'MKV'), f('mp3', 'MP3', 'mp3v')],
      audio: [f('mp3', 'MP3'), f('wav', 'WAV'), f('flac', 'FLAC'), f('ogg', 'OGG'), f('m4a', 'M4A'), f('opus', 'OPUS')],
    },
    tools: {
      image: [tool('compress', 'compress'), tool('half', 'resize'), tool('quarter', 'resize'), tool('gray', 'gray'), tool('rotate', 'rotate'), tool('strip', 'strip')],
      video: [tool('compress', 'compress'), tool('p720', 'resize'), tool('p480', 'resize'), tool('mute', 'mute')],
      audio: [tool('compress', 'compress', 'compressAudio'), tool('normalize', 'norm'), tool('mono', 'mono')],
    },
  };
}

module.exports = { getCatalog };
