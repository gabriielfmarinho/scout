"use strict";

function parseEvidence(evidence) {
  const text = String(evidence || "");
  const m = text.match(/^(.*):(\d+-\d+):\s*(.*)$/);
  if (!m) {
    return { file: "", range: "", snippet: text, raw: text };
  }
  return {
    file: m[1],
    range: m[2],
    snippet: m[3] || "",
    raw: text,
  };
}

function clip(str, max) {
  if (!str) return "";
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(0, max - 3))}...`;
}

function formatEvidenceLevel(evidence, level) {
  const parsed = parseEvidence(evidence);
  const l = (level || "standard").toLowerCase();
  if (!parsed.range) return clip(parsed.raw, l === "minimal" ? 80 : 160);

  if (l === "minimal") {
    return `${parsed.file}:${parsed.range}`;
  }
  if (l === "full") {
    return parsed.raw;
  }
  return `${parsed.file}:${parsed.range}: ${clip(parsed.snippet, 160)}`;
}

function mapEvidenceLevel(items, level) {
  return (items || []).map((item) => {
    if (!item || !item.evidence) return item;
    return { ...item, evidence: formatEvidenceLevel(item.evidence, level) };
  });
}

module.exports = {
  formatEvidenceLevel,
  mapEvidenceLevel,
};

