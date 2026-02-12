"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { writeFileEnsureDir } = require("./fs_utils");

function getActiveProjectPath() {
  return path.join(os.homedir(), ".engineering-ai", "global", "active-project.json");
}

function readActiveProject() {
  const filePath = getActiveProjectPath();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (data && typeof data.root === "string") return data;
    return null;
  } catch {
    return null;
  }
}

function writeActiveProject(root) {
  const filePath = getActiveProjectPath();
  const payload = {
    root,
    updated_at: new Date().toISOString(),
  };
  writeFileEnsureDir(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

module.exports = { getActiveProjectPath, readActiveProject, writeActiveProject };
