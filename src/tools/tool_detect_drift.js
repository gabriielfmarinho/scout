"use strict";

const path = require("path");
const { ensureProjectDirs } = require("../utils/paths");
const { readFileSafe } = require("../utils/fs_utils");
const { searchProject } = require("../utils/search");
const { formatToon } = require("../utils/toon");
const { applyContextBudget, contextPackDefaults } = require("../utils/context_budget");
const { formatEvidenceLevel } = require("../utils/evidence_level");
const { appendTelemetry } = require("../utils/telemetry");

function extractForbiddenRules(lines) {
  const rules = [];
  for (const line of lines) {
    const text = line.trim().replace(/^[-*]\s*/, "");
    const lower = text.toLowerCase();
    const patterns = ["no ", "avoid ", "do not ", "don't "];
    for (const p of patterns) {
      const idx = lower.indexOf(p);
      if (idx >= 0) {
        const term = text.slice(idx + p.length).split(/[\.,;]/)[0].trim();
        if (term) rules.push({ rule: text, term });
      }
    }
  }
  return rules;
}

async function toolDetectDrift(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "detect_drift_root", { root: cwd });
  const projectPaths = ensureProjectDirs(cwd);
  const max_results = Number(args.max_results || 50);
  const contextPack = args.context_pack || "default";
  const evidenceLevel = args.evidence_level || "standard";
  const pack = contextPackDefaults(contextPack);

  const activePath = path.join(projectPaths.docs, "active-context.md");
  const content = readFileSafe(activePath);
  if (!content) {
    return formatToon(
      ["rule", "deviation", "file", "severity", "evidence"],
      [["active-context.md missing", "No rules to evaluate", "", "low", "docs/active-context.md not found"]]
    );
  }

  const lines = content.split(/\r?\n/).filter((l) => l.trim().startsWith("-"));
  const rules = extractForbiddenRules(lines);

  const rows = [];
  for (const rule of rules) {
    const hits = searchProject({ cwd, query: rule.term, max_results: 5, max_snippet_lines: 4 });
    for (const hit of hits) {
      rows.push([
        rule.rule,
        `Found usage of ${rule.term}`,
        hit.file,
        "medium",
        hit.evidence,
      ]);
    }
  }

  const budgeted = applyContextBudget(
    rows.map((r) => ({ rule: r[0], deviation: r[1], file: r[2], severity: r[3], evidence: r[4] })),
    {
      maxItems: Math.min(max_results, Number(args.max_budget_items || pack.maxItems)),
      maxChars: Number(args.max_context_chars || pack.maxChars),
      maxPerFile: Number(args.max_per_file || pack.maxPerFile),
    }
  );
  const limited = budgeted.items.map((r) => [r.rule, r.deviation, r.file, r.severity, formatEvidenceLevel(r.evidence, evidenceLevel)]);
  limited.unshift(["meta", `context_pack=${contextPack}`, "", "low", `results=${limited.length}`]);
  limited.unshift(["meta", `evidence_level=${evidenceLevel}`, "", "low", ""]);
  if (budgeted.truncated) {
    limited.unshift(["meta", "context_budget_truncated", "", "low", `kept=${budgeted.items.length} total=${budgeted.originalCount}`]);
  }
  appendTelemetry(cwd, "detect_drift", {
    context_pack: contextPack,
    evidence_level: evidenceLevel,
    items_before_budget: rows.length,
    items_after_budget: budgeted.items.length,
    truncated: budgeted.truncated,
    truncation_rate: budgeted.originalCount > 0 ? Number(((budgeted.originalCount - budgeted.items.length) / budgeted.originalCount).toFixed(4)) : 0,
    latency_ms: Date.now() - started,
  });
  const headers = ["rule", "deviation", "file", "severity", "evidence"];
  return formatToon(headers, limited);
}

module.exports = { toolDetectDrift };
