"use strict";

const path = require("path");
const { ensureProjectDirs } = require("./paths");
const { writeFileEnsureDir, readFileSafe, fileExists } = require("./fs_utils");
const { computeQuality } = require("./context_quality");

const MANIFEST_VERSION = 1;
const TOPICS = ["overview", "flows", "integrations", "runtime", "conventions", "hotspots", "decisions", "activity"];
const AUTO_SOURCES = new Set(["project_brief", "devlog"]);

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

function dedupeItems(items) {
  const map = new Map();
  for (const item of items || []) {
    const topic = normalizeTopicName(item.topic, "general");
    const text = String(item.text || "").trim();
    if (!text) continue;
    const key = `${topic}|${text}`;
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
    flows: [],
    integrations: [],
    runtime: [],
    conventions: [],
    hotspots: [],
    decisions: [],
    activity: [],
  };

  byTopic.overview.push(toItem("overview", `Source: project_brief.json (${brief.generatedAt || "unknown"})`, "project_brief.json:1-1: canonical source", "project_brief"));
  byTopic.overview.push(toItem("overview", `Languages: ${(s.languages || []).join(", ") || "unknown"}`, "project_brief.json:1-1: summary.languages", "project_brief"));
  byTopic.overview.push(toItem("overview", `Build tools: ${(s.buildTools || []).join(", ") || "unknown"}`, "project_brief.json:1-1: summary.buildTools", "project_brief"));
  byTopic.overview.push(toItem("overview", `Frameworks: ${(s.frameworks || []).join(", ") || "unknown"}`, "project_brief.json:1-1: summary.frameworks", "project_brief"));
  byTopic.overview.push(toItem("overview", `Architecture hints: ${(s.architectureHints || []).join(", ") || "none detected"}`, "project_brief.json:1-1: summary.architectureHints", "project_brief"));

  for (const e of brief.evidence || []) {
    byTopic.overview.push(toItem("overview", `${e.topic}=${e.value} (${e.confidence})`, e.evidence, "project_brief"));
  }

  for (const f of brief.flows || []) byTopic.flows.push(toItem("flows", `${f.type || "flow"}: ${f.name || "unknown"}`, f.evidence, "project_brief"));
  for (const i of brief.integrations || []) byTopic.integrations.push(toItem("integrations", `${i.integration || "integration"} via ${i.source || "unknown"}`, i.evidence, "project_brief"));
  for (const r of brief.runtimeConfigs || []) byTopic.runtime.push(toItem("runtime", `${r.category || "runtime"}: ${r.value || "unknown"}`, r.evidence, "project_brief"));
  for (const c of brief.conventions || []) byTopic.conventions.push(toItem("conventions", c.convention || "convention", c.evidence, "project_brief"));
  for (const h of brief.hotspots || []) byTopic.hotspots.push(toItem("hotspots", `[${h.risk || "unknown"}] ${h.reason || "risk"}`, h.evidence, "project_brief"));

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
  const lines = ["# Active Context Index", "", "Progressive disclosure index. Load specialist topics on demand.", ""];
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
    const preserved = (items || []).filter((item) => !AUTO_SOURCES.has(item.source || ""));
    if (!preserved.length) continue;
    generated[topic] = dedupeItems([...(generated[topic] || []), ...preserved]);
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
