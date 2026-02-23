"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolGenerateProjectBrief } = require("../src/tools/tool_generate_project_brief");
const { ensureProjectDirs } = require("../src/utils/paths");
const { getCoreFilePath } = require("../src/utils/cache_files");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-brief-"));
}

test("generate_project_brief persists json brief and specialist architecture", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);
  const projectPaths = ensureProjectDirs(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
    name: "demo",
    dependencies: { express: "4.0.0", axios: "1.0.0" },
  }));
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "api.js"), `app.get("/health", handler)`);

  await toolGenerateProjectBrief({ context_pack: "default" });

  const briefJson = getCoreFilePath(projectPaths, "project_brief.json");
  const architectureMd = path.join(projectPaths.docs, "specialists", "architecture.md");
  const activeContext = path.join(projectPaths.docs, "active-context.md");
  assert.ok(fs.existsSync(briefJson));
  assert.ok(fs.existsSync(architectureMd));
  assert.ok(fs.existsSync(activeContext));

  const content = fs.readFileSync(architectureMd, "utf8");
  assert.match(content, /Architecture Summary/);
  assert.match(content, /Source of truth: project_brief.json/);
  assert.doesNotMatch(content, /unknown|none detected/i);

  const overview = JSON.parse(fs.readFileSync(path.join(projectPaths.cache, "specialists", "overview.json"), "utf8"));
  const overviewText = (overview.items || []).map((i) => i.text).join("\n");
  assert.doesNotMatch(overviewText, /Frameworks:|Build tools:|Runtime|integration|Conventions/i);

  process.chdir(prevCwd);
  if (prevEnv === undefined) {
    delete process.env.SCOUT_PROJECT_ROOT;
  } else {
    process.env.SCOUT_PROJECT_ROOT = prevEnv;
  }
});

test("generate_project_brief does not regress detected architecture signals on partial runs", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);
  const projectPaths = ensureProjectDirs(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
    name: "demo",
    dependencies: { express: "4.0.0" },
  }));
  fs.writeFileSync(path.join(tmp, "Dockerfile"), "FROM node:20\n");

  await toolGenerateProjectBrief({ context_pack: "default" });

  fs.unlinkSync(path.join(tmp, "package.json"));
  fs.unlinkSync(path.join(tmp, "Dockerfile"));

  await toolGenerateProjectBrief({ context_pack: "default" });

  const architectureMd = path.join(projectPaths.docs, "specialists", "architecture.md");
  const content = fs.readFileSync(architectureMd, "utf8");
  assert.match(content, /Frameworks: Express/);
  assert.match(content, /Infra: Dockerfile/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) {
    delete process.env.SCOUT_PROJECT_ROOT;
  } else {
    process.env.SCOUT_PROJECT_ROOT = prevEnv;
  }
});

test("flow detection ignores docs/tests noise and keeps source flows", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);
  const projectPaths = ensureProjectDirs(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo", dependencies: { express: "4.0.0" } }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "tests"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "api.js"), "app.get('/real-flow', handler)\n", "utf8");
  fs.writeFileSync(path.join(tmp, "docs", "notes.md"), "app.get('/doc-flow', handler)\n", "utf8");
  fs.writeFileSync(path.join(tmp, "tests", "api.test.js"), "app.get('/test-flow', handler)\n", "utf8");

  await toolGenerateProjectBrief({ context_pack: "default" });

  const flows = JSON.parse(fs.readFileSync(path.join(projectPaths.cache, "specialists", "flows.json"), "utf8"));
  const texts = (flows.items || []).map((i) => i.text).join("\n");
  assert.match(texts, /real-flow/);
  assert.doesNotMatch(texts, /doc-flow/);
  assert.doesNotMatch(texts, /test-flow/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) {
    delete process.env.SCOUT_PROJECT_ROOT;
  } else {
    process.env.SCOUT_PROJECT_ROOT = prevEnv;
  }
});

test("conventions persist monorepo and multi-module signals", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);
  const projectPaths = ensureProjectDirs(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo", workspaces: ["apps/*", "packages/*"] }), "utf8");
  fs.writeFileSync(path.join(tmp, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n  - packages/*\n", "utf8");
  fs.mkdirSync(path.join(tmp, "apps"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "packages"), { recursive: true });

  await toolGenerateProjectBrief({ context_pack: "default" });

  const conventions = JSON.parse(fs.readFileSync(path.join(projectPaths.cache, "specialists", "conventions.json"), "utf8"));
  const texts = (conventions.items || []).map((i) => i.text).join("\n");
  assert.match(texts, /Monorepo\/multi-module setup/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) {
    delete process.env.SCOUT_PROJECT_ROOT;
  } else {
    process.env.SCOUT_PROJECT_ROOT = prevEnv;
  }
});
