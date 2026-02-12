"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { findWhoCalls, findSymbol, updateStructuralIndex } = require("../src/utils/structural_index");
const { ensureProjectDirs } = require("../src/utils/paths");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-struct-"));
}

test("structural index builds symbols and call relationships", () => {
  const tmp = makeTempDir();
  const prev = process.cwd();
  process.chdir(tmp);
  ensureProjectDirs(tmp);

  fs.writeFileSync(path.join(tmp, "service.js"), `
function processPayment() {
  return true;
}
function handler() {
  processPayment();
}
`);

  const idx = updateStructuralIndex(tmp);
  assert.ok(idx.symbols.some((s) => s.name === "processPayment"));

  const who = findWhoCalls(tmp, "processPayment", 10);
  assert.ok(who.some((r) => r.caller === "handler"));

  const defs = findSymbol(tmp, "processPayment", 10);
  assert.ok(defs.length > 0);

  process.chdir(prev);
});

