"use strict";

const path = require("path");
const os = require("os");
const { readFileSafe, writeFileEnsureDir, fileExists } = require("./fs_utils");
const { parseRule } = require("./global_rules");
const { formatEvidence } = require("./snippet");
const { computeQuality } = require("./context_quality");

const MANIFEST_VERSION = 1;
const GLOBAL_TOPICS = ["identity", "coding", "workflow", "quality", "security", "general"];

function getGlobalDir() {
  return path.join(os.homedir(), ".engineering-ai", "global");
}

function getGlobalContextPath() {
  return path.join(getGlobalDir(), "active-context.md");
}

function getGlobalManifestPath() {
  return path.join(getGlobalDir(), "context_manifest.json");
}

function normalizeTopicName(name, fallback = "general") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function classifyTopic(text) {
  const t = String(text || "").toLowerCase();
  if (/\b(name:|i am|me chamo|sou )\b/.test(t)) return "identity";
  if (/\b(secret|token|security|secure|auth|sanitize|validate|owasp)\b/.test(t)) return "security";
  if (/\b(test|coverage|qa|assert|regression)\b/.test(t)) return "quality";
  if (/\b(pr|pull request|commit|branch|workflow|deploy|release|ci|code review)\b/.test(t)) return "workflow";
  if (/\b(style|naming|lint|format|clean code|refactor|function|typescript|javascript)\b/.test(t)) return "coding";
  return "general";
}

function normalizeTopics(topics) {
  if (!Array.isArray(topics) || !topics.length) return ["all"];
  const out = topics.map((t) => normalizeTopicName(t, "all")).filter(Boolean);
  return out.length ? out : ["all"];
}

function parseLegacyActiveContext(content, filePath) {
  if (!content) return [];
  const lines = String(content).split(/\r?\n/);
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("-")) continue;
    const parsed = parseRule(line, "prefer");
    if (!parsed.text) continue;
    entries.push({
      id: `legacy-${i + 1}`,
      text: parsed.text,
      priority: parsed.priority,
      topic: classifyTopic(parsed.text),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence: formatEvidence(filePath, i + 1, i + 1, line.trim()),
      source: "legacy-active-context",
    });
  }
  return entries;
}

function uniqueEntries(entries) {
  const byText = new Map();
  for (const entry of entries || []) {
    const text = String(entry.text || "").trim();
    if (!text) continue;
    const normalized = {
      id: entry.id || "",
      text,
      summary: String(entry.summary || text),
      decision: String(entry.decision || ""),
      rationale: String(entry.rationale || ""),
      priority: entry.priority === "must" ? "must" : "prefer",
      topic: normalizeTopicName(entry.topic || classifyTopic(text), "general"),
      confidence: String(entry.confidence || "medium"),
      owner: String(entry.owner || ""),
      status: String(entry.status || "draft"),
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: entry.source || "update_global_context",
      evidence: entry.evidence || "",
    };
    const prev = byText.get(text);
    if (!prev) {
      byText.set(text, normalized);
      continue;
    }
    if (prev.priority !== "must" && normalized.priority === "must") {
      byText.set(text, { ...normalized, createdAt: prev.createdAt || normalized.createdAt });
      continue;
    }
    if (!prev.evidence && normalized.evidence) {
      byText.set(text, { ...prev, evidence: normalized.evidence, updatedAt: normalized.updatedAt });
    }
  }
  const list = [...byText.values()].map((item) => {
    const q = computeQuality(item);
    return { ...item, quality_score: q.score, quality_issues: q.issues };
  });
  list.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "must" ? -1 : 1;
    if (a.topic !== b.topic) return a.topic.localeCompare(b.topic);
    return a.text.localeCompare(b.text);
  });
  return list;
}

function writeTopicMarkdown(topic, entries) {
  const lines = [`# Global ${topic}`, ""];
  for (const e of entries) {
    const q = Number.isFinite(e.quality_score) ? ` [q=${e.quality_score}]` : "";
    lines.push(`- [${e.priority}] ${e.text}${q}`);
  }
  return lines.join("\n") + "\n";
}

function writeActiveIndex(manifest) {
  const lines = ["# Global Context Index", "", "Progressive disclosure index for global context.", ""];
  for (const spec of manifest.specialists || []) {
    lines.push(`- topic=${spec.topic} count=${spec.count} path=${spec.doc_path}`);
  }
  return lines.join("\n") + "\n";
}

function loadGlobalManifest() {
  const manifestPath = getGlobalManifestPath();
  if (!fileExists(manifestPath)) return null;
  try {
    return JSON.parse(readFileSafe(manifestPath) || "{}");
  } catch {
    return null;
  }
}

function getAvailableGlobalTopics() {
  const manifest = loadGlobalManifest();
  if (!manifest || !Array.isArray(manifest.specialists)) return [...GLOBAL_TOPICS];
  return manifest.specialists.map((s) => normalizeTopicName(s.topic, "general"));
}

function writeGlobalEntries(entries) {
  const globalDir = getGlobalDir();
  const merged = uniqueEntries(entries);
  const existingTopics = getAvailableGlobalTopics();
  const dynamicTopics = merged.map((e) => normalizeTopicName(e.topic, "general"));
  const topics = [...new Set([...GLOBAL_TOPICS, ...existingTopics, ...dynamicTopics])].sort();
  const specialists = [];

  for (const topic of topics) {
    const topicEntries = merged.filter((e) => normalizeTopicName(e.topic, "general") === topic);
    const cachePath = path.join(globalDir, "specialists", `${topic}.json`);
    const docPath = path.join(globalDir, "specialists", `${topic}.md`);
    writeFileEnsureDir(cachePath, JSON.stringify({ topic, entries: topicEntries }, null, 2));
    writeFileEnsureDir(docPath, writeTopicMarkdown(topic, topicEntries));
    specialists.push({ topic, count: topicEntries.length, cache_path: cachePath, doc_path: docPath });
  }

  const manifest = {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    specialists,
    totalEntries: merged.length,
  };
  writeFileEnsureDir(getGlobalManifestPath(), JSON.stringify(manifest, null, 2));
  writeFileEnsureDir(getGlobalContextPath(), writeActiveIndex(manifest));
  return { manifest, entries: merged };
}

function ensureGlobalSpecialists() {
  const manifest = loadGlobalManifest();
  if (manifest && Array.isArray(manifest.specialists)) return manifest;
  const legacyPath = getGlobalContextPath();
  const legacyEntries = parseLegacyActiveContext(readFileSafe(legacyPath) || "", legacyPath);
  return writeGlobalEntries(legacyEntries).manifest;
}

function loadGlobalEntries(options = {}) {
  const topics = normalizeTopics(options.topics);
  const wantAll = topics.includes("all");
  ensureGlobalSpecialists();
  const manifest = loadGlobalManifest() || { specialists: [] };
  const out = [];

  for (const spec of manifest.specialists || []) {
    const topic = normalizeTopicName(spec.topic, "general");
    if (!wantAll && !topics.includes(topic)) continue;
    try {
      const parsed = JSON.parse(readFileSafe(spec.cache_path) || "{}");
      for (const e of parsed.entries || []) {
        out.push({
          text: e.text,
          priority: e.priority,
          topic: normalizeTopicName(e.topic, topic),
          evidence: e.evidence || `${spec.doc_path}:1-1: [${e.priority}] ${e.text}`,
        });
      }
    } catch {
      continue;
    }
  }

  return out;
}

function loadAllGlobalEntries() {
  ensureGlobalSpecialists();
  const manifest = loadGlobalManifest() || { specialists: [] };
  const out = [];
  for (const spec of manifest.specialists || []) {
    try {
      const parsed = JSON.parse(readFileSafe(spec.cache_path) || "{}");
      for (const e of parsed.entries || []) {
        out.push({
          ...e,
          topic: normalizeTopicName(e.topic || spec.topic, "general"),
          evidence: e.evidence || `${spec.doc_path}:1-1: [${e.priority}] ${e.text}`,
        });
      }
    } catch {
      continue;
    }
  }
  return out;
}

module.exports = {
  GLOBAL_TOPICS,
  getGlobalDir,
  getGlobalContextPath,
  getGlobalManifestPath,
  normalizeTopicName,
  classifyTopic,
  ensureGlobalSpecialists,
  loadGlobalEntries,
  loadAllGlobalEntries,
  loadGlobalManifest,
  getAvailableGlobalTopics,
  writeGlobalEntries,
  normalizeTopics,
};
