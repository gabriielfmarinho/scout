"use strict";

const path = require("path");
const { ensureProjectDirs } = require("../utils/paths");
const { readFileSafe, writeFileEnsureDir, fileExists } = require("../utils/fs_utils");
const { buildActiveContextFromBrief, deriveFingerprint } = require("../utils/project_intelligence");
const { parseJsonl, writeSpecialistContext } = require("../utils/specialized_context");

function extractTerms(text) {
  return text
    .split(/[^A-Za-z0-9_\-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && /[A-Za-z]/.test(t));
}

async function toolCompressContext(args) {
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "compress_context_root", { root: cwd });
  const projectPaths = ensureProjectDirs(cwd);
  const maxBullets = Number(args.max_bullets || 30);

  const briefPath = path.join(projectPaths.cache, "project_brief.json");
  const brief = fileExists(briefPath)
    ? JSON.parse(readFileSafe(briefPath))
    : null;

  const fingerprintPath = path.join(projectPaths.cache, "fingerprint.json");
  const legacyFingerprint = fileExists(fingerprintPath)
    ? JSON.parse(readFileSafe(fingerprintPath))
    : null;
  const fingerprint = brief ? deriveFingerprint(brief) : legacyFingerprint;
  if (brief) {
    writeFileEnsureDir(fingerprintPath, JSON.stringify(fingerprint, null, 2));
  }

  const devlogPath = path.join(projectPaths.devlog, "timeline.jsonl");
  const devlogContent = readFileSafe(devlogPath) || "";
  const devlogItems = parseJsonl(devlogContent);

  const activeContext = brief
    ? buildActiveContextFromBrief(brief, devlogItems, Number.MAX_SAFE_INTEGER)
    : (() => {
      const lines = [];
      if (fingerprint) {
        lines.push(`- Languages: ${fingerprint.languages?.join(", ") || "unknown"}`);
        lines.push(`- Build tools: ${fingerprint.buildTools?.join(", ") || "unknown"}`);
        lines.push(`- Frameworks: ${fingerprint.frameworks?.join(", ") || "unknown"}`);
        lines.push(`- Infra: ${fingerprint.infra?.join(", ") || "none detected"}`);
      }
      for (const item of devlogItems) {
        if (item && item.summary) lines.push(`- Recent: ${item.summary}`);
      }
      return lines.join("\n") + "\n";
    })();
  const activePath = path.join(projectPaths.docs, "active-context.md");
  writeFileEnsureDir(activePath, activeContext);
  let specialist = null;
  if (brief) {
    specialist = writeSpecialistContext(cwd, brief, devlogItems);
  }

  const decisions = devlogItems.filter((i) => i.type === "decision");
  const decisionsLines = ["# Decisions", ""];
  for (const d of decisions) {
    decisionsLines.push(`- ${d.summary}`);
  }
  const decisionsPath = path.join(projectPaths.docs, "decisions.md");
  writeFileEnsureDir(decisionsPath, decisionsLines.join("\n") + "\n");

  const termCounts = new Map();
  for (const item of devlogItems) {
    const terms = extractTerms(item.summary || "");
    for (const t of terms) {
      termCounts.set(t, (termCounts.get(t) || 0) + 1);
    }
  }
  const glossaryTerms = [...termCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map((t) => t[0]);
  if (glossaryTerms.length) {
    const glossaryLines = ["# Glossary", ""];
    for (const term of glossaryTerms) {
      glossaryLines.push(`- ${term}: <add definition>`);
    }
    const glossaryPath = path.join(projectPaths.docs, "glossary.md");
    writeFileEnsureDir(glossaryPath, glossaryLines.join("\n") + "\n");
  }

  const output = [];
  output.push("# Context Compression");
  output.push("");
  output.push(`Updated: ${activePath}`);
  output.push(`Updated: ${decisionsPath}`);
  if (specialist) {
    output.push(`Updated: ${specialist.manifestPath}`);
  }
  if (glossaryTerms.length) {
    output.push(`Updated: ${path.join(projectPaths.docs, "glossary.md")}`);
  }

  return output.join("\n");
}

module.exports = { toolCompressContext };
