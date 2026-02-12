"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { toolUpdateGlobalContext } = require("../src/tools/tool_update_global_context");

test("update_global_context appends entries", async () => {
  const globalDir = path.join(os.homedir(), ".engineering-ai", "global");
  const filePath = path.join(globalDir, "active-context.md");
  fs.mkdirSync(globalDir, { recursive: true });
  fs.writeFileSync(filePath, "- [prefer] Existing\n");

  await toolUpdateGlobalContext({ mode: "append", entries: ["[must] Name: Test User"] });

  const content = fs.readFileSync(filePath, "utf8");
  assert.match(content, /Existing/);
  assert.match(content, /Name: Test User/);
  assert.match(content, /\[must\]/);
});
