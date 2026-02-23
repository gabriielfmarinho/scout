"use strict";

const path = require("path");
const { formatToon } = require("../utils/toon");
const { ensureProjectDirs } = require("../utils/paths");
const { parsePriorityPrefix, parseRule } = require("../utils/global_rules");
const { normalizeTopicName, upsertProjectSpecialistEntries, loadAllSpecialistItems } = require("../utils/specialized_context");
const { normalizeStructuredEntry, validateStructuredEntry } = require("../utils/context_quality");

function normalizeEntries(entries) {
  return entries
    .map((e) => String(e).trim())
    .filter((e) => e.length > 0)
    .map((e) => (e.startsWith("-") ? e.replace(/^\s*-\s*/, "") : e));
}

async function toolUpdateProjectContext(args) {
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  const projectPaths = ensureProjectDirs(cwd);
  const mode = args.mode || "append";
  const defaultPriority = args.priority || "prefer";
  const strict = args.strict_priority !== false;
  const explicitTopic = args.topic ? normalizeTopicName(args.topic, "general") : "";
  const rawEntries = normalizeEntries(args.entries || []);
  const rawStructured = Array.isArray(args.entries_structured) ? args.entries_structured : [];
  const strictQuality = args.strict_quality === true;
  if (!rawEntries.length && !rawStructured.length) {
    return formatToon(["status", "path", "mode", "count"], [["error", "", mode, 0]])
      + "\n\nProvide at least one entry in `entries` or `entries_structured`.";
  }

  const entries = [];
  const current = loadAllSpecialistItems(projectPaths);
  const previousByKey = new Map();
  for (const [topic, items] of Object.entries(current.byTopic || {})) {
    for (const item of items || []) {
      previousByKey.set(`${topic}|${String(item.text || "").trim()}`, String(item.status || "").trim().toLowerCase());
    }
  }
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
    entries.push({
      text: parsed.text,
      priority: parsed.priority,
      topic: explicitTopic || "general",
      source: "project_user",
      evidence: "",
    });
  }
  for (const entry of rawStructured) {
    const normalized = normalizeStructuredEntry(entry, {
      topic: explicitTopic || normalizeTopicName(entry.topic || "general", "general"),
      source: "project_user",
      status: "draft",
      confidence: "medium",
    });
    const key = `${normalizeTopicName(normalized.topic, "general")}|${normalized.text}`;
    const errors = validateStructuredEntry(normalized, {
      previous_status: previousByKey.get(key) || "",
      cwd,
    });
    if (strictQuality && errors.length) {
      return formatToon(["status", "path", "mode", "count"], [["error", "", mode, 0]])
        + `\n\nInvalid structured entry: ${errors.join("; ")}`;
    }
    entries.push(normalized);
  }

  const persisted = upsertProjectSpecialistEntries(cwd, entries, mode);
  log("info", "update_project_context", {
    root: cwd,
    mode,
    count: entries.length,
    manifest: persisted.manifestPath,
  });

  const headers = ["status", "path", "mode", "count", "manifest"];
  const rows = [[
    "ok",
    path.join(projectPaths.docs, "active-context.md"),
    mode,
    entries.length,
    persisted.manifestPath,
  ]];
  return formatToon(headers, rows);
}

module.exports = { toolUpdateProjectContext };
