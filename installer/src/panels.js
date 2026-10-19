// Os painéis que este instalador leva, e a instalação de vários de uma vez.
// Lógica pura (só fs/path + detect/install), testável sem o Electron.
"use strict";

var path = require("path");
var detect = require("./detect");
var install = require("./install");

// "id" é o nome da pasta do painel (igual ao ExtensionBundleId do manifest):
// é ela que vai para a pasta de extensões do CEP, e é ela que o package.json
// empacota em "extraResources". "minYear" = Illustrator mais antigo em que o
// painel abre (o AutoPhysics usa PageItem.uuid, que só existe a partir do 2020).
var PANELS = [
    {
        id: "com.autogrids.panel",
        name: "AutoGrids",
        description: "Grades de referência na prancheta: quadriculado, isométrico, pautado, hexagonal e pontilhado.",
        minYear: 0
    },
    {
        id: "com.autophysics.panel",
        name: "AutoPhysics",
        description: "Objetos que caem, colidem e se empilham dentro da prancheta, com exportação da queda em GIF. Experimental.",
        minYear: 2020
    }
];

function findPanel(id) {
    for (var i = 0; i < PANELS.length; i++) if (PANELS[i].id === id) return PANELS[i];
    return null;
}

// Para cada painel: versão empacotada, o que já está instalado e o cenário
// (detect.planInstall). "available" = false se a pasta do painel não veio no
// pacote — aí ele aparece desabilitado em vez de quebrar a instalação.
function planPanels(sourceRoot, destRoot, fsImpl) {
    return PANELS.map(function (p) {
        var bundledVersion = detect.readPanelVersion(path.join(sourceRoot, p.id), fsImpl);
        var installed = detect.inspectInstalled(path.join(destRoot, p.id), fsImpl);
        return {
            id: p.id,
            name: p.name,
            description: p.description,
            minYear: p.minYear,
            available: bundledVersion !== null,
            bundledVersion: bundledVersion,
            installed: installed,
            mode: detect.planInstall(installed, bundledVersion)
        };
    });
}

// Instala os painéis pedidos, um por um e de forma independente: se um
// falhar (ex.: arquivo preso pelo Illustrator aberto), os outros seguem e o
// resultado diz qual falhou. O modo de desenvolvimento do CEP é ligado uma
// vez só, e só se pelo menos um painel foi instalado.
//
// opts = { sourceRoot, platform, env, log, fsImpl, runner } — fsImpl e
// runner são injetáveis só para teste.
function installPanels(ids, opts) {
    var log = opts.log || function () {};
    var results = [];
    PANELS.forEach(function (p) {
        if (ids.indexOf(p.id) < 0) return;
        var src = path.join(opts.sourceRoot, p.id);
        var entry = { id: p.id, name: p.name, ok: false };
        try {
            log("— " + p.name + " —");
            var placed = install.installPanel(src, opts.platform, opts.env, log, opts.fsImpl);
            install.clearQuarantine(placed.dest, opts.platform, log, opts.runner);
            entry.ok = true;
            entry.dest = placed.dest;
            entry.replacedLink = placed.replacedLink;
            entry.previousVersion = placed.previousVersion;
            entry.version = detect.readPanelVersion(src, opts.fsImpl);
        } catch (err) {
            entry.error = err.message;
            log("ERRO em " + p.name + ": " + err.message);
        }
        results.push(entry);
    });
    var anyOk = results.some(function (r) { return r.ok; });
    var debugPartial = false;
    if (anyOk) {
        log("— Modo de desenvolvimento do CEP —");
        debugPartial = install.enableDebugMode(opts.platform, log, opts.runner).some(function (r) { return !r.ok; });
    }
    return { panels: results, debugPartial: debugPartial };
}

module.exports = {
    PANELS: PANELS,
    findPanel: findPanel,
    planPanels: planPanels,
    installPanels: installPanels
};
