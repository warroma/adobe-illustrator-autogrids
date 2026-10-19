"use strict";

var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var panels = require("../src/panels");
var detect = require("../src/detect");

var REPO = path.join(__dirname, "..", "..");

// ---- o catálogo bate com o que existe no repositório e com o que o build empacota ----
(function () {
    var pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
    var bundled = pkg.build.extraResources.map(function (r) { return r.to; });
    panels.PANELS.forEach(function (p) {
        assert.ok(bundled.indexOf(p.id) >= 0, p.id + " precisa estar em build.extraResources do package.json");
        var xml = fs.readFileSync(path.join(REPO, p.id, "CSXS", "manifest.xml"), "utf8");
        assert.ok(xml.indexOf('ExtensionBundleId="' + p.id + '"') >= 0, p.id + ": o id do catálogo tem que ser o ExtensionBundleId do manifest");
        assert.ok(detect.readPanelVersion(path.join(REPO, p.id)), p.id + ": manifest sem versão");
    });
    assert.deepStrictEqual(panels.PANELS.map(function (p) { return p.id; }), ["com.autogrids.panel", "com.autophysics.panel"]);
    console.log("catálogo: OK —", panels.PANELS.map(function (p) { return p.name + " " + detect.readPanelVersion(path.join(REPO, p.id)); }).join(", "));
})();

// ---- planPanels / installPanels com pastas de verdade num temporário ----
var TMP = fs.mkdtempSync(path.join(os.tmpdir(), "autogrids-panels-"));
function writePanel(dir, id, version, extraFile) {
    fs.mkdirSync(path.join(dir, "CSXS"), { recursive: true });
    fs.writeFileSync(path.join(dir, "CSXS", "manifest.xml"),
        '<ExtensionManifest ExtensionBundleId="' + id + '" ExtensionBundleVersion="' + version + '"></ExtensionManifest>');
    if (extraFile) fs.writeFileSync(path.join(dir, extraFile), extraFile);
    return dir;
}
function fakeRunner(calls) {
    return function (cmd, args) { calls.push([cmd].concat(args).join(" ")); };
}

try {
    var sourceRoot = path.join(TMP, "resources");
    writePanel(path.join(sourceRoot, "com.autogrids.panel"), "com.autogrids.panel", "1.1.1", "grids.txt");
    writePanel(path.join(sourceRoot, "com.autophysics.panel"), "com.autophysics.panel", "1.0.0", "physics.txt");

    // AutoGrids antigo instalado, AutoPhysics ainda não
    (function () {
        var env = { APPDATA: path.join(TMP, "user1") };
        var destRoot = detect.cepExtensionsDir("win32", env);
        writePanel(path.join(destRoot, "com.autogrids.panel"), "com.autogrids.panel", "1.0.0", "velho.txt");
        var plan = panels.planPanels(sourceRoot, destRoot);
        assert.strictEqual(plan.length, 2);
        assert.strictEqual(plan[0].mode, "update");
        assert.strictEqual(plan[0].installed.version, "1.0.0");
        assert.strictEqual(plan[0].bundledVersion, "1.1.1");
        assert.strictEqual(plan[1].mode, "install");
        assert.strictEqual(plan[1].available, true);
        assert.strictEqual(plan[1].minYear, 2020);
        console.log("planPanels: OK (AutoGrids " + plan[0].mode + ", AutoPhysics " + plan[1].mode + ")");

        var calls = [], logLines = [];
        var r = panels.installPanels(["com.autogrids.panel", "com.autophysics.panel"], {
            sourceRoot: sourceRoot, platform: "darwin", env: { HOME: path.join(TMP, "mac") },
            log: function (l) { logLines.push(l); }, runner: fakeRunner(calls)
        });
        assert.strictEqual(r.panels.length, 2);
        r.panels.forEach(function (p) { assert.strictEqual(p.ok, true, p.name + " instalado"); });
        var macRoot = detect.cepExtensionsDir("darwin", { HOME: path.join(TMP, "mac") });
        assert.ok(fs.existsSync(path.join(macRoot, "com.autogrids.panel", "grids.txt")));
        assert.ok(fs.existsSync(path.join(macRoot, "com.autophysics.panel", "physics.txt")));
        assert.strictEqual(r.panels[1].version, "1.0.0");
        // xattr uma vez por painel + o modo de desenvolvimento uma vez só (6 versões do CSXS)
        assert.strictEqual(calls.filter(function (c) { return c.indexOf("xattr -cr") === 0; }).length, 2);
        assert.strictEqual(calls.filter(function (c) { return c.indexOf("defaults write") === 0; }).length, 6);
        assert.strictEqual(r.debugPartial, false);
        console.log("installPanels (os dois, macOS): OK — " + calls.length + " comandos");
    })();

    // só o escolhido é instalado
    (function () {
        var env = { APPDATA: path.join(TMP, "user2") };
        var r = panels.installPanels(["com.autophysics.panel"], {
            sourceRoot: sourceRoot, platform: "win32", env: env, runner: fakeRunner([])
        });
        assert.deepStrictEqual(r.panels.map(function (p) { return p.id; }), ["com.autophysics.panel"]);
        var root = detect.cepExtensionsDir("win32", env);
        assert.ok(fs.existsSync(path.join(root, "com.autophysics.panel")));
        assert.ok(!fs.existsSync(path.join(root, "com.autogrids.panel")), "o painel não marcado não pode ser instalado");
        console.log("installPanels (só o marcado): OK");
    })();

    // um painel falha (arquivo preso), o outro instala mesmo assim e mantém o anterior no lugar
    (function () {
        var env = { APPDATA: path.join(TMP, "user3") };
        var root = detect.cepExtensionsDir("win32", env);
        var gridsDest = path.join(root, "com.autogrids.panel");
        writePanel(gridsDest, "com.autogrids.panel", "1.0.0", "velho.txt");
        var flakyFs = Object.create(fs);
        flakyFs.renameSync = function (from, to) {
            if (from === gridsDest + ".novo" && to === gridsDest) {
                var e = new Error("EBUSY: resource busy or locked, rename");
                e.code = "EBUSY";
                throw e;
            }
            return fs.renameSync(from, to);
        };
        var calls = [];
        var r = panels.installPanels(["com.autogrids.panel", "com.autophysics.panel"], {
            sourceRoot: sourceRoot, platform: "win32", env: env, fsImpl: flakyFs, runner: fakeRunner(calls)
        });
        assert.strictEqual(r.panels[0].ok, false);
        assert.ok(/EBUSY/.test(r.panels[0].error));
        assert.strictEqual(r.panels[1].ok, true, "o outro painel instala mesmo com a falha do primeiro");
        assert.strictEqual(detect.readPanelVersion(gridsDest), "1.0.0", "a versão anterior volta para o lugar");
        assert.strictEqual(calls.filter(function (c) { return c.indexOf("reg add") === 0; }).length, 6, "modo de desenvolvimento ligado (um painel deu certo)");
        console.log("installPanels (falha em um): OK — o outro instalou, o que falhou ficou na versão anterior");
    })();

    // nada deu certo: não mexe no modo de desenvolvimento
    (function () {
        var calls = [];
        var r = panels.installPanels(["com.autophysics.panel"], {
            sourceRoot: path.join(TMP, "nao-existe"), platform: "win32", env: { APPDATA: path.join(TMP, "user4") }, runner: fakeRunner(calls)
        });
        assert.strictEqual(r.panels[0].ok, false);
        assert.strictEqual(calls.length, 0, "sem nenhum painel instalado, não roda reg/defaults");
        console.log("installPanels (nenhum instalado): OK, modo de desenvolvimento intocado");
    })();

    // pacote sem a pasta de um painel: aparece como indisponível
    (function () {
        var partial = path.join(TMP, "partial");
        writePanel(path.join(partial, "com.autogrids.panel"), "com.autogrids.panel", "1.1.1");
        var plan = panels.planPanels(partial, path.join(TMP, "empty-dest"));
        assert.strictEqual(plan[0].available, true);
        assert.strictEqual(plan[1].available, false);
        console.log("planPanels (pacote incompleto): OK, painel ausente marcado como indisponível");
    })();
} finally {
    fs.rmSync(TMP, { recursive: true, force: true });
}

console.log("ALL panels.js CHECKS PASSED");
