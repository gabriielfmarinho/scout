"use strict";

const path = require("path");
const os = require("os");
const { readFileSafe } = require("./fs_utils");
const { formatEvidence } = require("./snippet");
const { parseRule } = require("./global_rules");

let cachedItems = null;

function getGlobalContextPath() {
  return path.join(os.homedir(), ".engineering-ai", "global", "active-context.md");
}

function parseGlobalContext(content, filePath) {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("-")) continue;
    const parsed = parseRule(line, "prefer");
    if (!parsed.text) continue;
    items.push({
      text: parsed.text,
      priority: parsed.priority,
      evidence: formatEvidence(filePath, i + 1, i + 1, line.trim()),
    });
  }
  return items;
}

function loadGlobalContextCached(forceReload = false) {
  if (cachedItems && !forceReload) return cachedItems;
  const filePath = getGlobalContextPath();
  const content = readFileSafe(filePath);
  cachedItems = parseGlobalContext(content, filePath);
  return cachedItems;
}

function invalidateGlobalContextCache() {
  cachedItems = null;
}

function preloadGlobalContextCache() {
  return loadGlobalContextCached(false);
}

module.exports = {
  getGlobalContextPath,
  loadGlobalContextCached,
  invalidateGlobalContextCache,
  preloadGlobalContextCache,
};
