// Stringhe dell'app in italiano e inglese. La lingua segue quella di Windows (fallback: inglese).
const STR = {
  en: {
    ui: {
      dropOn: 'Drop on', choose: 'Choose', formatOrTool: 'format or tool', apply: 'Apply', convertTo: 'Convert to',
      dropHere: 'Drop here', releaseN: '{n} files · release', nFiles: '{n} files', done: 'Done', partial: '{ok}/{n} done',
      failedN: '{n} failed', error: 'Error', convFail: 'Conversion failed', converting: 'Converting…',
    },
    tray: {
      tooltip: 'DragToConvert — drag a file and pick a format or tool',
      enabled: 'Enabled', trigger: 'How to show the wheel', shift: 'Shift + drag', pause: 'Just drag (pause for a moment)',
      anyApp: 'Also work outside File Explorer', startup: 'Start with Windows', quit: 'Quit',
    },
    err: {
      unsupportedType: 'Unsupported file type', notFound: 'File not found', unsupportedAction: 'Action not supported for this file type',
      noFfmpeg: 'ffmpeg is not available: ', readImage: 'Could not read the image: ',
    },
    suffix: { compress: 'compressed', half: '50%', quarter: '25%', gray: 'b&w', rotate: 'rotated', strip: 'no metadata', p720: '720p', p480: '480p', mute: 'muted', normalize: 'normalized', mono: 'mono' },
    formats: { jpg: 'Photo', png: 'Transparency', webp: 'Web', avif: 'Ultra light', pdf: 'Document', tiff: 'Print', gif: 'Animated', bmp: 'Bitmap', ico: 'Icon', mp4: 'Universal', webm: 'Web', mov: 'QuickTime', mkv: 'Matroska', mp3: 'Universal', mp3v: 'Audio only', wav: 'Lossless', flac: 'Hi-Fi', ogg: 'Vorbis', m4a: 'AAC', opus: 'Compact' },
    tools: {
      compress: ['Compress', 'Smaller'], half: ['50%', 'Halve'], quarter: ['25%', 'Thumbnail'], gray: ['B&W', 'Grayscale'], rotate: ['Rotate', '90° clockwise'],
      strip: ['Privacy', 'Strip EXIF'], p720: ['720p', 'Resize'], p480: ['480p', 'Resize'], mute: ['Mute', 'No audio'], compressAudio: ['Compress', 'MP3 128k'],
      normalize: ['Volume', 'Normalize'], mono: ['Mono', 'Single channel'],
    },
  },
  it: {
    ui: {
      dropOn: 'Rilascia su', choose: 'Scegli', formatOrTool: 'formato o strumento', apply: 'Applica', convertTo: 'Converti in',
      dropHere: 'Rilascia qui', releaseN: '{n} file · rilascia', nFiles: '{n} file', done: 'Fatto', partial: '{ok}/{n} fatti',
      failedN: '{n} non riusciti', error: 'Errore', convFail: 'Conversione non riuscita', converting: 'Conversione…',
    },
    tray: {
      tooltip: 'DragToConvert — trascina un file e scegli formato o strumento',
      enabled: 'Attivo', trigger: 'Come far comparire la ruota', shift: 'Shift + trascina', pause: 'Solo trascina (fermati un istante)',
      anyApp: 'Funziona anche fuori da Esplora file', startup: 'Avvia con Windows', quit: 'Esci',
    },
    err: {
      unsupportedType: 'Tipo di file non supportato', notFound: 'File non trovato', unsupportedAction: 'Azione non supportata per questo tipo di file',
      noFfmpeg: 'ffmpeg non disponibile: ', readImage: 'Lettura immagine non riuscita: ',
    },
    suffix: { compress: 'compresso', half: '50%', quarter: '25%', gray: 'b&n', rotate: 'ruotato', strip: 'senza metadati', p720: '720p', p480: '480p', mute: 'muto', normalize: 'normalizzato', mono: 'mono' },
    formats: { jpg: 'Foto', png: 'Trasparenza', webp: 'Web', avif: 'Ultra leggero', pdf: 'Documento', tiff: 'Stampa', gif: 'Animata', bmp: 'Bitmap', ico: 'Icona', mp4: 'Universale', webm: 'Web', mov: 'QuickTime', mkv: 'Matroska', mp3: 'Universale', mp3v: 'Solo audio', wav: 'Senza perdite', flac: 'Hi-Fi', ogg: 'Vorbis', m4a: 'AAC', opus: 'Compatto' },
    tools: {
      compress: ['Comprimi', 'Meno peso'], half: ['50%', 'Dimezza'], quarter: ['25%', 'Miniatura'], gray: ['B/N', 'Scala di grigi'], rotate: ['Ruota', '90° orario'],
      strip: ['Privacy', 'Rimuovi EXIF'], p720: ['720p', 'Ridimensiona'], p480: ['480p', 'Ridimensiona'], mute: ['Muto', 'Senza audio'], compressAudio: ['Comprimi', 'MP3 128k'],
      normalize: ['Volume', 'Normalizza'], mono: ['Mono', 'Un canale'],
    },
  },
};

let lang = 'en';

function setLang(locale) {
  lang = String(locale || '').toLowerCase().startsWith('it') ? 'it' : 'en';
}

const current = () => STR[lang];

module.exports = { setLang, current, getLang: () => lang };
