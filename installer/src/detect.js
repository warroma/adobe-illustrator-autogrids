// Lógica pura de detecção do Illustrator — sem nada do Electron aqui, só
// fs/path, para poder ser testada isoladamente (ver installer/test/).
"use strict";

var fs = require("fs");
var path = require("path");

function illustratorSearchRoots(platform, env) {
    env = env || process.env;
    if (platform === "darwin") {
        return ["/Applications"];
    }
    if (platform === "win32") {
        var roots = [];
        if (env["ProgramFiles"]) roots.push(path.join(env["ProgramFiles"], "Adobe"));
        if (env["ProgramFiles(x86)"]) roots.push(path.join(env["ProgramFiles(x86)"], "Adobe"));
        if (roots.length === 0) roots.push("C:\\Program Files\\Adobe");
        return roots;
    }
    return [];
}

function extractYear(name) {
    var m = name.match(/(20\d{2})/);
    return m ? parseInt(m[1], 10) : 0;
}

// Varre uma lista explícita de pastas-raiz procurando subpastas cujo nome
// contenha "adobe illustrator" (case-insensitive). Separado de
// findIllustratorInstalls para poder testar com raízes fake, sem depender de
// /Applications ou %ProgramFiles% existirem de verdade nesta máquina.
function scanRootsForIllustrator(roots) {
    var found = [];
    roots.forEach(function (root) {
        var entries;
        try {
            entries = fs.readdirSync(root, { withFileTypes: true });
        } catch (e) {
            return; // pasta não existe nesta máquina — segue para a próxima raiz
        }
        entries.forEach(function (entry) {
            if (!entry.isDirectory()) return;
            if (!/adobe illustrator/i.test(entry.name)) return;
            found.push({ name: entry.name, path: path.join(root, entry.name), year: extractYear(entry.name) });
        });
    });
    found.sort(function (a, b) { return b.year - a.year; });
    return found;
}

function findIllustratorInstalls(platform, env) {
    platform = platform || process.platform;
    return scanRootsForIllustrator(illustratorSearchRoots(platform, env));
}

function cepExtensionsDir(platform, env) {
    platform = platform || process.platform;
    env = env || process.env;
    if (platform === "darwin") {
        return path.join(env.HOME, "Library", "Application Support", "Adobe", "CEP", "extensions");
    }
    if (platform === "win32") {
        return path.join(env.APPDATA, "Adobe", "CEP", "extensions");
    }
    throw new Error("Plataforma não suportada para o instalador do AutoGrids: " + platform);
}

module.exports = {
    illustratorSearchRoots: illustratorSearchRoots,
    extractYear: extractYear,
    scanRootsForIllustrator: scanRootsForIllustrator,
    findIllustratorInstalls: findIllustratorInstalls,
    cepExtensionsDir: cepExtensionsDir
};
