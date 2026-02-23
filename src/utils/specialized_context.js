"use strict";

const path = require("path");
const { ensureProjectDirs } = require("./paths");
const { writeFileEnsureDir, readFileSafe, fileExists } = require("./fs_utils");
const { computeQuality } = require("./context_quality");

const MANIFEST_VERSION = 1;
const TOPICS = ["overview", "architecture", "flows", "integrations", "runtime", "conventions", "hotspots", "decisions", "activity"];
const AUTO_SOURCES = new Set(["project_brief", "devlog"]);
const NON_SIGNAL_TOKEN_RE = /\b(unknown|none detected|not identified|nao identificado|não identificado)\b/i;

function parseJsonl(content) {
  const lines = String(content || "").split(/\r?\n/).filter(Boolean);
  const out = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return out;
}

function normalizeTopicName(name, fallback = "general") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function toItem(topic, text, evidence, source, priority) {
  const item = {
    topic: normalizeTopicName(topic, "general"),
    text: String(text || "").trim(),
    evidence: String(evidence || ""),
    source: source || "",
  };
  if (priority === "must" || priority === "prefer") item.priority = priority;
  item.summary = item.text;
  item.status = "reviewed";
  item.confidence = "high";
  item.owner = "scout";
  item.rationale = "Derived from project analysis";
  item.updated_at = new Date().toISOString();
  return item;
}

function normalizedEvidenceKey(evidence) {
  const raw = String(evidence || "").trim().toLowerCase();
  if (!raw) return "__no_evidence__";
  return raw.replace(/\s+/g, " ");
}

function isWeakAutoItem(item) {
  const source = String(item.source || "").trim();
  if (!AUTO_SOURCES.has(source)) return false;
  const text = String(item.text || "").trim();
  return NON_SIGNAL_TOKEN_RE.test(text);
}

function hasSignal(value) {
  const text = String(value || "").trim();
  return Boolean(text) && !NON_SIGNAL_TOKEN_RE.test(text);
}

function dedupeItems(items) {
  const map = new Map();
  for (const item of items || []) {
    if (isWeakAutoItem(item)) continue;
    const topic = normalizeTopicName(item.topic, "general");
    const text = String(item.text || "").trim();
    if (!text) continue;
    const evKey = normalizedEvidenceKey(item.evidence);
    const key = `${topic}|${text}|${evKey}`;
    const normalized = {
      topic,
      text,
      summary: String(item.summary || text),
      decision: String(item.decision || ""),
      rationale: String(item.rationale || ""),
      evidence: String(item.evidence || ""),
      source: item.source || "user",
      confidence: String(item.confidence || ""),
      owner: String(item.owner || ""),
      status: String(item.status || ""),
      updated_at: String(item.updated_at || item.updatedAt || new Date().toISOString()),
    };
    if (item.priority === "must" || item.priority === "prefer") normalized.priority = item.priority;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, normalized);
      continue;
    }
    const prevMust = prev.priority === "must";
    const nextMust = normalized.priority === "must";
    if (!prevMust && nextMust) {
      map.set(key, { ...normalized, evidence: normalized.evidence || prev.evidence });
      continue;
    }
    if (!prev.evidence && normalized.evidence) {
      map.set(key, { ...prev, evidence: normalized.evidence });
    }
  }
  return [...map.values()].map((item) => {
    const q = computeQuality(item);
    return { ...item, quality_score: q.score, quality_issues: q.issues };
  });
}

function specialistItemsFromBrief(brief, devlogItems) {
  const s = (brief && brief.summary) || {};
  const byTopic = {
    overview: [],
    architecture: [],
    flows: [],
    integrations: [],
    runtime: [],
    conventions: [],
    hotspots: [],
    decisions: [],
    activity: [],
  };

  byTopic.overview.push(toItem("overview", `Source: project_brief.json${brief.generatedAt ? ` (${brief.generatedAt})` : ""}`, "project_brief.json:1-1: canonical source", "project_brief"));
  byTopic.overview.push(toItem("overview", "Use active-context.md as index and load specialist topics on demand.", "docs/active-context.md:1-1: progressive disclosure router", "project_brief"));

  if ((s.languages || []).length) {
    byTopic.architecture.push(toItem("architecture", `Languages: ${(s.languages || []).join(", ")}`, "project_brief.json:1-1: summary.languages", "project_brief"));
  }
  if ((s.buildTools || []).length) {
    byTopic.architecture.push(toItem("architecture", `Build tools: ${(s.buildTools || []).join(", ")}`, "project_brief.json:1-1: summary.buildTools", "project_brief"));
  }
  if ((s.frameworks || []).length) {
    byTopic.architecture.push(toItem("architecture", `Frameworks: ${(s.frameworks || []).join(", ")}`, "project_brief.json:1-1: summary.frameworks", "project_brief"));
  }
  if ((s.architectureHints || []).length) {
    byTopic.architecture.push(toItem("architecture", `Architecture hints: ${(s.architectureHints || []).join(", ")}`, "project_brief.json:1-1: summary.architectureHints", "project_brief"));
  }
  if (Number(s.symbols || 0) > 0 || Number(s.calls || 0) > 0 || Number(s.references || 0) > 0) {
    byTopic.architecture.push(toItem("architecture", `Structural index: symbols=${s.symbols || 0} calls=${s.calls || 0} refs=${s.references || 0}`, "project_brief.json:1-1: summary.structural", "project_brief"));
  }

  for (const e of brief.evidence || []) {
    if (!hasSignal(e.value)) continue;
    byTopic.overview.push(toItem("overview", `${e.topic}=${e.value} (${e.confidence})`, e.evidence, "project_brief"));
  }

  for (const f of brief.flows || []) {
    if (!hasSignal(f.name)) continue;
    byTopic.flows.push(toItem("flows", `${f.type || "flow"}: ${f.name}`, f.evidence, "project_brief"));
  }
  for (const i of brief.integrations || []) {
    if (!hasSignal(i.integration) && !hasSignal(i.source)) continue;
    const integration = hasSignal(i.integration) ? i.integration : "External integration";
    const source = hasSignal(i.source) ? i.source : "unspecified-source";
    byTopic.integrations.push(toItem("integrations", `${integration} via ${source}`, i.evidence, "project_brief"));
  }
  for (const r of brief.runtimeConfigs || []) {
    if (!hasSignal(r.value)) continue;
    const category = hasSignal(r.category) ? r.category : "runtime";
    byTopic.runtime.push(toItem("runtime", `${category}: ${r.value}`, r.evidence, "project_brief"));
  }
  for (const c of brief.conventions || []) {
    if (!hasSignal(c.convention)) continue;
    byTopic.conventions.push(toItem("conventions", c.convention, c.evidence, "project_brief"));
  }
  for (const m of s.monorepo || []) {
    if (!hasSignal(m)) continue;
    byTopic.conventions.push(toItem("conventions", `Monorepo/multi-module setup: ${m}`, "project_brief.json:1-1: summary.monorepo", "project_brief"));
  }
  for (const h of brief.hotspots || []) {
    if (!hasSignal(h.reason) || !hasSignal(h.risk)) continue;
    byTopic.hotspots.push(toItem("hotspots", `[${h.risk}] ${h.reason}`, h.evidence, "project_brief"));
  }

  for (const d of devlogItems.filter((x) => x && x.type === "decision")) {
    byTopic.decisions.push(toItem("decisions", d.summary || "decision", `timeline.jsonl:1-1: ${d.timestamp || ""}`, "devlog"));
  }
  for (const a of devlogItems) {
    if (!a || !a.summary) continue;
    byTopic.activity.push(toItem("activity", `${a.type || "event"}: ${a.summary}`, `timeline.jsonl:1-1: ${a.timestamp || ""}`, "devlog"));
  }

  for (const topic of Object.keys(byTopic)) {
    byTopic[topic] = dedupeItems(byTopic[topic]);
  }
  return byTopic;
}

function writeTopicMarkdown(topic, items) {
  const title = topic.charAt(0).toUpperCase() + topic.slice(1);
  const lines = [`# ${title}`, ""];
  for (const item of items) {
    const pr = item.priority === "must" ? "[must] " : item.priority === "prefer" ? "[prefer] " : "";
    const q = Number.isFinite(item.quality_score) ? ` [q=${item.quality_score}]` : "";
    lines.push(`- ${pr}${item.text}${q}`);
    lines.push(`  Evidence: ${item.evidence || "n/a"}`);
  }
  return lines.join("\n") + "\n";
}

function buildActiveContextIndex(manifest) {
  const lines = [
    "# Active Context Index",
    "",
    "Progressive disclosure router. Specialist topics are the canonical source; avoid duplicating their content here.",
    "",
    `Generated at: ${manifest.generatedAt || "unknown"}`,
    "",
  ];
  for (const spec of manifest.specialists || []) {
    lines.push(`- topic=${spec.topic} count=${spec.count} path=${spec.doc_path}`);
  }
  return lines.join("\n") + "\n";
}

function loadSpecialistManifest(projectPaths) {
  const manifestPath = path.join(projectPaths.cache, "context_manifest.json");
  if (!fileExists(manifestPath)) return null;
  try {
    return JSON.parse(readFileSafe(manifestPath));
  } catch {
    return null;
  }
}

function loadAllSpecialistItems(projectPaths) {
  const manifest = loadSpecialistManifest(projectPaths);
  const byTopic = {};
  if (!manifest || !Array.isArray(manifest.specialists)) return { manifest: null, byTopic };

  for (const spec of manifest.specialists) {
    try {
      const parsed = JSON.parse(readFileSafe(spec.cache_path) || "{}");
      const topic = normalizeTopicName(spec.topic, "general");
      byTopic[topic] = dedupeItems(parsed.items || []);
    } catch {
      continue;
    }
  }
  return { manifest, byTopic };
}

function persistSpecialists(projectPaths, byTopic, source = "project_brief.json") {
  const existingManifest = loadSpecialistManifest(projectPaths);
  const existingTopics = existingManifest && Array.isArray(existingManifest.specialists)
    ? existingManifest.specialists.map((s) => normalizeTopicName(s.topic, "general"))
    : [];
  const topicNames = [...new Set([
    ...TOPICS,
    ...existingTopics,
    ...Object.keys(byTopic || {}).map((t) => normalizeTopicName(t, "general")),
  ])].sort();

  const specialists = [];
  for (const topic of topicNames) {
    const items = dedupeItems((byTopic && byTopic[topic]) || []);
    const cachePath = path.join(projectPaths.cache, "specialists", `${topic}.json`);
    const docPath = path.join(projectPaths.docs, "specialists", `${topic}.md`);
    writeFileEnsureDir(cachePath, JSON.stringify({ topic, items }, null, 2));
    writeFileEnsureDir(docPath, writeTopicMarkdown(topic, items));
    specialists.push({ topic, count: items.length, cache_path: cachePath, doc_path: docPath });
  }

  const manifest = {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    source,
    specialists,
  };

  const manifestPath = path.join(projectPaths.cache, "context_manifest.json");
  writeFileEnsureDir(manifestPath, JSON.stringify(manifest, null, 2));

  const activePath = path.join(projectPaths.docs, "active-context.md");
  writeFileEnsureDir(activePath, buildActiveContextIndex(manifest));

  return { manifestPath, activePath, manifest };
}

function writeSpecialistContext(cwd, brief, devlogItems = []) {
  const projectPaths = ensureProjectDirs(cwd);
  const generated = specialistItemsFromBrief(brief || {}, devlogItems || []);
  const existing = loadAllSpecialistItems(projectPaths);

  for (const [topic, items] of Object.entries(existing.byTopic)) {
    generated[topic] = dedupeItems([...(generated[topic] || []), ...(items || [])]);
  }

  return persistSpecialists(projectPaths, generated, "project_brief.json");
}

function upsertProjectSpecialistEntries(cwd, entries, mode = "append") {
  const projectPaths = ensureProjectDirs(cwd);
  const existing = loadAllSpecialistItems(projectPaths);
  const byTopic = {};

  for (const [topic, items] of Object.entries(existing.byTopic)) {
    byTopic[topic] = [...items];
  }

  const normalizedNew = dedupeItems((entries || []).map((entry) => ({
    topic: normalizeTopicName(entry.topic, "general"),
    text: String(entry.text || "").trim(),
    summary: String(entry.summary || entry.text || "").trim(),
    decision: String(entry.decision || ""),
    rationale: String(entry.rationale || ""),
    evidence: String(entry.evidence || ""),
    source: entry.source || "user",
    confidence: String(entry.confidence || "medium"),
    owner: String(entry.owner || ""),
    status: String(entry.status || "draft"),
    updated_at: String(entry.updated_at || new Date().toISOString()),
    priority: entry.priority === "must" ? "must" : "prefer",
  })));

  if (mode === "replace") {
    for (const topic of Object.keys(byTopic)) {
      byTopic[topic] = byTopic[topic].filter((item) => AUTO_SOURCES.has(item.source || ""));
    }
  }

  for (const item of normalizedNew) {
    const topic = normalizeTopicName(item.topic, "general");
    byTopic[topic] = byTopic[topic] || [];
    byTopic[topic].push(item);
    byTopic[topic] = dedupeItems(byTopic[topic]);
  }

  return persistSpecialists(projectPaths, byTopic, "project_context_update");
}

function loadSpecialistItems(projectPaths, topics) {
  const manifest = loadSpecialistManifest(projectPaths);
  if (!manifest || !Array.isArray(manifest.specialists)) return { manifest: null, items: [] };

  const normalizedTopics = (topics || []).length
    ? topics.map((t) => normalizeTopicName(t, "overview"))
    : ["overview"];
  const wanted = new Set(normalizedTopics);
  const all = wanted.has("all");
  const items = [];

  for (const spec of manifest.specialists) {
    const topic = normalizeTopicName(spec.topic, "general");
    if (!all && !wanted.has(topic)) continue;
    try {
      const parsed = JSON.parse(readFileSafe(spec.cache_path) || "{}");
      for (const item of parsed.items || []) items.push(item);
    } catch {
      continue;
    }
  }

  return { manifest, items };
}

module.exports = {
  TOPICS,
  parseJsonl,
  normalizeTopicName,
  writeSpecialistContext,
  upsertProjectSpecialistEntries,
  loadAllSpecialistItems,
  loadSpecialistManifest,
  loadSpecialistItems,
};
