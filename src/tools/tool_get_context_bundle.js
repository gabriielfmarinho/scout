"use strict";

const path = require("path");
const { ensureProjectDirs } = require("../utils/paths");
const { readFileSafe, writeFileEnsureDir } = require("../utils/fs_utils");
const { getCoreFilePath, readCoreText } = require("../utils/cache_files");
const { formatEvidenceLevel } = require("../utils/evidence_level");
const { appendTelemetry } = require("../utils/telemetry");
const { loadGlobalContextCached } = require("../utils/global_context_cache");
const { TOPICS, parseJsonl, normalizeTopicName, loadSpecialistItems, loadSpecialistManifest, writeSpecialistContext } = require("../utils/specialized_context");
const { GLOBAL_TOPICS, normalizeTopicName: normalizeGlobalTopicName, getAvailableGlobalTopics } = require("../utils/global_specialized_context");
const { createProjectIntelligence, deriveFingerprint, renderArchitectureMarkdown } = require("../utils/project_intelligence");

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(String(cursor), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function normalizeTopics(topics) {
  if (!Array.isArray(topics) || !topics.length) return ["overview"];
  const normalized = topics.map((t) => normalizeTopicName(t, "overview")).filter(Boolean);
  return normalized.length ? normalized : ["overview"];
}

function normalizeGlobalTopics(topics) {
  if (!Array.isArray(topics) || !topics.length) return ["all"];
  const normalized = topics.map((t) => normalizeGlobalTopicName(t, "all")).filter(Boolean);
  return normalized.length ? normalized : ["all"];
}

function ensureCanonicalSpecialists(cwd, projectPaths) {
  const manifest = loadSpecialistManifest(projectPaths);
  if (manifest && Array.isArray(manifest.specialists)) return manifest;

  const briefPath = getCoreFilePath(projectPaths, "project_brief.json");
  let brief = null;
  const briefRaw = readCoreText(projectPaths, "project_brief.json");
  if (briefRaw) {
    try {
      brief = JSON.parse(briefRaw || "{}");
    } catch {
      brief = null;
    }
  }

  if (!brief || !brief.summary) {
    brief = createProjectIntelligence(cwd, { context_pack: "default" });
    writeFileEnsureDir(briefPath, JSON.stringify(brief, null, 2));
    const fingerprintPath = getCoreFilePath(projectPaths, "fingerprint.json");
    writeFileEnsureDir(fingerprintPath, JSON.stringify(deriveFingerprint(brief), null, 2));
  }

  const devlogPath = path.join(projectPaths.devlog, "timeline.jsonl");
  const devlogItems = parseJsonl(readFileSafe(devlogPath) || "");
  const persisted = writeSpecialistContext(cwd, brief, devlogItems);
  const architecturePath = path.join(projectPaths.docs, "specialists", "architecture.md");
  writeFileEnsureDir(architecturePath, renderArchitectureMarkdown(brief));
  return persisted.manifest;
}

async function toolGetContextBundle(args) {
  const started = Date.now();
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "get_context_bundle_root", { root: cwd });
  const projectPaths = ensureProjectDirs(cwd);
  const pageSize = Number(args.page_size || args.max_items || 50);
  const contextPack = args.context_pack || "default";
  const evidenceLevel = args.evidence_level || "full";
  const includePreferential = args.include_preferential !== false;
  const topics = normalizeTopics(args.topics);
  const globalTopics = normalizeGlobalTopics(args.global_topics);
  ensureCanonicalSpecialists(cwd, projectPaths);

  const globalItems = loadGlobalContextCached(false, { topics: globalTopics });
  const mandatoryGlobal = globalItems.filter((g) => g.priority === "must");
  const preferredGlobal = globalItems.filter((g) => g.priority !== "must");

  const specialist = loadSpecialistItems(projectPaths, topics);
  const specialistItems = specialist.items.map((item) => ({
    text: item.text,
    evidence: item.evidence,
    topic: item.topic,
  }));

  const combined = [
    ...mandatoryGlobal.map((i) => ({ ...i, topic: "global" })),
    ...(includePreferential ? preferredGlobal.map((i) => ({ ...i, topic: "global" })) : []),
    ...specialistItems,
  ];

  const cursor = decodeCursor(args.cursor);
  const offset = cursor && Number.isInteger(cursor.offset) && cursor.offset >= 0 ? cursor.offset : 0;
  const validPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 50;
  const page = combined.slice(offset, offset + validPageSize);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < combined.length;
  const nextCursor = hasMore ? encodeCursor({ offset: nextOffset }) : "";

  const lines = [];
  lines.push("# Context Bundle");
  lines.push("");
  lines.push(`- meta: context_pack=${contextPack}`);
  lines.push(`- meta: evidence_level=${evidenceLevel}`);
  lines.push(`- meta: progressive_disclosure=true`);
  lines.push(`- meta: topics=${topics.join(",")}`);
  lines.push(`- meta: global_topics=${globalTopics.join(",")}`);
  lines.push(`- meta: include_preferential=${includePreferential}`);
  lines.push(`- meta: mandatory_global_count=${mandatoryGlobal.length}`);
  lines.push(`- meta: returned_items=${page.length}`);
  lines.push(`- meta: total_items=${combined.length}`);
  lines.push(`- meta: has_more=${hasMore}`);
  if (hasMore) {
    lines.push(`- meta: next_cursor=${nextCursor}`);
  }
  if (specialist.manifest && Array.isArray(specialist.manifest.specialists)) {
    const available = specialist.manifest.specialists.map((s) => s.topic).join(",");
    lines.push(`- meta: available_topics=${available}`);
  } else {
    lines.push(`- meta: available_topics=${TOPICS.join(",")}`);
  }
  const availableGlobal = getAvailableGlobalTopics();
  lines.push(`- meta: available_global_topics=${(availableGlobal.length ? availableGlobal : GLOBAL_TOPICS).join(",")}`);

  for (const item of page) {
    const prefix = item.priority === "must" ? "[must] " : "";
    const topicPrefix = item.topic ? `[${item.topic}] ` : "";
    const quality = Number.isFinite(item.quality_score) ? ` [q=${item.quality_score}]` : "";
    lines.push(`- ${prefix}${topicPrefix}${item.text}${quality}`);
    lines.push(`  Evidence: ${formatEvidenceLevel(item.evidence, evidenceLevel)}`);
  }
  appendTelemetry(cwd, "get_context_bundle", {
    context_pack: contextPack,
    evidence_level: evidenceLevel,
    progressive_disclosure: true,
    topics,
    global_topics: globalTopics,
    offset,
    page_size: validPageSize,
    items_total: combined.length,
    items_returned: page.length,
    include_preferential: includePreferential,
    mandatory_global_count: mandatoryGlobal.length,
    has_more: hasMore,
    latency_ms: Date.now() - started,
  });

  return lines.join("\n");
}

module.exports = { toolGetContextBundle };
