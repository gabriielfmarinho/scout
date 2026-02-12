"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createProjectIntelligence } = require("../src/utils/project_intelligence");
const { ensureProjectDirs } = require("../src/utils/paths");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-intel-inc-"));
}

test("project intelligence reuses unchanged files incrementally", () => {
  const tmp = makeTempDir();
  const prev = process.cwd();
  process.chdir(tmp);
  ensureProjectDirs(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo", dependencies: { express: "4.0.0" } }));
  fs.writeFileSync(path.join(tmp, "api.js"), "app.get('/health', () => 'ok')\n");

  const first = createProjectIntelligence(tmp, { context_pack: "default" });
  assert.ok(first.incremental.total_files >= 2);

  const second = createProjectIntelligence(tmp, { context_pack: "default" });
  assert.ok(second.incremental.reused_files >= 1);

  process.chdir(prev);
});

