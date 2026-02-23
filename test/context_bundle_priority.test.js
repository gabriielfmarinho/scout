"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolGetContextBundle } = require("../src/tools/tool_get_context_bundle");
const { toolGenerateProjectBrief } = require("../src/tools/tool_generate_project_brief");
const { toolUpdateGlobalContext } = require("../src/tools/tool_update_global_context");
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
  ensureProjectDirs(tmp);
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo", dependencies: { express: "4.0.0" } }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "api.js"), "app.get('/health', handler)\n", "utf8");
  await toolGenerateProjectBrief({ context_pack: "default" });

  await toolUpdateGlobalContext({
    mode: "replace",
    entries: [
      "[must] Always validate input",
      "[prefer] Prefer shorter names",
    ],
  });
  invalidateGlobalContextCache();

  const out = await toolGetContextBundle({ include_preferential: false, max_items: 20 });
  assert.match(out, /include_preferential=false/);
  assert.doesNotMatch(out, /\[prefer\]\s+/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});
