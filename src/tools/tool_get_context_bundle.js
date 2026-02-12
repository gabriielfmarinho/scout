"use strict";

const path = require("path");
const { ensureProjectDirs } = require("../utils/paths");
const { readFileSafe, fileExists } = require("../utils/fs_utils");
const { analyzeProject } = require("../utils/analyze");
const { snippetWithLines, formatEvidence } = require("../utils/snippet");
const { writeFileEnsureDir } = require("../utils/fs_utils");
const { applyContextBudget, contextPackDefaults } = require("../utils/context_budget");
const { formatEvidenceLevel } = require("../utils/evidence_level");
const { appendTelemetry } = require("../utils/telemetry");
const { loadGlobalContextCached } = require("../utils/global_context_cache");

function loadActiveContext(docsPath) {
  const filePath = path.join(docsPath, "active-context.md");
  const content = readFileSafe(filePath);
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("-")) {
      const snippet = snippetWithLines(filePath, i + 1, i + 1);
      items.push({
        text: line.replace(/^\s*-\s*/, ""),
        evidence: formatEvidence(filePath, snippet.start, snippet.end, snippet.text),
      });
    }
  }
  return items;
}

async function toolGetContextBundle(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "get_context_bundle_root", { root: cwd });
  const projectPaths = ensureProjectDirs(cwd);
  const maxItems = Number(args.max_items || 50);
  const contextPack = args.context_pack || "default";
  const evidenceLevel = args.evidence_level || "standard";
  const includePreferential = args.include_preferential !== false;
  const pack = contextPackDefaults(contextPack);

  const fingerprintPath = path.join(projectPaths.cache, "fingerprint.json");
  if (!fileExists(fingerprintPath)) {
    const analysis = analyzeProject(cwd, true);
    writeFileEnsureDir(fingerprintPath, JSON.stringify(analysis, null, 2));
  }

  let items = loadActiveContext(projectPaths.docs);
  if (!items) {
    const fallback = [
      "No active-context.md found. Use analyze_project to generate architecture summary and then compress_context to create active context.",
    ];
    const fallbackPath = path.join(projectPaths.docs, "active-context.md");
    writeFileEnsureDir(fallbackPath, fallback.map((l) => `- ${l}`).join("\n") + "\n");
    items = loadActiveContext(projectPaths.docs) || [];
  }

  const globalItems = loadGlobalContextCached(false);
  const mandatoryGlobal = globalItems.filter((g) => g.priority === "must");
  const preferredGlobal = globalItems.filter((g) => g.priority !== "must");
  const combined = [
    ...(includePreferential ? preferredGlobal : []),
    ...items,
  ];
  const budgeted = applyContextBudget(
    combined.map((i) => ({ ...i, evidence: i.evidence })),
    {
      maxItems: Math.min(maxItems, Number(args.max_budget_items || pack.maxItems)),
      maxChars: Number(args.max_context_chars || pack.maxChars),
      maxPerFile: Number(args.max_per_file || pack.maxPerFile),
    }
  );
  const limited = [...mandatoryGlobal, ...budgeted.items];
  const lines = [];
  lines.push("# Context Bundle");
  lines.push("");
  lines.push(`- meta: context_pack=${contextPack}`);
  lines.push(`- meta: evidence_level=${evidenceLevel}`);
  lines.push(`- meta: include_preferential=${includePreferential}`);
  lines.push(`- meta: mandatory_global_count=${mandatoryGlobal.length}`);
  if (budgeted.truncated) {
    lines.push(`- meta: context budget truncated kept=${limited.length} total=${budgeted.originalCount + mandatoryGlobal.length}`);
  }
  for (const item of limited) {
    const prefix = item.priority === "must" ? "[must] " : "";
    lines.push(`- ${prefix}${item.text}`);
    lines.push(`  Evidence: ${formatEvidenceLevel(item.evidence, evidenceLevel)}`);
  }
  appendTelemetry(cwd, "get_context_bundle", {
    context_pack: contextPack,
    evidence_level: evidenceLevel,
    items_before_budget: combined.length + mandatoryGlobal.length,
    items_after_budget: limited.length,
    include_preferential: includePreferential,
    mandatory_global_count: mandatoryGlobal.length,
    truncated: budgeted.truncated,
    truncation_rate: budgeted.originalCount > 0 ? Number(((budgeted.originalCount - budgeted.items.length) / budgeted.originalCount).toFixed(4)) : 0,
    latency_ms: Date.now() - started,
  });

  return lines.join("\n");
}

module.exports = { toolGetContextBundle };
