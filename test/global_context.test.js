"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolUpdateGlobalContext } = require("../src/tools/tool_update_global_context");

test("update_global_context persists global specialist context", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scout-global-ctx-"));
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");

  const globalDir = path.join(os.homedir(), ".engineering-ai", "global");
  const filePath = path.join(globalDir, "active-context.md");
  fs.mkdirSync(globalDir, { recursive: true });
  fs.writeFileSync(filePath, "", "utf8");

  const out = await toolUpdateGlobalContext({ mode: "replace", entries: ["[prefer] Existing", "[must] Name: Test User"] });

  const manifestPath = path.join(globalDir, "context_manifest.json");
  assert.ok(fs.existsSync(manifestPath));
  assert.match(out, /ok/);
  assert.match(out, /count/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("global entries with same text in different topics are preserved", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scout-global-topic-"));
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");

  await toolUpdateGlobalContext({ mode: "replace", entries: ["[prefer] Existing"] });
  await toolUpdateGlobalContext({ mode: "append", topic: "coding", entries: ["[must] Keep changelog"] });
  await toolUpdateGlobalContext({ mode: "append", topic: "workflow", entries: ["[must] Keep changelog"] });

  const globalDir = path.join(os.homedir(), ".engineering-ai", "global");
  const coding = JSON.parse(fs.readFileSync(path.join(globalDir, "specialists", "coding.json"), "utf8"));
  const workflow = JSON.parse(fs.readFileSync(path.join(globalDir, "specialists", "workflow.json"), "utf8"));
  assert.ok((coding.entries || []).some((e) => e.text === "Keep changelog"));
  assert.ok((workflow.entries || []).some((e) => e.text === "Keep changelog"));

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});
