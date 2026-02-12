"use strict";

const path = require("path");
const { formatToon } = require("../utils/toon");
const { findWhoCalls, findWhatCalls, findSymbol, updateStructuralIndex } = require("../utils/structural_index");
const { ensureProjectDirs } = require("../utils/paths");
const { writeFileEnsureDir } = require("../utils/fs_utils");
const { formatEvidenceLevel } = require("../utils/evidence_level");
const { appendTelemetry } = require("../utils/telemetry");

async function toolQueryStructure(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "query_structure_root", { root: cwd });

  const mode = args.mode || "who_calls";
  const target = args.target || "";
  const maxResults = Number(args.max_results || 50);
  const contextPack = args.context_pack || "default";
  const evidenceLevel = args.evidence_level || "standard";

  const index = updateStructuralIndex(cwd);
  const projectPaths = ensureProjectDirs(cwd);
  writeFileEnsureDir(path.join(projectPaths.cache, "structural_index.json"), JSON.stringify(index, null, 2));

  if (mode === "who_calls") {
    const rows = findWhoCalls(cwd, target, maxResults).map((r) => [
      r.callee,
      r.caller,
      r.file,
      formatEvidenceLevel(r.evidence, evidenceLevel),
    ]);
    appendTelemetry(cwd, "query_structure", { mode, target, context_pack: contextPack, evidence_level: evidenceLevel, results: rows.length, latency_ms: Date.now() - started });
    rows.unshift(["meta", `context_pack=${contextPack}`, "", `results=${rows.length}`]);
    rows.unshift(["meta", `evidence_level=${evidenceLevel}`, "", ""]);
    return formatToon(["symbol", "called_by", "file", "evidence"], rows);
  }

  if (mode === "what_calls") {
    const rows = findWhatCalls(cwd, target, maxResults).map((r) => [
      r.caller,
      r.callee,
      r.file,
      formatEvidenceLevel(r.evidence, evidenceLevel),
    ]);
    appendTelemetry(cwd, "query_structure", { mode, target, context_pack: contextPack, evidence_level: evidenceLevel, results: rows.length, latency_ms: Date.now() - started });
    rows.unshift(["meta", `context_pack=${contextPack}`, "", `results=${rows.length}`]);
    rows.unshift(["meta", `evidence_level=${evidenceLevel}`, "", ""]);
    return formatToon(["caller", "calls", "file", "evidence"], rows);
  }

  const rows = findSymbol(cwd, target, maxResults).map((r) => [
    r.name,
    r.type,
    r.file,
    formatEvidenceLevel(r.evidence, evidenceLevel),
  ]);
  appendTelemetry(cwd, "query_structure", { mode, target, context_pack: contextPack, evidence_level: evidenceLevel, results: rows.length, latency_ms: Date.now() - started });
  rows.unshift(["meta", `context_pack=${contextPack}`, "", `results=${rows.length}`]);
  rows.unshift(["meta", `evidence_level=${evidenceLevel}`, "", ""]);
  return formatToon(["symbol", "type", "file", "evidence"], rows);
}

module.exports = { toolQueryStructure };
