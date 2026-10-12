"use strict";

var assert = require("assert");
var path = require("path");
var detect = require("../src/detect");

var FAKE_MAC_ROOT = "/tmp/claude-0/-home-user-adobe-illustrator-autogrids/f613761d-45ac-5907-85b0-5bb1d40601b2/scratchpad/fake-mac-applications";
var FAKE_WIN_ADOBE_ROOT = "/tmp/claude-0/-home-user-adobe-illustrator-autogrids/f613761d-45ac-5907-85b0-5bb1d40601b2/scratchpad/fake-win-programfiles/Adobe";

// ---- extractYear ----
assert.strictEqual(detect.extractYear("Adobe Illustrator 2026"), 2026);
assert.strictEqual(detect.extractYear("Adobe Illustrator CC"), 0);
assert.strictEqual(detect.extractYear(""), 0);
console.log("extractYear: OK");

// ---- scanRootsForIllustrator: finds installs, ignores unrelated folders, sorts newest-first ----
var found = detect.scanRootsForIllustrator([FAKE_MAC_ROOT]);
assert.strictEqual(found.length, 2, "expected exactly 2 fake Illustrator installs, got " + found.length);
assert.strictEqual(found[0].name, "Adobe Illustrator 2026", "expected newest first");
assert.strictEqual(found[1].name, "Adobe Illustrator 2024");
assert.ok(!found.some(function (f) { return f.name === "Some Other App"; }), "unrelated folder leaked into results");
assert.strictEqual(found[0].path, path.join(FAKE_MAC_ROOT, "Adobe Illustrator 2026"));
console.log("scanRootsForIllustrator (mac-style root): OK —", found.map(function (f) { return f.name; }));

// ---- scanRootsForIllustrator: a root that doesn't exist on this machine must not throw ----
var emptyResult = detect.scanRootsForIllustrator(["/this/path/does/not/exist/on/any/machine"]);
assert.deepStrictEqual(emptyResult, [], "a missing root should yield an empty array, not throw");
console.log("scanRootsForIllustrator (missing root): OK, returns [] without throwing");

// ---- scanRootsForIllustrator: multiple roots combined (simulates Program Files + Program Files (x86)) ----
var combined = detect.scanRootsForIllustrator([FAKE_WIN_ADOBE_ROOT, "/also/does/not/exist"]);
assert.strictEqual(combined.length, 1);
assert.strictEqual(combined[0].name, "Adobe Illustrator 2025");
console.log("scanRootsForIllustrator (multiple roots, one missing): OK");

// ---- illustratorSearchRoots: platform-specific root selection ----
assert.deepStrictEqual(detect.illustratorSearchRoots("darwin", {}), ["/Applications"]);

var win32BothVars = detect.illustratorSearchRoots("win32", { "ProgramFiles": "C:\\Program Files", "ProgramFiles(x86)": "C:\\Program Files (x86)" });
assert.deepStrictEqual(win32BothVars, [
    path.join("C:\\Program Files", "Adobe"),
    path.join("C:\\Program Files (x86)", "Adobe")
]);

var win32NoVars = detect.illustratorSearchRoots("win32", {});
assert.deepStrictEqual(win32NoVars, ["C:\\Program Files\\Adobe"], "should fall back to a sane default when env vars are absent");

assert.deepStrictEqual(detect.illustratorSearchRoots("linux", {}), [], "unsupported platform should yield no roots, not throw");
console.log("illustratorSearchRoots: OK (darwin, win32 with/without env vars, unsupported platform)");

// ---- cepExtensionsDir ----
assert.strictEqual(
    detect.cepExtensionsDir("darwin", { HOME: "/Users/test" }),
    path.join("/Users/test", "Library", "Application Support", "Adobe", "CEP", "extensions")
);
assert.strictEqual(
    detect.cepExtensionsDir("win32", { APPDATA: "C:\\Users\\test\\AppData\\Roaming" }),
    path.join("C:\\Users\\test\\AppData\\Roaming", "Adobe", "CEP", "extensions")
);
assert.throws(function () { detect.cepExtensionsDir("linux", {}); }, /não suportada/);
console.log("cepExtensionsDir: OK (darwin, win32, unsupported platform throws)");

console.log("ALL detect.js CHECKS PASSED");
