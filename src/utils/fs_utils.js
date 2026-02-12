"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  "out",
  ".idea",
  ".vscode",
  ".gradle",
]);

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return true;
  const knownText = new Set([
    ".js", ".ts", ".tsx", ".jsx", ".json", ".md", ".yml", ".yaml",
    ".java", ".kt", ".kts", ".py", ".go", ".rs", ".rb",
    ".c", ".h", ".cpp", ".hpp", ".cs", ".php", ".scala",
    ".gradle", ".mvn", ".xml", ".toml", ".ini", ".cfg",
    ".sh", ".bat", ".ps1", ".sql", ".tf",
  ]);
  return knownText.has(ext);
}

function listFiles(rootDir, options = {}) {
  const ignoreDirs = options.ignoreDirs || DEFAULT_IGNORE_DIRS;
  const results = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
  }

  walk(rootDir);
  return results;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    return null;
  }
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function writeFileEnsureDir(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

module.exports = {
  DEFAULT_IGNORE_DIRS,
  isTextFile,
  listFiles,
  readFileSafe,
  fileExists,
  writeFileEnsureDir,
};
