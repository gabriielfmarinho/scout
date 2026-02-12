"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { writeActiveProject, readActiveProject, getActiveProjectPath } = require("../src/utils/active_project");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-active-"));
}

test("writeActiveProject stores path", () => {
  const tmp = makeTempDir();
  const filePath = getActiveProjectPath();
  let prev = null;
  try {
    prev = fs.readFileSync(filePath, "utf8");
  } catch {
    prev = null;
  }

  const savedPath = writeActiveProject(tmp);
  const data = readActiveProject();
  assert.equal(data.root, tmp);
  assert.ok(fs.existsSync(savedPath));

  if (prev !== null) {
    fs.writeFileSync(filePath, prev, "utf8");
  } else {
    try { fs.unlinkSync(filePath); } catch {}
  }
});
