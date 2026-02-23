"use strict";

const path = require("path");
const fs = require("fs");
const { updateIndex } = require("./index_cache");
const { readFileSafe, writeFileEnsureDir } = require("./fs_utils");
const { formatEvidence } = require("./snippet");
const { analyzeProject } = require("./analyze");
const { updateStructuralIndex } = require("./structural_index");
const { ensureProjectDirs } = require("./paths");

const MAX_FILE_BYTES = 1024 * 1024;
const INTEL_CACHE_VERSION = 1;
const NON_SIGNAL_RE = /^(unknown|none detected|n\/a|na|not identified|nao identificado|não identificado)$/i;

function rel(cwd, filePath) {
  return path.relative(cwd, filePath) || filePath;
}

function lineEvidence(cwd, filePath, lineNum, line) {
  return formatEvidence(rel(cwd, filePath), lineNum, lineNum, (line || "").trim());
}

function getIntelCachePath(cwd) {
  const projectPaths = ensureProjectDirs(cwd);
  return path.join(projectPaths.cache, "project_intelligence_files.json");
}

function loadIntelCache(cwd) {
  const raw = readFileSafe(getIntelCachePath(cwd));
  if (!raw) {
    return { version: INTEL_CACHE_VERSION, files: {}, updatedAt: new Date().toISOString() };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.files && typeof parsed.files === "object") return parsed;
  } catch {
    // ignore invalid cache
  }
  return { version: INTEL_CACHE_VERSION, files: {}, updatedAt: new Date().toISOString() };
}

function saveIntelCache(cwd, cache) {
  writeFileEnsureDir(getIntelCachePath(cwd), JSON.stringify(cache, null, 2));
}

function extractFlowsFromLines(cwd, relFile, lines) {
  const flows = [];
  const routeRe = /\b(app|router)\.(get|post|put|delete|patch)\s*\(\s*["'`](.+?)["'`]/;
  const eventRe = /\b(on|emit|publish|subscribe)\s*\(\s*["'`]([^"'`]+)["'`]/;
  const jobRe = /\b(cron\.schedule|agenda\.define|bull|queue\.process|setInterval)\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(routeRe);
    if (m) {
      flows.push({
        type: "http",
        name: `${m[2].toUpperCase()} ${m[3]}`,
        file: relFile,
        evidence: lineEvidence(cwd, path.join(cwd, relFile), i + 1, line),
      });
      continue;
    }
    m = line.match(eventRe);
    if (m) {
      flows.push({
        type: "event",
        name: `${m[1]}:${m[2]}`,
        file: relFile,
        evidence: lineEvidence(cwd, path.join(cwd, relFile), i + 1, line),
      });
      continue;
    }
    if (jobRe.test(line)) {
      flows.push({
        type: "job",
        name: "scheduled/background job",
        file: relFile,
        evidence: lineEvidence(cwd, path.join(cwd, relFile), i + 1, line),
      });
    }
  }
  return flows;
}

function extractIntegrationsFromLines(cwd, relFile, lines) {
  const integrations = [];
  const envUrlRe = /\b([A-Z0-9_]*(URL|ENDPOINT|HOST|DSN)[A-Z0-9_]*)\b/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(envUrlRe);
    if (!m) continue;
    integrations.push({
      integration: "External endpoint/env integration",
      source: m[1],
      evidence: lineEvidence(cwd, path.join(cwd, relFile), i + 1, lines[i]),
    });
  }
  return integrations;
}

function extractRuntimeConfigsFromLines(cwd, relFile, lines) {
  const runtimeConfigs = [];
  const fileSignals = [
    ".env",
    ".env.example",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
    "k8s",
    "helm",
  ];

  if (fileSignals.some((s) => relFile.includes(s))) {
    runtimeConfigs.push({
      category: "runtime-file",
      value: relFile,
      evidence: formatEvidence(relFile, 1, 1, "runtime config artifact"),
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bprocess\.env\.[A-Z0-9_]+\b/.test(line) || /\bENV\s+[A-Z0-9_]+/.test(line)) {
      runtimeConfigs.push({
        category: "env-variable",
        value: line.trim().slice(0, 120),
        evidence: lineEvidence(cwd, path.join(cwd, relFile), i + 1, line),
      });
    }
  }

  return runtimeConfigs;
}

function extractConventionsFromFile(relFile) {
  const conventions = [];
  const markers = {
    hasEslint: false,
    hasPrettier: false,
    hasSrcLayout: false,
    hasTestNaming: false,
  };

  if (relFile.endsWith(".eslintrc") || relFile.includes(".eslintrc")) {
    markers.hasEslint = true;
    conventions.push({ convention: "ESLint configured", evidence: formatEvidence(relFile, 1, 1, "eslint config") });
  }
  if (relFile.includes("prettier")) {
    markers.hasPrettier = true;
    conventions.push({ convention: "Prettier configured", evidence: formatEvidence(relFile, 1, 1, "prettier config") });
  }
  if (relFile.startsWith("src/")) markers.hasSrcLayout = true;
  if (/(\.test\.|\.spec\.)/.test(relFile)) markers.hasTestNaming = true;

  return { conventions, markers };
}

function extractHotspotsFromLines(cwd, relFile, lines) {
  const hotspots = [];
  const loc = lines.length;
  if (loc > 600) {
    hotspots.push({
      file: relFile,
      risk: "high",
      reason: `large file (${loc} LOC)`,
      evidence: formatEvidence(relFile, 1, 1, `LOC=${loc}`),
    });
  }

  let todoCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/TODO|FIXME|HACK/.test(lines[i])) {
      todoCount += 1;
      if (todoCount <= 3) {
        hotspots.push({
          file: relFile,
          risk: "medium",
          reason: "maintenance marker",
          evidence: lineEvidence(cwd, path.join(cwd, relFile), i + 1, lines[i]),
        });
      }
    }
    if (/\bany\b/.test(lines[i])) {
      hotspots.push({
        file: relFile,
        risk: "low",
        reason: "weak typing hint",
        evidence: lineEvidence(cwd, path.join(cwd, relFile), i + 1, lines[i]),
      });
      break;
    }
  }

  return hotspots;
}

function analyzeFileIntelligence(cwd, relFile, hash) {
  const fullPath = path.join(cwd, relFile);
  try {
    const st = fs.statSync(fullPath);
    if (st.size > MAX_FILE_BYTES) {
      return {
        hash,
        skipped: true,
        flows: [],
        integrations: [],
        runtimeConfigs: [],
        conventions: [],
        hotspots: [],
        markers: {},
        analyzedAt: new Date().toISOString(),
      };
    }
  } catch {
    return null;
  }

  const content = readFileSafe(fullPath);
  if (!content) {
    return {
      hash,
      skipped: true,
      flows: [],
      integrations: [],
      runtimeConfigs: [],
      conventions: [],
      hotspots: [],
      markers: {},
      analyzedAt: new Date().toISOString(),
    };
  }

  const lines = content.split(/\r?\n/);
  const flow = extractFlowsFromLines(cwd, relFile, lines);
  const integ = extractIntegrationsFromLines(cwd, relFile, lines);
  const runtime = extractRuntimeConfigsFromLines(cwd, relFile, lines);
  const conv = extractConventionsFromFile(relFile);
  const hot = extractHotspotsFromLines(cwd, relFile, lines);

  return {
    hash,
    skipped: false,
    flows: flow,
    integrations: integ,
    runtimeConfigs: runtime,
    conventions: conv.conventions,
    hotspots: hot,
    markers: conv.markers,
    analyzedAt: new Date().toISOString(),
  };
}

function buildGlobalIntegrations(cwd, analysis) {
  const integrations = [];
  const depMap = {
    axios: "HTTP client",
    "@aws-sdk": "AWS SDK",
    stripe: "Stripe",
    redis: "Redis",
    pg: "PostgreSQL",
    mysql: "MySQL",
    kafkajs: "Kafka",
    amqplib: "RabbitMQ",
    "@google-cloud": "Google Cloud",
  };

  const pkgPath = path.join(cwd, "package.json");
  const pkgRaw = readFileSafe(pkgPath);
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
      for (const dep of deps) {
        for (const [prefix, label] of Object.entries(depMap)) {
          if (dep === prefix || dep.startsWith(prefix)) {
            integrations.push({
              integration: label,
              source: "dependency",
              evidence: formatEvidence("package.json", 1, 1, dep),
            });
          }
        }
      }
    } catch {
      // ignore invalid package
    }
  }

  for (const d of analysis.data || []) {
    integrations.push({
      integration: d,
      source: "data-layer",
      evidence: "fingerprint:data",
    });
  }

  return integrations;
}

function buildStructuralHotspots(struct) {
  const hotspots = [];
  const callCounts = new Map();
  for (const c of struct.calls || []) {
    callCounts.set(c.callee, (callCounts.get(c.callee) || 0) + 1);
  }
  for (const [callee, count] of callCounts.entries()) {
    if (count < 15) continue;
    hotspots.push({
      file: "",
      risk: "medium",
      reason: `high fan-in: ${callee} called ${count} times`,
      evidence: `call-graph:1-1: callee=${callee} count=${count}`,
    });
  }
  return hotspots;
}

function normalizeList(values) {
  const out = [];
  const seen = new Set();
  for (const v of values || []) {
    const text = String(v || "").trim();
    if (!text || NON_SIGNAL_RE.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function mergeSignalLists(primary, fallback, inferred) {
  return normalizeList([...(primary || []), ...(inferred || []), ...(fallback || [])]);
}

function inferSummaryFromEvidence(evidence) {
  const inferred = {
    frameworks: [],
    infra: [],
    ci: [],
    buildTools: [],
    monorepo: [],
    data: [],
  };
  for (const e of evidence || []) {
    const topic = String(e.topic || "").trim().toLowerCase();
    const value = String(e.value || "").trim();
    if (!value || NON_SIGNAL_RE.test(value)) continue;
    if (topic === "framework") inferred.frameworks.push(value);
    if (topic === "infra") inferred.infra.push(value);
    if (topic === "ci") inferred.ci.push(value);
    if (topic === "build-tool") inferred.buildTools.push(value);
    if (topic === "monorepo") inferred.monorepo.push(value);
    if (topic === "data") inferred.data.push(value);
  }
  return inferred;
}

function loadPreviousBriefSummary(cwd) {
  try {
    const projectPaths = ensureProjectDirs(cwd);
    const briefPath = path.join(projectPaths.cache, "project_brief.json");
    const raw = readFileSafe(briefPath);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && parsed.summary ? parsed.summary : {};
  } catch {
    return {};
  }
}

function createProjectIntelligence(cwd, options = {}) {
  const started = Date.now();
  const analysis = analyzeProject(cwd, true);
  const struct = updateStructuralIndex(cwd);
  const fileIndex = updateIndex(cwd);
  const prevCache = loadIntelCache(cwd);
  const nextCache = {
    version: INTEL_CACHE_VERSION,
    files: {},
    updatedAt: new Date().toISOString(),
  };

  let changedFiles = 0;
  let reusedFiles = 0;
  for (const [relFile, meta] of Object.entries(fileIndex.files || {})) {
    const hash = meta.hash || `${meta.mtimeMs}:${meta.size}`;
    const prev = prevCache.files ? prevCache.files[relFile] : null;
    if (prev && prev.hash === hash) {
      nextCache.files[relFile] = prev;
      reusedFiles += 1;
      continue;
    }

    const analyzed = analyzeFileIntelligence(cwd, relFile, hash);
    if (analyzed) {
      nextCache.files[relFile] = analyzed;
    }
    changedFiles += 1;
  }

  saveIntelCache(cwd, nextCache);

  const flows = [];
  const runtimeConfigs = [];
  const conventions = [];
  const hotspots = [];
  const integrations = buildGlobalIntegrations(cwd, analysis);
  const markers = { hasEslint: false, hasPrettier: false, hasSrcLayout: false, hasTestNaming: false };

  for (const item of Object.values(nextCache.files)) {
    flows.push(...(item.flows || []));
    integrations.push(...(item.integrations || []));
    runtimeConfigs.push(...(item.runtimeConfigs || []));
    conventions.push(...(item.conventions || []));
    hotspots.push(...(item.hotspots || []));
    if (item.markers) {
      markers.hasEslint = markers.hasEslint || Boolean(item.markers.hasEslint);
      markers.hasPrettier = markers.hasPrettier || Boolean(item.markers.hasPrettier);
      markers.hasSrcLayout = markers.hasSrcLayout || Boolean(item.markers.hasSrcLayout);
      markers.hasTestNaming = markers.hasTestNaming || Boolean(item.markers.hasTestNaming);
    }
  }

  if (markers.hasSrcLayout) conventions.push({ convention: "Source files under src/", evidence: "src/:1-1: source layout" });
  if (markers.hasTestNaming) conventions.push({ convention: "Test naming uses .test/.spec", evidence: "tests:1-1: naming pattern" });
  if (!markers.hasEslint) conventions.push({ convention: "No ESLint config detected", evidence: "repo:1-1: missing lint config" });
  if (!markers.hasPrettier) conventions.push({ convention: "No Prettier config detected", evidence: "repo:1-1: missing format config" });
  hotspots.push(...buildStructuralHotspots(struct));

  const previousSummary = loadPreviousBriefSummary(cwd);
  const inferred = inferSummaryFromEvidence(analysis.evidence || []);
  const mergedSummary = {
    languages: mergeSignalLists(analysis.languages || [], previousSummary.languages || [], []),
    buildTools: mergeSignalLists(analysis.buildTools || [], previousSummary.buildTools || [], inferred.buildTools || []),
    frameworks: mergeSignalLists(analysis.frameworks || [], previousSummary.frameworks || [], inferred.frameworks || []),
    infra: mergeSignalLists(analysis.infra || [], previousSummary.infra || [], inferred.infra || []),
    ci: mergeSignalLists(analysis.ci || [], previousSummary.ci || [], inferred.ci || []),
    data: mergeSignalLists(analysis.data || [], previousSummary.data || [], inferred.data || []),
    test: mergeSignalLists(analysis.test || [], previousSummary.test || [], []),
    monorepo: mergeSignalLists(analysis.monorepo || [], previousSummary.monorepo || [], inferred.monorepo || []),
    architectureHints: mergeSignalLists(analysis.architecture || [], previousSummary.architectureHints || [], []),
    symbols: (struct.symbols || []).length,
    calls: (struct.calls || []).length,
    references: (struct.references || []).length,
  };

  return {
    generatedAt: new Date().toISOString(),
    canonical: true,
    canonicalFor: ["docs/specialists/architecture.md", "docs/active-context.md", "fingerprint.json"],
    summary: mergedSummary,
    incremental: {
      total_files: Object.keys(fileIndex.files || {}).length,
      changed_files: changedFiles,
      reused_files: reusedFiles,
      cache_file: getIntelCachePath(cwd),
      latency_ms: Date.now() - started,
    },
    flows,
    integrations,
    runtimeConfigs,
    conventions,
    hotspots,
    evidence: analysis.evidence || [],
  };
}

function deriveFingerprint(brief) {
  const s = (brief && brief.summary) || {};
  return {
    languages: s.languages || [],
    buildTools: s.buildTools || [],
    frameworks: s.frameworks || [],
    infra: s.infra || [],
    ci: s.ci || [],
    architecture: s.architectureHints || [],
    monorepo: s.monorepo || [],
    data: s.data || [],
    test: s.test || [],
    evidence: brief && brief.evidence ? brief.evidence : [],
    derivedFrom: "project_brief.json",
    derivedAt: new Date().toISOString(),
  };
}

function listOrUnknown(items) {
  return items && items.length ? items.join(", ") : "";
}

function renderArchitectureMarkdown(brief) {
  const s = (brief && brief.summary) || {};
  const ev = (brief && brief.evidence) || [];
  const lines = [];
  lines.push("# Architecture Summary");
  lines.push("");
  lines.push(`- Source of truth: project_brief.json (${brief.generatedAt || "unknown"})`);
  if (listOrUnknown(s.languages)) lines.push(`- Languages: ${listOrUnknown(s.languages)}`);
  if (listOrUnknown(s.buildTools)) lines.push(`- Build tools: ${listOrUnknown(s.buildTools)}`);
  if (listOrUnknown(s.frameworks)) lines.push(`- Frameworks: ${listOrUnknown(s.frameworks)}`);
  if (s.infra && s.infra.length) lines.push(`- Infra: ${s.infra.join(", ")}`);
  if (s.ci && s.ci.length) lines.push(`- CI/CD: ${s.ci.join(", ")}`);
  if (s.data && s.data.length) lines.push(`- Data: ${s.data.join(", ")}`);
  if (s.test && s.test.length) lines.push(`- Tests: ${s.test.join(", ")}`);
  if (s.monorepo && s.monorepo.length) lines.push(`- Monorepo: ${s.monorepo.join(", ")}`);
  if (s.architectureHints && s.architectureHints.length) lines.push(`- Architecture hints: ${s.architectureHints.join(", ")}`);
  if (Number(s.symbols || 0) > 0 || Number(s.calls || 0) > 0 || Number(s.references || 0) > 0) {
    lines.push(`- Structural index: symbols=${s.symbols || 0} calls=${s.calls || 0} refs=${s.references || 0}`);
  }

  if (brief.incremental) {
    lines.push(`- Incremental intelligence: changed=${brief.incremental.changed_files} reused=${brief.incremental.reused_files} total=${brief.incremental.total_files} latency_ms=${brief.incremental.latency_ms}`);
  }

  if (ev.length) {
    lines.push("");
    lines.push("Evidence:");
    for (const item of ev) {
      lines.push(`- ${item.topic}=${item.value} (${item.confidence}): ${item.evidence}`);
    }
  }
  return lines.join("\n") + "\n";
}

function buildActiveContextFromBrief(brief, devlogItems, maxBullets) {
  const s = (brief && brief.summary) || {};
  const lines = [];
  lines.push(`- Source: project_brief.json (${brief.generatedAt || "unknown"})`);
  lines.push(`- Languages: ${(s.languages || []).join(", ") || "unknown"}`);
  lines.push(`- Build tools: ${(s.buildTools || []).join(", ") || "unknown"}`);
  lines.push(`- Frameworks: ${(s.frameworks || []).join(", ") || "unknown"}`);
  lines.push(`- Architecture hints: ${(s.architectureHints || []).join(", ") || "none detected"}`);

  for (const f of (brief.flows || [])) {
    lines.push(`- Flow: ${f.name}`);
  }
  for (const h of (brief.hotspots || [])) {
    lines.push(`- Risk (${h.risk}): ${h.reason}`);
  }

  for (const item of (devlogItems || [])) {
    if (item && item.summary) lines.push(`- Recent: ${item.summary}`);
  }
  const limit = Number(maxBullets || 0);
  if (limit > 0 && Number.isFinite(limit)) {
    return lines.slice(0, limit).join("\n") + "\n";
  }
  return lines.join("\n") + "\n";
}

module.exports = {
  createProjectIntelligence,
  deriveFingerprint,
  renderArchitectureMarkdown,
  buildActiveContextFromBrief,
};
