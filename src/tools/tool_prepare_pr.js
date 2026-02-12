"use strict";

const { isGitRepo, getDiff, runGit } = require("../utils/git");
const { parseUnifiedDiff } = require("../utils/diff");
const { toolReviewDiff } = require("./tool_review_diff");
const { toolAnalyzeImpact } = require("./tool_analyze_impact");

function summarizeDiff(parsed) {
  const files = parsed.map((f) => f.file);
  return files.length ? files.join(", ") : "No files changed";
}

async function toolPreparePr(args) {
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "prepare_pr_root", { root: cwd });
  if (!isGitRepo(cwd)) {
    return "Not a git repository.";
  }

  let diff = "";
  try {
    diff = getDiff(cwd, false);
  } catch (err) {
    return `git diff failed: ${String(err.message || err)}`;
  }
  if (!diff.trim()) {
    return "No changes detected.";
  }

  const parsed = parseUnifiedDiff(diff);
  const summary = summarizeDiff(parsed);

  let impactSection = "";
  if (args.include_impact !== false) {
    const impact = await toolAnalyzeImpact({ target: summary, max_results: 5 });
    impactSection = `\n## Impact\n\n${impact}\n`;
  }

  let reviewSection = "";
  if (args.include_review !== false) {
    const review = await toolReviewDiff({ focus: "all", min_severity: "low", staged: false });
    reviewSection = `\n## Review Notes\n\n${review}\n`;
  }

  let stats = "";
  try {
    stats = runGit(["diff", "--stat"], { cwd });
  } catch {
    stats = "";
  }

  const md = [];
  md.push("# PR Summary");
  md.push("");
  md.push("## What changed");
  md.push("");
  md.push(`- Files: ${summary}`);
  if (stats) {
    md.push("- Diffstat:");
    md.push("```text");
    md.push(stats);
    md.push("```");
  }
  md.push("");
  md.push("## Why");
  md.push("");
  md.push("- <fill in intent>");
  md.push("");
  md.push("## How to test");
  md.push("");
  md.push("- <commands / steps>");
  md.push("");
  md.push("## Risk level");
  md.push("");
  md.push("- <low|medium|high + rationale>");

  return md.join("\n") + impactSection + reviewSection;
}

module.exports = { toolPreparePr };
