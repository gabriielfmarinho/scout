"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolGenerateProjectBrief } = require("../src/tools/tool_generate_project_brief");
const { toolUpdateProjectContext } = require("../src/tools/tool_update_project_context");
const { toolAuditContextQuality } = require("../src/tools/tool_audit_context_quality");
const { toolAnalyzeImpact } = require("../src/tools/tool_analyze_impact");
const { ensureProjectDirs } = require("../src/utils/paths");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-quality-"));
}

test("update_project_context validates structured entry in strict quality mode", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
  await toolGenerateProjectBrief({ context_pack: "default" });

  const out = await toolUpdateProjectContext({
    mode: "append",
    strict_quality: true,
    entries_structured: [
      { summary: "Rule without evidence" },
    ],
  });
  assert.match(out, /Invalid structured entry/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("audit_context_quality reports low-quality project entries", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
  await toolGenerateProjectBrief({ context_pack: "default" });
  await toolUpdateProjectContext({
    mode: "append",
    topic: "quality-test",
    entries: ["[prefer] short free text without evidence"],
  });

  const out = await toolAuditContextQuality({ scope: "project", min_quality: 90, max_results: 50 });
  assert.match(out, /quality-test/);
  assert.match(out, /missing_evidence|weak_evidence_format/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("strict quality rejects evidence snippet mismatch and vague summary", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "rules.js"), "const mustUseCache = true;\n", "utf8");
  await toolGenerateProjectBrief({ context_pack: "default" });

  const out = await toolUpdateProjectContext({
    mode: "append",
    strict_quality: true,
    entries_structured: [
      {
        topic: "quality-test",
        summary: "TBD",
        rationale: "Detailed rationale with clear intent.",
        evidence: "src/rules.js:1-1: this text does not exist",
        owner: "platform",
        confidence: "high",
        status: "draft",
        priority: "must",
      },
    ],
  });
  assert.match(out, /summary contains placeholder terms/);
  assert.match(out, /evidence_snippet_mismatch/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("analyze_impact persists structured metadata for quality", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "billing.js"), "function processPayment() {}\nprocessPayment();\n", "utf8");
  await toolGenerateProjectBrief({ context_pack: "default" });

  await toolAnalyzeImpact({
    target: "processPayment",
    persist_to_context: true,
    persist_topic: "flow-investigation",
    max_results: 5,
  });

  const projectPaths = ensureProjectDirs(tmp);
  const specialist = JSON.parse(fs.readFileSync(path.join(projectPaths.cache, "specialists", "flow-investigation.json"), "utf8"));
  const hit = (specialist.items || []).find((i) => String(i.text || "").includes("processPayment"));
  assert.ok(hit);
  assert.equal(hit.owner, "scout");
  assert.equal(hit.status, "reviewed");
  assert.ok(String(hit.rationale || "").length >= 12);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});
