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

function list(items, key) {
  if (!items || !items.length) return ["- none detected"];
  return items.slice(0, 20).map((i) => `- ${i[key]} (${i.evidence})`);
}

async function toolGenerateProjectBrief(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "generate_project_brief_root", { root: cwd });
  const contextPack = args.context_pack || "default";

  const intelligence = createProjectIntelligence(cwd, { context_pack: contextPack });
  const projectPaths = ensureProjectDirs(cwd);

  const briefJsonPath = path.join(projectPaths.cache, "project_brief.json");
  writeFileEnsureDir(briefJsonPath, JSON.stringify(intelligence, null, 2));
  const fingerprintPath = path.join(projectPaths.cache, "fingerprint.json");
  writeFileEnsureDir(fingerprintPath, JSON.stringify(deriveFingerprint(intelligence), null, 2));
  const architecturePath = path.join(projectPaths.docs, "architecture.md");
  writeFileEnsureDir(architecturePath, renderArchitectureMarkdown(intelligence));
  const devlogPath = path.join(projectPaths.devlog, "timeline.jsonl");
  const devlogItems = parseJsonl(readFileSafe(devlogPath) || "");
  const specialist = writeSpecialistContext(cwd, intelligence, devlogItems);

  const md = [];
  md.push("# Project Brief");
  md.push("");
  md.push(`Generated at: ${intelligence.generatedAt}`);
  md.push(`Context pack: ${contextPack}`);
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`- Languages: ${(intelligence.summary.languages || []).join(", ") || "unknown"}`);
  md.push(`- Frameworks: ${(intelligence.summary.frameworks || []).join(", ") || "unknown"}`);
  md.push(`- Architecture hints: ${(intelligence.summary.architectureHints || []).join(", ") || "none"}`);
  md.push(`- Structural index: symbols=${intelligence.summary.symbols} calls=${intelligence.summary.calls} refs=${intelligence.summary.references}`);
  md.push("");
  md.push("## Critical Flows");
  md.push("");
  md.push(...list(intelligence.flows, "name"));
  md.push("");
  md.push("## External Integrations");
  md.push("");
  md.push(...list(intelligence.integrations, "integration"));
  md.push("");
  md.push("## Runtime Config");
  md.push("");
  md.push(...list(intelligence.runtimeConfigs, "value"));
  md.push("");
  md.push("## Conventions");
  md.push("");
  md.push(...list(intelligence.conventions, "convention"));
  md.push("");
  md.push("## Hotspots and Risks");
  md.push("");
  if (!intelligence.hotspots.length) {
    md.push("- none detected");
  } else {
    for (const h of intelligence.hotspots.slice(0, 25)) {
      md.push(`- [${h.risk}] ${h.reason} (${h.evidence})`);
    }
  }

  const briefMdPath = path.join(projectPaths.docs, "project-brief.md");
  writeFileEnsureDir(briefMdPath, md.join("\n") + "\n");

  const out = [];
  out.push("# Project Brief Generated");
  out.push("");
  out.push("- Summary generated with evidence-first items.");
  out.push("- Use query_structure for who-calls/what-calls drill-down.");
  out.push("");
  out.push(`Persisted: ${briefJsonPath}`);
  out.push(`Persisted: ${briefMdPath}`);
  out.push(`Persisted: ${fingerprintPath} (derived)`);
  out.push(`Persisted: ${architecturePath} (derived)`);
  out.push(`Persisted: ${specialist.manifestPath} (progressive disclosure index)`);
  out.push(`Persisted: ${specialist.activePath} (topic router)`);
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
