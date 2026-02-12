"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolGenerateProjectBrief } = require("../src/tools/tool_generate_project_brief");
const { ensureProjectDirs } = require("../src/utils/paths");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-brief-"));
}

test("generate_project_brief persists markdown and json brief", async () => {
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

  const briefMd = path.join(projectPaths.docs, "project-brief.md");
  const briefJson = path.join(projectPaths.cache, "project_brief.json");
  assert.ok(fs.existsSync(briefMd));
  assert.ok(fs.existsSync(briefJson));

  const content = fs.readFileSync(briefMd, "utf8");
  assert.match(content, /Project Brief/);
  assert.match(content, /Critical Flows/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) {
    delete process.env.SCOUT_PROJECT_ROOT;
  } else {
    process.env.SCOUT_PROJECT_ROOT = prevEnv;
  }
});

