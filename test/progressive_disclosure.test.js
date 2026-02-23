"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolGenerateProjectBrief } = require("../src/tools/tool_generate_project_brief");
const { toolGetContextBundle } = require("../src/tools/tool_get_context_bundle");
const { ensureProjectDirs } = require("../src/utils/paths");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-progressive-"));
}

test("project_brief persists all detected flows without truncation", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo", dependencies: { express: "4.0.0" } }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });

  const flowLines = [];
  for (let i = 0; i < 70; i++) {
    flowLines.push(`app.get('/route-${i}', handler${i})`);
  }
  fs.writeFileSync(path.join(tmp, "src", "routes.js"), flowLines.join("\n"), "utf8");

  await toolGenerateProjectBrief({ context_pack: "default" });

  const projectPaths = ensureProjectDirs(tmp);
  const brief = JSON.parse(fs.readFileSync(path.join(projectPaths.cache, "project_brief.json"), "utf8"));
  assert.ok(Array.isArray(brief.flows));
  assert.ok(brief.flows.length >= 70);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("get_context_bundle supports progressive disclosure cursor pagination", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo", dependencies: { express: "4.0.0" } }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "api.js"), "app.get('/a', h1)\napp.get('/b', h2)\napp.get('/c', h3)\n", "utf8");

  await toolGenerateProjectBrief({ context_pack: "default" });

  const first = await toolGetContextBundle({ topics: ["flows"], page_size: 2, include_preferential: false });
  assert.match(first, /progressive_disclosure=true/);
  assert.match(first, /has_more=true/);
  const m = first.match(/next_cursor=([^\n]+)/);
  assert.ok(m && m[1]);

  const second = await toolGetContextBundle({ topics: ["flows"], page_size: 2, cursor: m[1].trim(), include_preferential: false });
  assert.match(second, /returned_items=/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});
