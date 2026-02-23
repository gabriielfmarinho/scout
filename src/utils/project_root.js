"use strict";

const fs = require("fs");
const path = require("path");
const { isGitRepo, runGit } = require("./git");
const { readActiveProject, writeActiveProject } = require("./active_project");

const MARKERS = new Set([
  ".git",
  ".idea",
  ".vscode",
  ".scout-project",
  ".scout",
  "package.json",
  "pnpm-workspace.yaml",
  "yarn.lock",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "requirements.txt",
  "setup.py",
  "composer.json",
  ".sln",
]);

function hasProjectMarkers(dir) {
  try {
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (MARKERS.has(name)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function readScoutMarker(dir) {
  const markerPath = path.join(dir, ".scout");
  return readProjectMarkerFile(markerPath, dir);
}

function readScoutProjectMarker(dir) {
  const markerPath = path.join(dir, ".scout-project");
  return readProjectMarkerFile(markerPath, dir);
}

function readProjectMarkerFile(markerPath, baseDir) {
  try {
    const stat = fs.statSync(markerPath);
    if (!stat.isFile()) return null;
    const raw = fs.readFileSync(markerPath, "utf8").trim();
    if (!raw) return baseDir;
    try {
      const data = JSON.parse(raw);
      if (data && typeof data.root === "string") {
        return path.resolve(baseDir, data.root);
      }
    } catch {
      // ignore parse errors, treat as marker-only
    }
    return baseDir;
  } catch {
    return null;
  }
}

function findScoutMarkerUpwards(startDir, maxDepth) {
  let current = path.resolve(startDir);
  for (let i = 0; i < maxDepth; i++) {
    const custom = readScoutProjectMarker(current);
    if (custom) return custom;
    const found = readScoutMarker(current);
    if (found) return found;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function findSingleProjectUnder(root, depth) {
  if (depth <= 0) return null;
  let candidates = [];
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(root, entry.name);
      if (readScoutProjectMarker(full) || readScoutMarker(full)) {
        candidates.push(full);
      } else if (hasProjectMarkers(full)) {
        candidates.push(full);
      } else {
        const nested = findSingleProjectUnder(full, depth - 1);
        if (nested) candidates.push(nested);
      }
    }
  } catch {
    return null;
  }

  const unique = Array.from(new Set(candidates.map((c) => path.resolve(c))));
  return unique.length === 1 ? unique[0] : null;
}

function resolveProjectRoot() {
  const envRoot = process.env.SCOUT_PROJECT_ROOT;
  if (envRoot && envRoot.trim()) {
    const root = path.resolve(envRoot.trim());
    writeActiveProject(root);
    return root;
  }

  const cwd = process.cwd();

  const markerRoot = findScoutMarkerUpwards(cwd, 8);
  if (markerRoot) {
    writeActiveProject(markerRoot);
    return markerRoot;
  }

  if (isGitRepo(cwd)) {
    try {
      const top = runGit(["rev-parse", "--show-toplevel"], { cwd });
      if (top) {
        const root = path.resolve(top.trim());
        writeActiveProject(root);
        return root;
      }
    } catch {
      return cwd;
    }
  }

  if (hasProjectMarkers(cwd)) {
    writeActiveProject(cwd);
    return cwd;
  }

  const single = findSingleProjectUnder(cwd, 2);
  if (single) {
    const root = path.resolve(single);
    writeActiveProject(root);
    return root;
  }

  const active = readActiveProject();
  if (active && active.root) {
    try {
      if (fs.statSync(active.root).isDirectory()) {
        return path.resolve(active.root);
      }
    } catch {
      // ignore
    }
  }

  return cwd;
}

module.exports = {
  resolveProjectRoot,
  hasProjectMarkers,
  findSingleProjectUnder,
  readScoutMarker,
  readScoutProjectMarker,
  findScoutMarkerUpwards,
};
