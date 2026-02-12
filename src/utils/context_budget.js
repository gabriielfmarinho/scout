"use strict";

function parseEvidenceFile(evidence) {
  if (!evidence || typeof evidence !== "string") return "";
  const idx = evidence.indexOf(":");
  if (idx <= 0) return "";
  return evidence.slice(0, idx);
}

function dedupeByEvidence(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const evidence = item && item.evidence ? String(item.evidence) : "";
    const key = evidence || JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function applyContextBudget(items, options = {}) {
  const maxItems = Number(options.maxItems || 30);
  const maxChars = Number(options.maxChars || 10000);
  const maxPerFile = Number(options.maxPerFile || 5);
  const deduped = dedupeByEvidence(items);

  const kept = [];
  const perFile = new Map();
  let chars = 0;

  for (const item of deduped) {
    if (kept.length >= maxItems) break;
    const evidence = item && item.evidence ? String(item.evidence) : "";
    const file = parseEvidenceFile(evidence) || "__unknown__";
    const count = perFile.get(file) || 0;
    if (count >= maxPerFile) continue;

    const itemChars = JSON.stringify(item).length;
    if (chars + itemChars > maxChars) break;

    kept.push(item);
    perFile.set(file, count + 1);
    chars += itemChars;
  }

  const truncated = deduped.length > kept.length;
  return { items: kept, truncated, originalCount: deduped.length };
}

function contextPackDefaults(pack) {
  switch (pack) {
    case "debug":
      return { maxItems: 50, maxChars: 16000, maxPerFile: 8 };
    case "refactor":
      return { maxItems: 40, maxChars: 14000, maxPerFile: 6 };
    case "review":
      return { maxItems: 35, maxChars: 12000, maxPerFile: 4 };
    default:
      return { maxItems: 30, maxChars: 10000, maxPerFile: 5 };
  }
}

module.exports = {
  applyContextBudget,
  dedupeByEvidence,
  contextPackDefaults,
};

