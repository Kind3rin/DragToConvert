const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('dtc', {
  catalog: () => ipcRenderer.invoke('catalog'),
  on: (channel, cb) => ipcRenderer.on(channel, (_e, data) => cb(data)),
  pathFor: (file) => webUtils.getPathForFile(file),
  dragActive: () => ipcRenderer.send('drag-active'),
  cancel: () => ipcRenderer.send('cancel'),
  convert: (paths, action) => ipcRenderer.invoke('convert', { paths, action }),
  reveal: (p) => ipcRenderer.send('reveal', p),
  hold: (on) => ipcRenderer.send('hold', on),
});
