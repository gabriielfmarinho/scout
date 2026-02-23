"use strict";

const path = require("path");
const { formatToon } = require("../utils/toon");
const { findWhoCalls, findWhatCalls, findSymbol, updateStructuralIndex } = require("../utils/structural_index");
const { ensureProjectDirs } = require("../utils/paths");
const { writeFileEnsureDir } = require("../utils/fs_utils");
const { formatEvidenceLevel } = require("../utils/evidence_level");
const { appendTelemetry } = require("../utils/telemetry");
const { upsertProjectSpecialistEntries, normalizeTopicName } = require("../utils/specialized_context");

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
  const persistToContext = args.persist_to_context === true;
  const persistTopic = normalizeTopicName(args.persist_topic || "flows", "flows");

  const index = updateStructuralIndex(cwd);
  const projectPaths = ensureProjectDirs(cwd);
  writeFileEnsureDir(path.join(projectPaths.cache, "structural_index.json"), JSON.stringify(index, null, 2));

  if (mode === "who_calls") {
    const hits = findWhoCalls(cwd, target, maxResults);
    const rows = hits.map((r) => [
      r.callee,
      r.caller,
      r.file,
      formatEvidenceLevel(r.evidence, evidenceLevel),
    ]);
    if (persistToContext && hits.length) {
      const entries = hits.map((r) => ({
        topic: persistTopic,
        text: `who_calls ${r.callee}: ${r.caller} (${r.file})`,
        summary: `who_calls ${r.callee}: ${r.caller} (${r.file})`,
        rationale: `Structural query who_calls for '${target}' found caller '${r.caller}'.`,
        confidence: "high",
        owner: "scout",
        status: "reviewed",
        priority: "prefer",
        source: "query_structure",
        evidence: r.evidence || "",
      }));
      upsertProjectSpecialistEntries(cwd, entries, "append");
    }
    appendTelemetry(cwd, "query_structure", {
      mode,
      target,
      persist_to_context: persistToContext,
      persist_topic: persistTopic,
      context_pack: contextPack,
      evidence_level: evidenceLevel,
      results: rows.length,
      latency_ms: Date.now() - started,
    });
    rows.unshift(["meta", `context_pack=${contextPack}`, "", `results=${rows.length}`]);
    rows.unshift(["meta", `evidence_level=${evidenceLevel}`, "", ""]);
    return formatToon(["symbol", "called_by", "file", "evidence"], rows);
  }

  if (mode === "what_calls") {
    const hits = findWhatCalls(cwd, target, maxResults);
    const rows = hits.map((r) => [
      r.caller,
      r.callee,
      r.file,
      formatEvidenceLevel(r.evidence, evidenceLevel),
    ]);
    if (persistToContext && hits.length) {
      const entries = hits.map((r) => ({
        topic: persistTopic,
        text: `what_calls ${r.caller}: ${r.callee} (${r.file})`,
        summary: `what_calls ${r.caller}: ${r.callee} (${r.file})`,
        rationale: `Structural query what_calls for '${target}' found callee '${r.callee}'.`,
        confidence: "high",
        owner: "scout",
        status: "reviewed",
        priority: "prefer",
        source: "query_structure",
        evidence: r.evidence || "",
      }));
      upsertProjectSpecialistEntries(cwd, entries, "append");
    }
    appendTelemetry(cwd, "query_structure", {
      mode,
      target,
      persist_to_context: persistToContext,
      persist_topic: persistTopic,
      context_pack: contextPack,
      evidence_level: evidenceLevel,
      results: rows.length,
      latency_ms: Date.now() - started,
    });
    rows.unshift(["meta", `context_pack=${contextPack}`, "", `results=${rows.length}`]);
    rows.unshift(["meta", `evidence_level=${evidenceLevel}`, "", ""]);
    return formatToon(["caller", "calls", "file", "evidence"], rows);
  }

  const hits = findSymbol(cwd, target, maxResults);
  const rows = hits.map((r) => [
    r.name,
    r.type,
    r.file,
    formatEvidenceLevel(r.evidence, evidenceLevel),
  ]);
  if (persistToContext && hits.length) {
    const entries = hits.map((r) => ({
      topic: persistTopic,
      text: `find_symbol ${r.name}: ${r.type} (${r.file})`,
      summary: `find_symbol ${r.name}: ${r.type} (${r.file})`,
      rationale: `Structural symbol lookup for '${target}' matched a ${r.type} definition.`,
      confidence: "high",
      owner: "scout",
      status: "reviewed",
      priority: "prefer",
      source: "query_structure",
      evidence: r.evidence || "",
    }));
    upsertProjectSpecialistEntries(cwd, entries, "append");
  }
  appendTelemetry(cwd, "query_structure", {
    mode,
    target,
    persist_to_context: persistToContext,
    persist_topic: persistTopic,
    context_pack: contextPack,
    evidence_level: evidenceLevel,
    results: rows.length,
    latency_ms: Date.now() - started,
  });
  rows.unshift(["meta", `context_pack=${contextPack}`, "", `results=${rows.length}`]);
  rows.unshift(["meta", `evidence_level=${evidenceLevel}`, "", ""]);
  return formatToon(["symbol", "type", "file", "evidence"], rows);
}

module.exports = { toolQueryStructure };
