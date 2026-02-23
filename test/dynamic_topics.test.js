"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolGenerateProjectBrief } = require("../src/tools/tool_generate_project_brief");
const { toolUpdateProjectContext } = require("../src/tools/tool_update_project_context");
const { toolUpdateGlobalContext } = require("../src/tools/tool_update_global_context");
const { toolGetContextBundle } = require("../src/tools/tool_get_context_bundle");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-dyn-topics-"));
}

test("project supports dynamic specialist topics", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
  await toolGenerateProjectBrief({ context_pack: "default" });
  await toolUpdateProjectContext({
    mode: "append",
    topic: "domain-rules",
    entries: ["[must] Maintain backward compatibility for billing payload"],
  });

  const out = await toolGetContextBundle({ topics: ["domain-rules"], include_preferential: false, page_size: 50 });
  assert.match(out, /available_topics=.*domain-rules/);
  assert.match(out, /\[domain-rules\]/);
  assert.match(out, /backward compatibility for billing payload/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});

test("global supports dynamic specialist topics", async () => {
  const tmp = makeTempDir();
  const prevCwd = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  process.chdir(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
  await toolGenerateProjectBrief({ context_pack: "default" });
  await toolUpdateGlobalContext({
    mode: "replace",
    topic: "team-playbook",
    entries: ["[must] ADR required for breaking API changes"],
  });

  const out = await toolGetContextBundle({ topics: ["overview"], global_topics: ["team-playbook"], page_size: 50 });
  assert.match(out, /available_global_topics=.*team-playbook/);
  assert.match(out, /ADR required for breaking API changes/);

  process.chdir(prevCwd);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;
});
