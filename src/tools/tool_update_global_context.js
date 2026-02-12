"use strict";

const path = require("path");
const os = require("os");
const { readFileSafe, writeFileEnsureDir } = require("../utils/fs_utils");
const { formatToon } = require("../utils/toon");
const { invalidateGlobalContextCache } = require("../utils/global_context_cache");
const { parsePriorityPrefix, parseRule, formatRuleLine } = require("../utils/global_rules");

function normalizeEntries(entries) {
  return entries
    .map((e) => String(e).trim())
    .filter((e) => e.length > 0)
    .map((e) => (e.startsWith("-") ? e.replace(/^\s*-\s*/, "") : e));
}

async function toolUpdateGlobalContext(args) {
  const mode = args.mode || "append"; // append | replace
  const defaultPriority = args.priority || "prefer";
  const strict = args.strict_priority !== false;
  const rawEntries = normalizeEntries(args.entries || []);
  const entries = [];
  for (const e of rawEntries) {
    const prefixed = parsePriorityPrefix(e);
    if (!prefixed && strict && !args.priority) {
      return formatToon(
        ["status", "path", "mode", "count"],
        [["error", "", mode, 0]]
      ) + "\n\nMissing priority prefix. Use [must] or [prefer] in each entry, or pass `priority`.";
    }
    const parsed = parseRule(e, defaultPriority);
    if (!parsed.text) continue;
    entries.push(parsed);
  }

  const globalPath = path.join(os.homedir(), ".engineering-ai", "global", "active-context.md");
  const { log } = require("../utils/logger");
  log("info", "update_global_context_path", { path: globalPath });

  if (mode === "replace") {
    const ordered = [
      ...entries.filter((e) => e.priority === "must"),
      ...entries.filter((e) => e.priority !== "must"),
    ];
    const content = ordered.map((e) => formatRuleLine(e)).join("\n") + (ordered.length ? "\n" : "");
    writeFileEnsureDir(globalPath, content);
  } else {
    const existing = readFileSafe(globalPath) || "";
    const existingLines = existing.split(/\r?\n/).filter((l) => l.trim().startsWith("-"));
    const mergedByText = new Map();
    for (const line of existingLines) {
      const parsed = parseRule(line, "prefer");
      if (!parsed.text) continue;
      const prev = mergedByText.get(parsed.text);
      if (!prev || parsed.priority === "must") mergedByText.set(parsed.text, parsed.priority);
    }
    for (const e of entries) {
      const prev = mergedByText.get(e.text);
      if (!prev || e.priority === "must") {
        mergedByText.set(e.text, e.priority);
      }
    }
    const must = [];
    const prefer = [];
    for (const [text, priority] of mergedByText.entries()) {
      (priority === "must" ? must : prefer).push({ text, priority });
    }
    must.sort((a, b) => a.text.localeCompare(b.text));
    prefer.sort((a, b) => a.text.localeCompare(b.text));
    const content = [...must, ...prefer].map((e) => formatRuleLine(e)).join("\n") + (must.length + prefer.length ? "\n" : "");
    writeFileEnsureDir(globalPath, content);
  }
  invalidateGlobalContextCache();

  const headers = ["status", "path", "mode", "count"];
  const rows = [["ok", globalPath, mode, entries.length]];
  return formatToon(headers, rows);
}

module.exports = { toolUpdateGlobalContext };
