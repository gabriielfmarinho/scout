"use strict";

const { formatToon } = require("../utils/toon");
const { searchProjectHybrid } = require("../utils/search");
const { findWhoCalls, findSymbol } = require("../utils/structural_index");
const { applyContextBudget, contextPackDefaults } = require("../utils/context_budget");
const { mapEvidenceLevel } = require("../utils/evidence_level");
const { appendTelemetry } = require("../utils/telemetry");
const { upsertProjectSpecialistEntries, normalizeTopicName } = require("../utils/specialized_context");

function riskFromScore(score) {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

async function toolAnalyzeImpact(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "analyze_impact_root", { root: cwd });
  const target = args.target;
  const persistToContext = args.persist_to_context === true;
  const persistTopic = normalizeTopicName(args.persist_topic || "flows", "flows");
  const max_results = Number(args.max_results || 50);
  const contextPack = args.context_pack || "default";
  const evidenceLevel = args.evidence_level || "standard";
  const pack = contextPackDefaults(contextPack);

  const structHits = findWhoCalls(cwd, target, max_results).map((h) => ({
    file: h.file,
    impact: "call-graph reference",
    risk: "high",
    evidence: h.evidence,
    score: 10,
  }));
  const symbolHits = findSymbol(cwd, target, max_results).map((h) => ({
    file: h.file,
    impact: "symbol definition",
    risk: "medium",
    evidence: h.evidence,
    score: 8,
  }));
  const lexicalHits = searchProjectHybrid({ cwd, query: target, max_results, max_snippet_lines: 6 }).map((hit) => ({
    file: hit.file,
    impact: "textual reference",
    risk: riskFromScore(hit.score),
    evidence: hit.evidence,
    score: Number(hit.score) || 0,
  }));

  const merged = [...structHits, ...symbolHits, ...lexicalHits].sort((a, b) => b.score - a.score);
  const budgeted = applyContextBudget(merged, {
    maxItems: Number(args.max_budget_items || pack.maxItems),
    maxChars: Number(args.max_context_chars || pack.maxChars),
    maxPerFile: Number(args.max_per_file || pack.maxPerFile),
  });
  const finalItems = mapEvidenceLevel(budgeted.items, evidenceLevel);

  if (persistToContext && finalItems.length) {
    const entries = finalItems.map((hit) => ({
      topic: persistTopic,
      text: `${target}: ${hit.impact} (${hit.risk}) -> ${hit.file || "unknown file"}`,
      summary: `${target}: ${hit.impact} (${hit.risk}) -> ${hit.file || "unknown file"}`,
      rationale: `Impact analysis for '${target}' identified ${hit.impact} with ${hit.risk} risk.`,
      confidence: hit.risk === "high" ? "high" : "medium",
      owner: "scout",
      status: "reviewed",
      priority: hit.risk === "high" ? "must" : "prefer",
      source: "analysis_impact",
      evidence: hit.evidence || "",
    }));
    upsertProjectSpecialistEntries(cwd, entries, "append");
  }

  const rows = finalItems.map((hit) => [
    hit.file,
    hit.impact,
    hit.risk,
    hit.evidence,
  ]);
  rows.unshift(["meta", `context_pack=${contextPack}`, "info", `results=${finalItems.length}`]);
  rows.unshift(["meta", `evidence_level=${evidenceLevel}`, "info", ""]);
  if (budgeted.truncated) {
    rows.unshift(["meta", "context_budget_truncated", "info", `kept=${finalItems.length} total=${budgeted.originalCount}`]);
  }
  appendTelemetry(cwd, "analyze_impact", {
    target,
    persist_to_context: persistToContext,
    persist_topic: persistTopic,
    context_pack: contextPack,
    evidence_level: evidenceLevel,
    items_before_budget: merged.length,
    items_after_budget: finalItems.length,
    truncated: budgeted.truncated,
    truncation_rate: budgeted.originalCount > 0 ? Number(((budgeted.originalCount - finalItems.length) / budgeted.originalCount).toFixed(4)) : 0,
    latency_ms: Date.now() - started,
  });

  const headers = ["component", "impact", "risk", "evidence"];
  return formatToon(headers, rows);
}

module.exports = { toolAnalyzeImpact };
