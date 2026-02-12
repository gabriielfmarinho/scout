"use strict";

const { formatToon } = require("../utils/toon");
const { searchProject, searchProjectHybrid } = require("../utils/search");
const { applyContextBudget, contextPackDefaults } = require("../utils/context_budget");
const { mapEvidenceLevel } = require("../utils/evidence_level");
const { appendTelemetry } = require("../utils/telemetry");

async function toolSearchProject(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const cwd = resolveProjectRoot();
  const { log } = require("../utils/logger");
  log("info", "search_project_root", { root: cwd });
  const query = args.query;
  const mode = args.mode || "keyword";
  const max_results = Number(args.max_results || 50);
  const max_snippet_lines = Number(args.max_snippet_lines || 8);
  const max_files = Number(args.max_files || 2000);
  const max_file_bytes = Number(args.max_file_bytes || 524288);
  const max_ms = Number(args.max_ms || 20000);
  const contextPack = args.context_pack || "default";
  const evidenceLevel = args.evidence_level || "standard";
  const pack = contextPackDefaults(contextPack);

  const results = mode === "hybrid"
    ? searchProjectHybrid({ cwd, query, max_results, max_snippet_lines, max_files, max_file_bytes, max_ms })
    : searchProject({ cwd, query, max_results, max_snippet_lines, max_files, max_file_bytes, max_ms });

  const budgeted = applyContextBudget(results, {
    maxItems: Number(args.max_budget_items || pack.maxItems),
    maxChars: Number(args.max_context_chars || pack.maxChars),
    maxPerFile: Number(args.max_per_file || pack.maxPerFile),
  });
  const finalItems = mapEvidenceLevel(budgeted.items, evidenceLevel);

  const headers = ["file", "symbol_or_section", "score", "reason", "evidence"];
  const rows = finalItems.map((r) => [r.file, r.symbol_or_section, r.score, r.reason, r.evidence]);
  rows.unshift(["", "meta", 0, "context_pack", contextPack]);
  rows.unshift(["", "meta", 0, "evidence_level", evidenceLevel]);
  if (budgeted.truncated) {
    rows.unshift(["", "meta", 0, "context_budget_truncated", `kept=${finalItems.length} total=${budgeted.originalCount}`]);
  }
  appendTelemetry(cwd, "search_project", {
    query,
    mode,
    context_pack: contextPack,
    evidence_level: evidenceLevel,
    items_before_budget: results.length,
    items_after_budget: finalItems.length,
    truncated: budgeted.truncated,
    truncation_rate: budgeted.originalCount > 0 ? Number(((budgeted.originalCount - finalItems.length) / budgeted.originalCount).toFixed(4)) : 0,
    latency_ms: Date.now() - started,
  });
  return formatToon(headers, rows);
}

module.exports = { toolSearchProject };
