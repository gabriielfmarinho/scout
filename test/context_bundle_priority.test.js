"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolGetContextBundle } = require("../src/tools/tool_get_context_bundle");
const { invalidateGlobalContextCache } = require("../src/utils/global_context_cache");
const { ensureProjectDirs } = require("../src/utils/paths");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-bundle-prio-"));
}

test("get_context_bundle supports preferential exclusion mode", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);
  const projectPaths = ensureProjectDirs(tmp);
  fs.writeFileSync(path.join(projectPaths.docs, "active-context.md"), "- project rule\n", "utf8");

  const globalDir = path.join(os.homedir(), ".engineering-ai", "global");
  fs.mkdirSync(globalDir, { recursive: true });
  fs.writeFileSync(path.join(globalDir, "active-context.md"), "- [must] Always validate input\n- [prefer] Prefer shorter names\n", "utf8");
  invalidateGlobalContextCache();

  const out = await toolGetContextBundle({ include_preferential: false, max_items: 20 });
  assert.match(out, /include_preferential=false/);
  assert.doesNotMatch(out, /\[prefer\]\s+/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});
