"use strict";

const { formatToon } = require("../utils/toon");
const { isGitRepo, getDiff } = require("../utils/git");
const { parseUnifiedDiff } = require("../utils/diff");

const SEVERITY_ORDER = { low: 1, medium: 2, high: 3 };

function severityAtLeast(sev, min) {
  return SEVERITY_ORDER[sev] >= SEVERITY_ORDER[min];
}

function diffEvidence(hunkLines) {
  const snippet = hunkLines.slice(0, 8).join("\\n");
  return snippet;
}

async function toolReviewDiff(args) {
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "review_diff_root", { root: cwd });
  if (!isGitRepo(cwd)) {
    return formatToon(
      ["severity", "issue", "file", "suggestion", "evidence"],
      [["high", "Not a git repository", cwd, "Initialize git or run inside repo", "git rev-parse failed"]]
    );
  }

  let diff = "";
  try {
    diff = getDiff(cwd, Boolean(args.staged));
  } catch (err) {
    return formatToon(
      ["severity", "issue", "file", "suggestion", "evidence"],
      [["high", "git diff failed", "", "Check git status and permissions", String(err.message || err)]]
    );
  }
  if (!diff.trim()) {
    return formatToon(
      ["severity", "issue", "file", "suggestion", "evidence"],
      [["low", "No diff to review", "", "Make changes and re-run", "git diff empty"]]
    );
  }

  const focus = args.focus || "all";
  const minSeverity = args.min_severity || "low";
  const parsed = parseUnifiedDiff(diff);

  const findings = [];
  const changedFiles = parsed.map((f) => f.file);
  const testChanged = changedFiles.some((f) => /test|spec/i.test(f));

  for (const file of parsed) {
    for (const hunk of file.hunks) {
      const hunkText = hunk.lines.join("\n");

      if (/TODO|FIXME/.test(hunkText)) {
        findings.push({
          severity: "low",
          issue: "TODO/FIXME added",
          file: file.file,
          suggestion: "Resolve TODO/FIXME or track with issue reference",
          evidence: diffEvidence(hunk.lines),
          focus: "bugs",
        });
      }

      if (/console\.log|System\.out\.println/.test(hunkText)) {
        findings.push({
          severity: "medium",
          issue: "Debug logging detected",
          file: file.file,
          suggestion: "Replace with structured logger or remove",
          evidence: diffEvidence(hunk.lines),
          focus: "observability",
        });
      }

      if (/password|secret|token/i.test(hunkText)) {
        findings.push({
          severity: "high",
          issue: "Potential secret in diff",
          file: file.file,
          suggestion: "Remove sensitive data and use secrets manager",
          evidence: diffEvidence(hunk.lines),
          focus: "bugs",
        });
      }

      if (/logger|traceId|correlation/i.test(hunkText)) {
        findings.push({
          severity: "low",
          issue: "Observability changes detected",
          file: file.file,
          suggestion: "Ensure logs include correlation identifiers",
          evidence: diffEvidence(hunk.lines),
          focus: "observability",
        });
      }
    }
  }

  if (!testChanged) {
    findings.push({
      severity: "medium",
      issue: "No tests changed",
      file: "",
      suggestion: "Consider adding or updating tests",
      evidence: "No test/spec files in diff",
      focus: "tests",
    });
  }

  const filtered = findings.filter((f) => {
    if (focus !== "all" && f.focus !== focus) return false;
    return severityAtLeast(f.severity, minSeverity);
  });

  const headers = ["severity", "issue", "file", "suggestion", "evidence"];
  const rows = filtered.map((f) => [f.severity, f.issue, f.file, f.suggestion, f.evidence]);
  return formatToon(headers, rows);
}

module.exports = { toolReviewDiff };
