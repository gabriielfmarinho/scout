"use strict";

const { ensureProjectDirs } = require("./paths");
const { writeFileEnsureDir, readFileSafe } = require("./fs_utils");
const { getCoreFilePath } = require("./cache_files");

function appendTelemetry(cwd, tool, data = {}) {
  try {
    const projectPaths = ensureProjectDirs(cwd);
    const filePath = getCoreFilePath(projectPaths, "telemetry.jsonl");
    const existing = readFileSafe(filePath) || "";
    const entry = {
      ts: new Date().toISOString(),
      tool,
      ...data,
    };
    writeFileEnsureDir(filePath, `${existing}${JSON.stringify(entry)}\n`);
  } catch {
    // Telemetry should never break tool execution.
  }
}

module.exports = { appendTelemetry };
