"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolCompressContext } = require("../src/tools/tool_compress_context");
const { ensureProjectDirs } = require("../src/utils/paths");
const { getCoreFilePath } = require("../src/utils/cache_files");

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scout-test-"));
  return dir;
}

test("compress_context writes active-context from fingerprint", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  const projectPaths = ensureProjectDirs(tmp);
  const fingerprint = {
    languages: ["JavaScript"],
    buildTools: ["npm"],
    frameworks: ["Express"],
    infra: ["Dockerfile"],
  };
  fs.writeFileSync(getCoreFilePath(projectPaths, "fingerprint.json"), JSON.stringify(fingerprint));
  fs.writeFileSync(path.join(projectPaths.devlog, "timeline.jsonl"), "");

  await toolCompressContext({ max_bullets: 10 });

  const active = fs.readFileSync(path.join(projectPaths.docs, "active-context.md"), "utf8");
  assert.match(active, /Languages: JavaScript/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) {
    delete process.env.SCOUT_PROJECT_ROOT;
  } else {
    process.env.SCOUT_PROJECT_ROOT = prevEnv;
  }
});
