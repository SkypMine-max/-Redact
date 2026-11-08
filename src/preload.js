const { contextBridge, ipcRenderer } = require("electron");
if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("cleaner", {
    status: () => ipcRenderer.invoke("ui:status"),
    connect: (p) => ipcRenderer.invoke("ui:connect", p),
    targets: (p) => ipcRenderer.invoke("ui:targets", p),
    start: (o) => ipcRenderer.invoke("ui:start", o),
    stop: () => ipcRenderer.invoke("ui:stop"),
    onEvent: (cb) => ipcRenderer.on("ui:event", (_e, m) => cb(m)),
  });
}
