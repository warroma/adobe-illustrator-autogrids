"use strict";

var app = require("electron").app;
var BrowserWindow = require("electron").BrowserWindow;
var ipcMain = require("electron").ipcMain;
var path = require("path");
var detect = require("./detect");
var install = require("./install");

function panelSourceDir() {
    // Empacotado (build final via electron-builder): os arquivos do painel
    // ficam em resources/com.autogrids.panel (ver "extraResources" no
    // package.json). Em desenvolvimento (rodando este projeto direto do
    // repositório): usa a pasta real com.autogrids.panel um nível acima.
    if (app.isPackaged) {
        return path.join(process.resourcesPath, "com.autogrids.panel");
    }
    return path.join(__dirname, "..", "..", "com.autogrids.panel");
}

function createWindow() {
    var win = new BrowserWindow({
        width: 480,
        height: 600,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    win.setMenuBarVisibility(false);
    win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", function () {
    app.quit();
});

ipcMain.handle("detect-illustrator", function () {
    try {
        return { ok: true, installs: detect.findIllustratorInstalls(process.platform) };
    } catch (err) {
        return { ok: false, installs: [], error: err.message };
    }
});

ipcMain.handle("run-install", function () {
    var log = [];
    var pushLog = function (line) { log.push(line); };
    try {
        var dest = install.installPanel(panelSourceDir(), process.platform, process.env, pushLog);
        var debugResults = install.enableDebugMode(process.platform, pushLog);
        var anyDebugFailed = debugResults.some(function (r) { return !r.ok; });
        return { ok: true, dest: dest, debugPartial: anyDebugFailed, log: log };
    } catch (err) {
        return { ok: false, error: err.message, log: log };
    }
});
