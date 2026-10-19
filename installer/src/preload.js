"use strict";

var contextBridge = require("electron").contextBridge;
var ipcRenderer = require("electron").ipcRenderer;

contextBridge.exposeInMainWorld("autogridsInstaller", {
    detectIllustrator: function () {
        return ipcRenderer.invoke("detect-illustrator");
    },
    runInstall: function (panelIds) {
        return ipcRenderer.invoke("run-install", panelIds);
    }
});
