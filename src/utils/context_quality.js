"use strict";

const fs = require("fs");
const path = require("path");

const EVIDENCE_RE = /^.+:\d+-\d+:\s*.+$/;
const CONFIDENCE = new Set(["high", "medium", "low"]);
const STATUS = new Set(["draft", "reviewed", "approved", "deprecated"]);
const ALLOWED_TRANSITIONS = {
  draft: new Set(["draft", "reviewed", "deprecated"]),
  reviewed: new Set(["reviewed", "approved", "deprecated"]),
  approved: new Set(["approved", "deprecated"]),
  deprecated: new Set(["deprecated"]),
};

function nowIso() {
  return new Date().toISOString();
}

function isValidEvidence(evidence) {
  return EVIDENCE_RE.test(String(evidence || "").trim());
}

function parseEvidence(evidence) {
  const raw = String(evidence || "").trim();
  const m = raw.match(/^(.*):(\d+)-(\d+):\s*(.*)$/);
  if (!m) return null;
  return {
    file: m[1],
    start: Number(m[2]),
    end: Number(m[3]),
    snippet: m[4] || "",
  };
}

function verifyEvidenceAgainstFs(evidence, cwd) {
  const parsed = parseEvidence(evidence);
  if (!parsed) return { ok: false, reason: "invalid_evidence_format" };
  if (!cwd) return { ok: true };
  const targetPath = path.isAbsolute(parsed.file) ? parsed.file : path.join(cwd, parsed.file);
  let content = "";
  try {
    content = fs.readFileSync(targetPath, "utf8");
  } catch {
    return { ok: false, reason: "evidence_file_missing" };
  }
  const lines = content.split(/\r?\n/);
  if (parsed.start <= 0 || parsed.end < parsed.start || parsed.end > lines.length) {
    return { ok: false, reason: "evidence_line_out_of_range" };
  }
  const rangeText = lines.slice(parsed.start - 1, parsed.end).join("\n");
  const normalizedRange = rangeText.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedSnippet = String(parsed.snippet || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (normalizedSnippet && !normalizedRange.includes(normalizedSnippet)) {
    return { ok: false, reason: "evidence_snippet_mismatch" };
  }
  return { ok: true };
}

function isValidStatusTransition(previous, next) {
  const prev = String(previous || "").trim().toLowerCase();
  const nxt = String(next || "").trim().toLowerCase();
  if (!prev || !nxt || prev === nxt) return true;
  if (!ALLOWED_TRANSITIONS[prev]) return true;
  return ALLOWED_TRANSITIONS[prev].has(nxt);
}

function daysSince(iso) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  const delta = Date.now() - d;
  if (delta < 0) return 0;
  return Math.floor(delta / (1000 * 60 * 60 * 24));
}

function computeQuality(item) {
  let score = 100;
  const issues = [];
  const text = String(item && item.text ? item.text : item && item.summary ? item.summary : "").trim();
  const evidence = String(item && item.evidence ? item.evidence : "").trim();
  const rationale = String(item && item.rationale ? item.rationale : "").trim();
  const owner = String(item && item.owner ? item.owner : "").trim();
  const confidence = String(item && item.confidence ? item.confidence : "").trim().toLowerCase();
  const status = String(item && item.status ? item.status : "").trim().toLowerCase();

  if (!text) {
    score -= 40;
    issues.push("missing_summary");
  } else {
    if (text.length < 12) {
      score -= 12;
      issues.push("summary_too_short");
    }
    if (/\b(todo|tbd|n\/a|unknown|later)\b/i.test(text)) {
      score -= 12;
      issues.push("vague_summary");
    }
  }
  if (!evidence) {
    score -= 35;
    issues.push("missing_evidence");
  } else if (!isValidEvidence(evidence)) {
    score -= 20;
    issues.push("weak_evidence_format");
  }
  if (!rationale) {
    score -= 10;
    issues.push("missing_rationale");
  } else if (rationale.length < 12) {
    score -= 8;
    issues.push("rationale_too_short");
  }
  if (!owner) {
    score -= 8;
    issues.push("missing_owner");
  }
  if (!confidence || !CONFIDENCE.has(confidence)) {
    score -= 6;
    issues.push("missing_or_invalid_confidence");
  }
  if (status && !STATUS.has(status)) {
    score -= 6;
    issues.push("invalid_status");
  }
  if (!status) {
    score -= 4;
    issues.push("missing_status");
  }

  const ageDays = daysSince(item && item.updated_at ? item.updated_at : item && item.updatedAt ? item.updatedAt : "");
  if (ageDays !== null && ageDays > 90) {
    score -= 8;
    issues.push("stale_context");
  }

  if (score < 0) score = 0;
  return { score, issues };
}

function normalizeStructuredEntry(entry, defaults = {}) {
  const e = entry || {};
  return {
    text: String(e.summary || e.text || "").trim(),
    summary: String(e.summary || e.text || "").trim(),
    decision: String(e.decision || "").trim(),
    rationale: String(e.rationale || "").trim(),
    evidence: String(e.evidence || "").trim(),
    confidence: String(e.confidence || defaults.confidence || "medium").trim().toLowerCase(),
    owner: String(e.owner || defaults.owner || "").trim(),
    status: String(e.status || defaults.status || "draft").trim().toLowerCase(),
    priority: e.priority === "must" ? "must" : "prefer",
    topic: String(e.topic || defaults.topic || "general").trim(),
    source: String(e.source || defaults.source || "user").trim(),
    updated_at: e.updated_at || nowIso(),
  };
}

function validateStructuredEntry(entry, options = {}) {
  const errs = [];
  const previousStatus = String(options.previous_status || "").trim().toLowerCase();
  const cwd = options.cwd || "";
  if (!entry.text) errs.push("summary is required");
  if (entry.text && entry.text.length < 12) errs.push("summary is too short (min 12 chars)");
  if (entry.text && /\b(todo|tbd|n\/a|unknown|later)\b/i.test(entry.text)) errs.push("summary contains placeholder terms");
  if (!entry.evidence) errs.push("evidence is required");
  if (entry.evidence && !isValidEvidence(entry.evidence)) errs.push("evidence must follow <file>:<start>-<end>: <snippet>");
  if (entry.evidence && isValidEvidence(entry.evidence) && cwd) {
    const ver = verifyEvidenceAgainstFs(entry.evidence, cwd);
    if (!ver.ok) errs.push(ver.reason);
  }
  if (!entry.rationale) errs.push("rationale is required");
  if (entry.rationale && entry.rationale.length < 12) errs.push("rationale is too short (min 12 chars)");
  if (!entry.owner) errs.push("owner is required");
  if (!CONFIDENCE.has(entry.confidence)) errs.push("confidence must be high|medium|low");
  if (!STATUS.has(entry.status)) errs.push("status must be draft|reviewed|approved|deprecated");
  if (entry.status === "approved" && entry.confidence === "low") errs.push("approved entries cannot have low confidence");
  if (!isValidStatusTransition(previousStatus, entry.status)) {
    errs.push(`invalid_status_transition ${previousStatus} -> ${entry.status}`);
  }
  return errs;
}

module.exports = {
  isValidEvidence,
  parseEvidence,
  verifyEvidenceAgainstFs,
  isValidStatusTransition,
  computeQuality,
  normalizeStructuredEntry,
  validateStructuredEntry,
};
