"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tokenDisplayAPI", {
  getSnapshot: () => ipcRenderer.invoke("token-display:get-snapshot"),
  onSnapshot: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("token-display:snapshot", handler);
    return () => ipcRenderer.removeListener("token-display:snapshot", handler);
  },
});
