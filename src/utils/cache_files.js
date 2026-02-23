"use strict";

const path = require("path");
const { readFileSafe, writeFileEnsureDir } = require("./fs_utils");

function getCoreDir(projectPaths) {
  return path.join(projectPaths.cache, "core");
}

function getCoreFilePath(projectPaths, fileName) {
  return path.join(getCoreDir(projectPaths), fileName);
}

function readCoreText(projectPaths, fileName) {
  const core = getCoreFilePath(projectPaths, fileName);
  return readFileSafe(core) || "";
}

function readCoreJson(projectPaths, fileName, fallback = null) {
  const raw = readCoreText(projectPaths, fileName);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeCoreFile(projectPaths, fileName, content) {
  const core = getCoreFilePath(projectPaths, fileName);
  writeFileEnsureDir(core, content);
  return core;
}

module.exports = {
  getCoreDir,
  getCoreFilePath,
  readCoreText,
  readCoreJson,
  writeCoreFile,
};
