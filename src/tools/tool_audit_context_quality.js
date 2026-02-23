"use strict";

const { formatToon } = require("../utils/toon");
const { ensureProjectDirs } = require("../utils/paths");
const { loadAllSpecialistItems } = require("../utils/specialized_context");
const { loadAllGlobalEntries } = require("../utils/global_specialized_context");
const { computeQuality } = require("../utils/context_quality");
const { appendTelemetry } = require("../utils/telemetry");

function findIssues(item) {
  const q = computeQuality(item);
  return { score: q.score, issues: q.issues };
}

function contradictionSignals(text) {
  const raw = String(text || "").toLowerCase().trim();
  if (!raw) return null;
  const neg = /^(do not|don't|never|avoid|no)\b/.test(raw);
  const key = raw
    .replace(/^(do not|don't|never|avoid|no|must|should|always)\s+/, "")
    .replace(/[^\w\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!key) return null;
  return { key, neg };
}

async function toolAuditContextQuality(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "audit_context_quality_root", { root: cwd });

  const scope = String(args.scope || "all").toLowerCase();
  const minQuality = Number(args.min_quality || 70);
  const maxResults = Number(args.max_results || 200);

  const rows = [];
  if (scope === "all" || scope === "project") {
    const projectPaths = ensureProjectDirs(cwd);
    const projectData = loadAllSpecialistItems(projectPaths);
    for (const [topic, items] of Object.entries(projectData.byTopic || {})) {
      for (const item of items || []) {
        const q = findIssues(item);
        if (q.score >= minQuality) continue;
        rows.push([
          "project",
          topic,
          String(q.score),
          item.status || "",
          q.issues.join(", ") || "low_quality",
          item.evidence || "",
        ]);
      }
    }
  }

  if (scope === "all" || scope === "global") {
    const globalItems = loadAllGlobalEntries();
    for (const item of globalItems) {
      const q = findIssues(item);
      if (q.score >= minQuality) continue;
      rows.push([
        "global",
        item.topic || "general",
        String(q.score),
        item.status || "",
        q.issues.join(", ") || "low_quality",
        item.evidence || "",
      ]);
    }
  }

  const contradictionMap = new Map();
  function addContr(scopeName, topic, text, evidence) {
    const sig = contradictionSignals(text);
    if (!sig) return;
    const key = `${scopeName}|${topic}|${sig.key}`;
    const cur = contradictionMap.get(key) || { pos: null, neg: null };
    if (sig.neg) cur.neg = cur.neg || { text, evidence };
    else cur.pos = cur.pos || { text, evidence };
    contradictionMap.set(key, cur);
  }
  if (scope === "all" || scope === "project") {
    const projectPaths = ensureProjectDirs(cwd);
    const projectData = loadAllSpecialistItems(projectPaths);
    for (const [topic, items] of Object.entries(projectData.byTopic || {})) {
      for (const item of items || []) addContr("project", topic, item.text, item.evidence || "");
    }
  }
  if (scope === "all" || scope === "global") {
    for (const item of loadAllGlobalEntries()) addContr("global", item.topic || "general", item.text, item.evidence || "");
  }
  for (const [k, v] of contradictionMap.entries()) {
    if (!v.pos || !v.neg) continue;
    const [scopeName, topic] = k.split("|");
    rows.push([
      scopeName,
      topic,
      "0",
      "reviewed",
      "contradiction_detected",
      `${v.pos.evidence} || ${v.neg.evidence}`,
    ]);
  }

  rows.sort((a, b) => Number(a[2]) - Number(b[2]));
  const limited = rows.slice(0, maxResults);
  limited.unshift(["meta", scope, "", "", `min_quality=${minQuality}`, `results=${Math.max(0, limited.length - 1)}`]);

  appendTelemetry(cwd, "audit_context_quality", {
    scope,
    min_quality: minQuality,
    results: Math.max(0, limited.length - 1),
    latency_ms: Date.now() - started,
  });

  return formatToon(["scope", "topic", "quality", "status", "issues", "evidence"], limited);
}

module.exports = { toolAuditContextQuality };
