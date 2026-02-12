"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ensureProjectDirs } = require("./paths");
const { listFiles, isTextFile, readFileSafe, writeFileEnsureDir } = require("./fs_utils");

const INDEX_VERSION = 1;

function hashContent(content) {
  return crypto.createHash("sha1").update(content).digest("hex");
}

function getIndexPath(cwd) {
  const projectPaths = ensureProjectDirs(cwd);
  return path.join(projectPaths.cache, "index.json");
}

function loadIndex(cwd) {
  const indexPath = getIndexPath(cwd);
  try {
    const raw = fs.readFileSync(indexPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { version: INDEX_VERSION, root: cwd, files: {} };
  }
}

function saveIndex(cwd, index) {
  const indexPath = getIndexPath(cwd);
  writeFileEnsureDir(indexPath, JSON.stringify(index, null, 2));
}

function updateIndex(cwd) {
  const index = loadIndex(cwd);
  const files = listFiles(cwd);
  const seen = new Set();

  for (const file of files) {
    const rel = path.relative(cwd, file) || file;
    seen.add(rel);
    const stat = fs.statSync(file);
    const prev = index.files[rel];
    const changed = !prev || prev.mtimeMs !== stat.mtimeMs || prev.size !== stat.size;
    if (changed) {
      let hash = null;
      if (isTextFile(file)) {
        const content = readFileSafe(file) || "";
        hash = hashContent(content);
      }
      index.files[rel] = {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        hash,
      };
    }
  }

  for (const rel of Object.keys(index.files)) {
    if (!seen.has(rel)) delete index.files[rel];
  }

  index.version = INDEX_VERSION;
  index.root = cwd;
  saveIndex(cwd, index);
  return index;
}

function getIndexedFiles(cwd) {
  const index = updateIndex(cwd);
  return Object.keys(index.files).map((rel) => path.join(cwd, rel));
}

module.exports = { getIndexedFiles, loadIndex, updateIndex };
