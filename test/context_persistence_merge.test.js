"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolGenerateProjectBrief } = require("../src/tools/tool_generate_project_brief");
const { toolAnalyzeProject } = require("../src/tools/tool_analyze_project");
const { toolAnalyzeImpact } = require("../src/tools/tool_analyze_impact");
const { toolQueryStructure } = require("../src/tools/tool_query_structure");
const { toolUpdateProjectContext } = require("../src/tools/tool_update_project_context");
const { toolGetContextBundle } = require("../src/tools/tool_get_context_bundle");
const { ensureProjectDirs } = require("../src/utils/paths");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-ctx-merge-"));
}

test("project specialist references are preserved after full re-analysis", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo", dependencies: { express: "4.0.0" } }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "api.js"), "app.get('/health', handler)\n", "utf8");

  await toolGenerateProjectBrief({ context_pack: "default" });
  await toolUpdateProjectContext({
    mode: "append",
    topic: "domain-rules",
    entries: ["[must] Do not break payload schema v1"],
  });

  const projectPaths = ensureProjectDirs(tmp);
  const before = JSON.parse(fs.readFileSync(path.join(projectPaths.cache, "context_manifest.json"), "utf8"));
  const beforeTopic = before.specialists.find((s) => s.topic === "domain-rules");
  assert.ok(beforeTopic);

  await toolAnalyzeProject({ quick: false });

  const after = JSON.parse(fs.readFileSync(path.join(projectPaths.cache, "context_manifest.json"), "utf8"));
  const afterTopic = after.specialists.find((s) => s.topic === "domain-rules");
  assert.ok(afterTopic);
  assert.equal(afterTopic.cache_path, beforeTopic.cache_path);
  assert.equal(afterTopic.doc_path, beforeTopic.doc_path);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("auto-generated specialist entries are merged without losing previous signals", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo", dependencies: { express: "4.0.0" } }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "api.js"), "app.get('/v1/orders', handler)\n", "utf8");

  await toolGenerateProjectBrief({ context_pack: "default" });

  fs.writeFileSync(path.join(tmp, "src", "api.js"), "// temporary empty scan window\n", "utf8");
  await toolGenerateProjectBrief({ context_pack: "default" });

  const out = await toolGetContextBundle({ topics: ["flows"], include_preferential: true, page_size: 100 });
  assert.match(out, /GET \/v1\/orders/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("analyze_impact can merge point analysis into project context", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "billing.js"), "function processPayment() {}\nprocessPayment()\n", "utf8");

  await toolGenerateProjectBrief({ context_pack: "default" });
  await toolAnalyzeImpact({
    target: "processPayment",
    persist_to_context: true,
    persist_topic: "flow-investigation",
    max_results: 10,
  });

  const out = await toolGetContextBundle({ topics: ["flow-investigation"], include_preferential: true, page_size: 50 });
  assert.match(out, /flow-investigation/);
  assert.match(out, /processPayment/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("analyze_impact persists to context by default", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "orders.js"), "function calculateTotal() {}\ncalculateTotal()\n", "utf8");

  await toolGenerateProjectBrief({ context_pack: "default" });
  await toolAnalyzeImpact({
    target: "calculateTotal",
    persist_topic: "flow-investigation",
    max_results: 10,
  });

  const out = await toolGetContextBundle({ topics: ["flow-investigation"], include_preferential: true, page_size: 50 });
  assert.match(out, /flow-investigation/);
  assert.match(out, /calculateTotal/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("query_structure can merge point analysis into project context", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
  fs.writeFileSync(path.join(tmp, "service.js"), `
function processPayment() {
  return true;
}
function handler() {
  processPayment();
}
`, "utf8");

  await toolGenerateProjectBrief({ context_pack: "default" });
  await toolQueryStructure({
    mode: "who_calls",
    target: "processPayment",
    persist_to_context: true,
    persist_topic: "flow-investigation",
    max_results: 10,
  });

  const out = await toolGetContextBundle({ topics: ["flow-investigation"], include_preferential: true, page_size: 50 });
  assert.match(out, /flow-investigation/);
  assert.match(out, /who_calls processPayment/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});
