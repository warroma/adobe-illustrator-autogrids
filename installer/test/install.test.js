"use strict";

var assert = require("assert");
var path = require("path");
var install = require("../src/install");

// ---- enableDebugMode: calls the right command once per CSXS version, on each platform ----
function testEnableDebugMode(platform, expectedCmd) {
    var calls = [];
    var fakeRunner = function (cmd, args) {
        calls.push({ cmd: cmd, args: args });
    };
    var logLines = [];
    var results = install.enableDebugMode(platform, function (l) { logLines.push(l); }, fakeRunner);

    assert.strictEqual(calls.length, install.CSXS_VERSIONS.length, platform + ": expected one call per CSXS version");
    assert.strictEqual(results.length, install.CSXS_VERSIONS.length);
    results.forEach(function (r) { assert.strictEqual(r.ok, true, platform + ": expected ok:true when the runner does not throw"); });
    calls.forEach(function (c, i) {
        assert.strictEqual(c.cmd, expectedCmd, platform + ": wrong command");
        assert.ok(c.args.indexOf("CSXS." + install.CSXS_VERSIONS[i]) >= 0 || c.args.join(" ").indexOf("CSXS." + install.CSXS_VERSIONS[i]) >= 0, platform + ": CSXS version missing from args: " + JSON.stringify(c.args));
        assert.ok(c.args.join(" ").indexOf("PlayerDebugMode") >= 0, platform + ": PlayerDebugMode missing from args");
    });
    assert.strictEqual(logLines.length, install.CSXS_VERSIONS.length, "expected one log line per version");
    console.log("enableDebugMode(" + platform + "): OK —", calls.length, "calls to " + expectedCmd);
}
testEnableDebugMode("darwin", "defaults");
testEnableDebugMode("win32", "reg");

// ---- enableDebugMode: a failing call is captured per-entry, not thrown ----
(function () {
    var callCount = 0;
    var flakyRunner = function () {
        callCount++;
        if (callCount === 2) throw new Error("boom");
    };
    var results = install.enableDebugMode("darwin", null, flakyRunner);
    assert.strictEqual(results.length, install.CSXS_VERSIONS.length);
    assert.strictEqual(results[1].ok, false, "the failing call should be marked ok:false");
    assert.strictEqual(results[1].error, "boom");
    assert.strictEqual(results[0].ok, true, "other calls should still succeed independently");
    assert.strictEqual(results[2].ok, true);
    console.log("enableDebugMode: a single failing CSXS version does not abort the rest — OK");
})();

// ---- enableDebugMode: unsupported platform fails every entry with a message, does not throw ----
(function () {
    var results = install.enableDebugMode("linux", null, function () { throw new Error("should never be called"); });
    assert.strictEqual(results.length, install.CSXS_VERSIONS.length);
    results.forEach(function (r) {
        assert.strictEqual(r.ok, false);
        assert.ok(/não suportada/.test(r.error));
    });
    console.log("enableDebugMode(linux/unsupported): OK, fails gracefully per entry");
})();

// ---- installPanel: computes the right destination and calls cpSync with the right args ----
(function () {
    var calls = { mkdirSync: [], cpSync: [] };
    var fakeFs = {
        mkdirSync: function (p, opts) { calls.mkdirSync.push({ p: p, opts: opts }); },
        cpSync: function (src, dest, opts) { calls.cpSync.push({ src: src, dest: dest, opts: opts }); }
    };
    var logLines = [];
    var source = "/repo/com.autogrids.panel";
    var dest = install.installPanel(source, "darwin", { HOME: "/Users/test" }, function (l) { logLines.push(l); }, fakeFs);

    var expectedDestRoot = path.join("/Users/test", "Library", "Application Support", "Adobe", "CEP", "extensions");
    var expectedDest = path.join(expectedDestRoot, "com.autogrids.panel");

    assert.strictEqual(dest, expectedDest);
    assert.strictEqual(calls.mkdirSync.length, 1);
    assert.strictEqual(calls.mkdirSync[0].p, expectedDestRoot);
    assert.strictEqual(calls.mkdirSync[0].opts.recursive, true);
    assert.strictEqual(calls.cpSync.length, 1);
    assert.strictEqual(calls.cpSync[0].src, source);
    assert.strictEqual(calls.cpSync[0].dest, expectedDest);
    assert.strictEqual(calls.cpSync[0].opts.recursive, true);
    assert.strictEqual(calls.cpSync[0].opts.force, true);
    assert.strictEqual(logLines.length, 1);
    console.log("installPanel: OK — computes", expectedDest, "and calls mkdirSync+cpSync correctly");
})();

console.log("ALL install.js CHECKS PASSED");
