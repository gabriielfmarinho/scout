"use strict";

const path = require("path");
const { ensureProjectDirs } = require("../utils/paths");
const { writeFileEnsureDir, readFileSafe } = require("../utils/fs_utils");
const { getCoreFilePath } = require("../utils/cache_files");
const {
  createProjectIntelligence,
  deriveFingerprint,
  renderArchitectureMarkdown,
} = require("../utils/project_intelligence");
const { parseJsonl, writeSpecialistContext } = require("../utils/specialized_context");
const { appendTelemetry } = require("../utils/telemetry");

async function toolGenerateProjectBrief(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "generate_project_brief_root", { root: cwd });
  const contextPack = args.context_pack || "default";

  const intelligence = createProjectIntelligence(cwd, { context_pack: contextPack });
  const projectPaths = ensureProjectDirs(cwd);

  const briefJsonPath = getCoreFilePath(projectPaths, "project_brief.json");
  writeFileEnsureDir(briefJsonPath, JSON.stringify(intelligence, null, 2));
  const fingerprintPath = getCoreFilePath(projectPaths, "fingerprint.json");
  writeFileEnsureDir(fingerprintPath, JSON.stringify(deriveFingerprint(intelligence), null, 2));
  const devlogPath = path.join(projectPaths.devlog, "timeline.jsonl");
  const devlogItems = parseJsonl(readFileSafe(devlogPath) || "");
  const specialist = writeSpecialistContext(cwd, intelligence, devlogItems);
  const architecturePath = path.join(projectPaths.docs, "specialists", "architecture.md");
  writeFileEnsureDir(architecturePath, renderArchitectureMarkdown(intelligence));

  const out = [];
  out.push("# Project Brief Generated");
  out.push("");
  out.push("- Summary generated with evidence-first items.");
  out.push("- Use query_structure for who-calls/what-calls drill-down.");
  out.push("");
  out.push(`Persisted: ${briefJsonPath}`);
  out.push(`Persisted: ${fingerprintPath} (derived)`);
  out.push(`Persisted: ${architecturePath} (specialist doc)`);
  out.push(`Persisted: ${specialist.manifestPath} (progressive disclosure index)`);
  out.push(`Persisted: ${specialist.activePath} (project brief router)`);
  appendTelemetry(cwd, "generate_project_brief", {
    context_pack: contextPack,
    flows: intelligence.flows.length,
    integrations: intelligence.integrations.length,
    runtime_configs: intelligence.runtimeConfigs.length,
    conventions: intelligence.conventions.length,
    hotspots: intelligence.hotspots.length,
    incremental: intelligence.incremental || null,
    latency_ms: Date.now() - started,
  });
  return out.join("\n");
}

module.exports = { toolGenerateProjectBrief };
