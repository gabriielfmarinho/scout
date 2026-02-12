"use strict";

const path = require("path");
const { ensureProjectDirs } = require("../utils/paths");
const { formatToon } = require("../utils/toon");
const { writeFileEnsureDir, readFileSafe } = require("../utils/fs_utils");

async function toolDevlogAppend(args) {
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "devlog_append_root", { root: cwd });
  const projectPaths = ensureProjectDirs(cwd);
  const entry = {
    timestamp: new Date().toISOString(),
    type: args.type,
    summary: args.summary,
    files: args.files || [],
    tags: args.tags || [],
  };

  const logPath = path.join(projectPaths.devlog, "timeline.jsonl");
  const existing = readFileSafe(logPath) || "";
  const next = existing + JSON.stringify(entry) + "\n";
  writeFileEnsureDir(logPath, next);

  const headers = ["status", "path", "timestamp", "summary", "tags"];
  const rows = [["ok", logPath, entry.timestamp, entry.summary, (entry.tags || []).join(", ")]];
  return formatToon(headers, rows);
}

module.exports = { toolDevlogAppend };
