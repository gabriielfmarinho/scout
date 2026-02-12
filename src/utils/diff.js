"use strict";

function parseUnifiedDiff(diffText) {
  const files = [];
  const lines = diffText.split(/\r?\n/);
  let current = null;
  let currentHunk = null;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (current) files.push(current);
      current = { file: null, hunks: [] };
      currentHunk = null;
      continue;
    }

    if (!current) continue;

    if (line.startsWith("+++ b/")) {
      current.file = line.replace("+++ b/", "").trim();
      continue;
    }

    if (line.startsWith("@@")) {
      const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (match) {
        currentHunk = {
          oldStart: Number(match[1]),
          oldLines: Number(match[2] || 1),
          newStart: Number(match[3]),
          newLines: Number(match[4] || 1),
          lines: [],
        };
        current.hunks.push(currentHunk);
      }
      continue;
    }

    if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }

  if (current) files.push(current);
  return files.filter((f) => f.file);
}

module.exports = { parseUnifiedDiff };
