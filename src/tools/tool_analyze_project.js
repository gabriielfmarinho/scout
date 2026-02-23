"use strict";

const path = require("path");
const { ensureProjectDirs } = require("../utils/paths");
const { writeFileEnsureDir, readFileSafe } = require("../utils/fs_utils");
const {
  createProjectIntelligence,
  deriveFingerprint,
  renderArchitectureMarkdown,
} = require("../utils/project_intelligence");
const { parseJsonl, writeSpecialistContext } = require("../utils/specialized_context");
const { appendTelemetry } = require("../utils/telemetry");

async function toolAnalyzeProject(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "analyze_project_root", { root: cwd });
  const projectPaths = ensureProjectDirs(cwd);
  const brief = createProjectIntelligence(cwd, { context_pack: "default" });
  const fingerprint = deriveFingerprint(brief);

  const fingerprintPath = path.join(projectPaths.cache, "fingerprint.json");
  writeFileEnsureDir(fingerprintPath, JSON.stringify(fingerprint, null, 2));
  const structuralPath = path.join(projectPaths.cache, "structural_index.json");
  const structuralRaw = readFileSafe(structuralPath);
  if (!structuralRaw) {
    writeFileEnsureDir(structuralPath, JSON.stringify({
      version: 1,
      root: cwd,
      files: {},
      symbols: [],
      calls: [],
      references: [],
      updatedAt: new Date().toISOString(),
    }, null, 2));
  }
  const briefJsonPath = path.join(projectPaths.cache, "project_brief.json");
  writeFileEnsureDir(briefJsonPath, JSON.stringify(brief, null, 2));

  const architecturePath = path.join(projectPaths.docs, "architecture.md");
  writeFileEnsureDir(architecturePath, renderArchitectureMarkdown(brief));
  const devlogPath = path.join(projectPaths.devlog, "timeline.jsonl");
  const devlogItems = parseJsonl(readFileSafe(devlogPath) || "");
  const specialist = writeSpecialistContext(cwd, brief, devlogItems);

  const out = [];
  out.push("# Project Analysis");
  out.push("");
  out.push(`Languages: ${(brief.summary.languages || []).join(", ") || "unknown"}`);
  out.push(`Build tools: ${(brief.summary.buildTools || []).join(", ") || "unknown"}`);
  out.push(`Frameworks: ${(brief.summary.frameworks || []).join(", ") || "unknown"}`);
  out.push(`Infra: ${(brief.summary.infra || []).join(", ") || "none detected"}`);
  out.push(`CI/CD: ${(brief.summary.ci || []).join(", ") || "none detected"}`);
  out.push(`Data: ${(brief.summary.data || []).join(", ") || "none detected"}`);
  out.push(`Tests: ${(brief.summary.test || []).join(", ") || "none detected"}`);
  out.push(`Monorepo: ${(brief.summary.monorepo || []).join(", ") || "none detected"}`);
  out.push(`Architecture hints: ${(brief.summary.architectureHints || []).join(", ") || "none detected"}`);
  out.push(`Structural index: symbols=${brief.summary.symbols || 0} calls=${brief.summary.calls || 0} refs=${brief.summary.references || 0}`);

  if ((brief.evidence || []).length) {
    out.push("");
    out.push("Evidence references:");
    for (const item of brief.evidence) {
      out.push(`- ${item.topic}=${item.value} (${item.confidence}): ${item.evidence}`);
    }
  }

  out.push("");
  out.push(`Persisted: ${fingerprintPath}`);
  out.push(`Persisted: ${architecturePath}`);
  out.push(`Persisted: ${structuralPath}`);
  out.push(`Persisted: ${briefJsonPath}`);
  out.push(`Persisted: ${specialist.manifestPath}`);
  out.push(`Persisted: ${specialist.activePath}`);
  appendTelemetry(cwd, "analyze_project", {
    quick: Boolean(args.quick),
    summary: brief.summary,
    incremental: brief.incremental || null,
    latency_ms: Date.now() - started,
  });

  return out.join("\n");
}

module.exports = { toolAnalyzeProject };
