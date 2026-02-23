"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");

function sanitizeProjectId(id) {
  return String(id).replace(/[\\\\/]/g, "_").replace(/[:]/g, "_");
}

function getProjectId(cwd) {
  const base = path.basename(cwd || process.cwd());
  return sanitizeProjectId(base);
}

function getProjectsRoot() {
  const home = os.homedir();
  return path.join(home, ".engineering-ai", "projects");
}

function getProjectRoot(cwd) {
  return path.join(getProjectsRoot(), getProjectId(cwd));
}

function getProjectPaths(cwd) {
  const root = getProjectRoot(cwd);
  return {
    root,
    cache: path.join(root, "cache"),
    cache_core: path.join(root, "cache", "core"),
    cache_specialists: path.join(root, "cache", "specialists"),
    docs: path.join(root, "docs"),
    devlog: path.join(root, "devlog"),
  };
}

function ensureProjectDirs(cwd) {
  const paths = getProjectPaths(cwd);
  for (const key of ["root", "cache", "cache_core", "cache_specialists", "docs", "devlog"]) {
    fs.mkdirSync(paths[key], { recursive: true });
  }
  return paths;
}

module.exports = {
  getProjectId,
  getProjectsRoot,
  getProjectRoot,
  getProjectPaths,
  ensureProjectDirs,
  sanitizeProjectId,
};
