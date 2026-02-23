"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolveProjectRoot } = require("../src/utils/project_root");
const { getActiveProjectPath } = require("../src/utils/active_project");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-marker-"));
}

test("resolveProjectRoot finds .scout marker", () => {
  const tmp = makeTempDir();
  const project = path.join(tmp, "proj");
  const subdir = path.join(project, "subdir");
  fs.mkdirSync(subdir, { recursive: true });
  fs.writeFileSync(path.join(project, ".scout"), "");

  const activePath = getActiveProjectPath();
  try { fs.unlinkSync(activePath); } catch {}

  const prev = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  delete process.env.SCOUT_PROJECT_ROOT;
  process.chdir(subdir);
  const root = resolveProjectRoot();
  process.chdir(prev);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;

  assert.equal(root, project);
});

test("resolveProjectRoot finds .scout-project marker", () => {
  const tmp = makeTempDir();
  const project = path.join(tmp, "proj-custom");
  const subdir = path.join(project, "subdir");
  fs.mkdirSync(subdir, { recursive: true });
  fs.writeFileSync(path.join(project, ".scout-project"), "");

  const activePath = getActiveProjectPath();
  try { fs.unlinkSync(activePath); } catch {}

  const prev = process.cwd();
  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  delete process.env.SCOUT_PROJECT_ROOT;
  process.chdir(subdir);
  const root = resolveProjectRoot();
  process.chdir(prev);
  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;

  assert.equal(root, project);
});
