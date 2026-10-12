// Lógica pura de instalação (copiar arquivos, habilitar modo de depuração do
// CEP) — sem nada do Electron aqui, para poder ser testada isoladamente.
"use strict";

var fs = require("fs");
var path = require("path");
var execFileSync = require("child_process").execFileSync;
var cepExtensionsDir = require("./detect").cepExtensionsDir;

// Mesmo intervalo de versões do CSXS que o README já documenta para o passo manual.
var CSXS_VERSIONS = ["7", "8", "9", "10", "11", "12"];

// runner é injetável só para teste (evita chamar defaults/reg de verdade fora
// do Mac/Windows reais); em produção é sempre child_process.execFileSync.
function enableDebugMode(platform, log, runner) {
    platform = platform || process.platform;
    runner = runner || execFileSync;
    var results = [];
    CSXS_VERSIONS.forEach(function (v) {
        var entry = { version: v, ok: false, error: null };
        try {
            if (platform === "darwin") {
                runner("defaults", ["write", "com.adobe.CSXS." + v, "PlayerDebugMode", "1"]);
            } else if (platform === "win32") {
                runner("reg", ["add", "HKCU\\Software\\Adobe\\CSXS." + v, "/v", "PlayerDebugMode", "/t", "REG_SZ", "/d", "1", "/f"]);
            } else {
                throw new Error("Plataforma não suportada: " + platform);
            }
            entry.ok = true;
        } catch (err) {
            entry.error = err.message;
        }
        results.push(entry);
        if (log) log("CSXS." + v + ": " + (entry.ok ? "ok" : "falhou (" + entry.error + ")"));
    });
    return results;
}

// Copia a pasta da extensão (com.autogrids.panel) para a pasta de extensões
// do CEP do usuário. fsImpl é injetável só para teste.
function installPanel(panelSourceDir, platform, env, log, fsImpl) {
    fsImpl = fsImpl || fs;
    var destRoot = cepExtensionsDir(platform, env);
    fsImpl.mkdirSync(destRoot, { recursive: true });
    var dest = path.join(destRoot, path.basename(panelSourceDir));
    if (log) log("Copiando " + panelSourceDir + " -> " + dest);
    fsImpl.cpSync(panelSourceDir, dest, { recursive: true, force: true });
    return dest;
}

module.exports = {
    CSXS_VERSIONS: CSXS_VERSIONS,
    enableDebugMode: enableDebugMode,
    installPanel: installPanel
};
