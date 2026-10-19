"use strict";

var app = require("electron").app;
var BrowserWindow = require("electron").BrowserWindow;
var ipcMain = require("electron").ipcMain;
var path = require("path");
var detect = require("./detect");
var panels = require("./panels");

// Pasta que contém as pastas dos painéis (com.autogrids.panel,
// com.autophysics.panel...). Empacotado (build final via electron-builder):
// resources/, onde o "extraResources" do package.json coloca cada uma. Em
// desenvolvimento (rodando este projeto direto do repositório): a raiz do
// repositório, um nível acima do instalador.
function panelsRoot() {
    if (app.isPackaged) return process.resourcesPath;
    return path.join(__dirname, "..", "..");
}

function createWindow() {
    var win = new BrowserWindow({
        width: 480,
        height: 680,
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

// Tudo que a tela de verificação precisa: as instalações do Illustrator, se
// ele está aberto, e para cada painel o cenário — instalar, atualizar,
// reinstalar, voltar versão ou trocar o atalho para o código-fonte (ver
// detect.planInstall).
ipcMain.handle("detect-illustrator", function () {
    var result = { ok: true, installs: [], running: null, panels: [] };
    try {
        result.installs = detect.findIllustratorInstalls(process.platform);
        result.running = detect.isIllustratorRunning(process.platform);
        result.panels = panels.planPanels(panelsRoot(), detect.cepExtensionsDir(process.platform, process.env));
    } catch (err) {
        result.ok = false;
        result.error = err.message;
    }
    return result;
});

// ids = pastas dos painéis marcados na tela (ex.: ["com.autogrids.panel"]).
ipcMain.handle("run-install", function (event, ids) {
    var log = [];
    try {
        var known = (ids || []).filter(function (id) { return !!panels.findPanel(id); });
        if (known.length === 0) return { ok: false, error: "Nenhum painel escolhido.", panels: [], log: log };
        var r = panels.installPanels(known, {
            sourceRoot: panelsRoot(),
            platform: process.platform,
            env: process.env,
            log: function (line) { log.push(line); }
        });
        return {
            ok: r.panels.every(function (p) { return p.ok; }),
            panels: r.panels,
            // Conferido de novo no fim: o aviso final muda se o Illustrator
            // ainda estiver aberto (ele só carrega a versão nova ao reabrir).
            running: detect.isIllustratorRunning(process.platform),
            debugPartial: r.debugPartial,
            log: log
        };
    } catch (err) {
        return { ok: false, error: err.message, panels: [], log: log };
    }
});
