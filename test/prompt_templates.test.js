"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { listPromptTemplates, getPromptTemplate, savePromptTemplate } = require("../src/utils/prompt_templates");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-prompts-"));
}

test("prompt template utilities list and load project templates", () => {
  const tmp = makeTempDir();
  const promptsDir = path.join(tmp, "prompts");
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.writeFileSync(path.join(promptsDir, "ROUND_TABLE_PROMPT.md"), "# Round Table\nbody\n", "utf8");

  const listed = listPromptTemplates(tmp, "project");
  assert.ok(listed.some((t) => t.name === "ROUND_TABLE_PROMPT.md"));

  const loaded = getPromptTemplate(tmp, "ROUND_TABLE_PROMPT.md", "project");
  assert.ok(loaded);
  assert.match(loaded.content, /Round Table/);
});

test("prompt template utilities reject traversal-like names", () => {
  const tmp = makeTempDir();
  const loaded = getPromptTemplate(tmp, "../secret.md", "all");
  assert.equal(loaded, null);
});

test("savePromptTemplate creates markdown template file", () => {
  const tmp = makeTempDir();
  const saved = savePromptTemplate(tmp, "MY_TEMPLATE.md", "# T\n", "project");
  assert.ok(fs.existsSync(saved));
  const raw = fs.readFileSync(saved, "utf8");
  assert.equal(raw, "# T\n");
});

