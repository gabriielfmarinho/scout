"use strict";

const { formatToon } = require("../utils/toon");
const { invalidateGlobalContextCache } = require("../utils/global_context_cache");
const { parsePriorityPrefix, parseRule } = require("../utils/global_rules");
const { normalizeStructuredEntry, validateStructuredEntry } = require("../utils/context_quality");
const {
  classifyTopic,
  getGlobalContextPath,
  getGlobalManifestPath,
  loadAllGlobalEntries,
  normalizeTopicName,
  writeGlobalEntries,
} = require("../utils/global_specialized_context");

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
  const strictQuality = args.strict_quality === true;
  const rawEntries = normalizeEntries(args.entries || []);
  const rawStructured = Array.isArray(args.entries_structured) ? args.entries_structured : [];
  const explicitTopic = args.topic ? normalizeTopicName(args.topic, "general") : "";
  if (!rawEntries.length && !rawStructured.length) {
    return formatToon(["status", "path", "mode", "count"], [["error", "", mode, 0]])
      + "\n\nProvide at least one entry in `entries` or `entries_structured`.";
  }
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
    entries.push({ ...parsed, topic: explicitTopic || classifyTopic(parsed.text), source: "update_global_context" });
  }
  const existingLines = loadAllGlobalEntries();
  const previousByKey = new Map();
  for (const e of existingLines) {
    const key = `${normalizeTopicName(e.topic || classifyTopic(e.text), "general")}|${String(e.text || "").trim()}`;
    previousByKey.set(key, String(e.status || "").trim().toLowerCase());
  }
  for (const entry of rawStructured) {
    const normalized = normalizeStructuredEntry(entry, {
      topic: explicitTopic || normalizeTopicName(entry.topic || "general", "general"),
      source: "update_global_context",
      status: "draft",
      confidence: "medium",
    });
    const key = `${normalizeTopicName(normalized.topic, "general")}|${normalized.text}`;
    const errors = validateStructuredEntry(normalized, {
      previous_status: previousByKey.get(key) || "",
    });
    if (strictQuality && errors.length) {
      return formatToon(["status", "path", "mode", "count"], [["error", "", mode, 0]])
        + `\n\nInvalid structured entry: ${errors.join("; ")}`;
    }
    entries.push(normalized);
  }

  const globalPath = getGlobalContextPath();
  const { log } = require("../utils/logger");
  log("info", "update_global_context_path", { path: globalPath });

  let finalEntries = [];
  if (mode === "replace") {
    finalEntries = entries.map((e, idx) => ({
      id: `replace-${Date.now()}-${idx}`,
      text: e.text,
      summary: e.summary || e.text,
      decision: e.decision || "",
      rationale: e.rationale || "",
      priority: e.priority,
      topic: e.topic,
      confidence: e.confidence || "medium",
      owner: e.owner || "",
      status: e.status || "draft",
      createdAt: e.createdAt || new Date().toISOString(),
      updatedAt: e.updated_at || e.updatedAt || new Date().toISOString(),
      source: e.source || "update_global_context",
      evidence: e.evidence || "",
    }));
  } else {
    const mergedByText = new Map();
    for (const existing of existingLines) {
      const prev = mergedByText.get(existing.text);
      if (!prev || existing.priority === "must") {
        mergedByText.set(existing.text, {
          text: existing.text,
          summary: existing.summary || existing.text,
          decision: existing.decision || "",
          rationale: existing.rationale || "",
          priority: existing.priority,
          topic: existing.topic || classifyTopic(existing.text),
          confidence: existing.confidence || "medium",
          owner: existing.owner || "",
          status: existing.status || "draft",
          source: existing.source || "update_global_context",
          evidence: existing.evidence || "",
          createdAt: existing.createdAt || new Date().toISOString(),
          updatedAt: existing.updatedAt || new Date().toISOString(),
        });
      }
    }
    for (const e of entries) {
      const prev = mergedByText.get(e.text);
      if (!prev || e.priority === "must" || prev.priority !== "must") {
        mergedByText.set(e.text, {
          text: e.text,
          summary: e.summary || e.text,
          decision: e.decision || "",
          rationale: e.rationale || "",
          priority: e.priority,
          topic: e.topic,
          confidence: e.confidence || "medium",
          owner: e.owner || "",
          status: e.status || "draft",
          source: e.source || "update_global_context",
          evidence: e.evidence || "",
          createdAt: e.createdAt || new Date().toISOString(),
          updatedAt: e.updated_at || e.updatedAt || new Date().toISOString(),
        });
      }
    }
    finalEntries = [...mergedByText.values()].map((e, idx) => ({
      id: `append-${Date.now()}-${idx}`,
      text: e.text,
      summary: e.summary || e.text,
      decision: e.decision || "",
      rationale: e.rationale || "",
      priority: e.priority,
      topic: e.topic,
      confidence: e.confidence || "medium",
      owner: e.owner || "",
      status: e.status || "draft",
      createdAt: e.createdAt || new Date().toISOString(),
      updatedAt: e.updated_at || e.updatedAt || new Date().toISOString(),
      source: e.source || "update_global_context",
      evidence: e.evidence || "",
    }));
  }
  const persisted = writeGlobalEntries(finalEntries);
  invalidateGlobalContextCache();

  const headers = ["status", "path", "mode", "count", "manifest"];
  const rows = [["ok", globalPath, mode, persisted.entries.length, getGlobalManifestPath()]];
  return formatToon(headers, rows);
}

module.exports = { toolUpdateGlobalContext };
