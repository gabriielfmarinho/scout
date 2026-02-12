"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const { getProjectId, getProjectPaths, sanitizeProjectId } = require("../src/utils/paths");

test("getProjectId uses basename", () => {
  const id = getProjectId("/tmp/my-project");
  assert.equal(id, "my-project");
});

test("sanitizeProjectId removes separators", () => {
  const id = sanitizeProjectId("foo/bar:baz");
  assert.equal(id, "foo_bar_baz");
});

test("getProjectPaths places in home engineering-ai", () => {
  const paths = getProjectPaths("/tmp/my-project");
  assert.equal(paths.root, path.join(os.homedir(), ".engineering-ai", "projects", "my-project"));
});
