"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolveProjectRoot } = require("../src/utils/project_root");
const { getActiveProjectPath, writeActiveProject } = require("../src/utils/active_project");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-root-"));
}

test("resolveProjectRoot uses SCOUT_PROJECT_ROOT when set", () => {
  const tmp = makeTempDir();
  const prev = process.env.SCOUT_PROJECT_ROOT;
  process.env.SCOUT_PROJECT_ROOT = tmp;
  const root = resolveProjectRoot();
  if (prev === undefined) {
    delete process.env.SCOUT_PROJECT_ROOT;
  } else {
    process.env.SCOUT_PROJECT_ROOT = prev;
  }
  assert.equal(root, path.resolve(tmp));
});

test("resolveProjectRoot finds single project under cwd", () => {
  const tmp = makeTempDir();
  const project = path.join(tmp, "my-app");
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, "package.json"), "{}\n");

  const activePath = getActiveProjectPath();
  try { fs.unlinkSync(activePath); } catch {}

  const prevCwd = process.cwd();
  process.chdir(tmp);
  const root = resolveProjectRoot();
  process.chdir(prevCwd);

  assert.equal(root, path.resolve(project));
});

test("resolveProjectRoot prioritizes cwd markers over stale active project", () => {
  const tmp = makeTempDir();
  const stale = path.join(tmp, "stale-project");
  const current = path.join(tmp, "current-project");
  fs.mkdirSync(stale, { recursive: true });
  fs.mkdirSync(current, { recursive: true });
  fs.writeFileSync(path.join(current, "package.json"), "{}\n");

  const prevEnv = process.env.SCOUT_PROJECT_ROOT;
  delete process.env.SCOUT_PROJECT_ROOT;
  writeActiveProject(stale);

  const prevCwd = process.cwd();
  process.chdir(current);
  const root = resolveProjectRoot();
  process.chdir(prevCwd);

  if (prevEnv === undefined) delete process.env.SCOUT_PROJECT_ROOT;
  else process.env.SCOUT_PROJECT_ROOT = prevEnv;

  assert.equal(root, path.resolve(current));
});
