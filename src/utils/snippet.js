"use strict";

const { readFileSafe } = require("./fs_utils");
const { redactSecrets } = require("./redact");

function getLines(filePath) {
  const content = readFileSafe(filePath);
  if (content === null) return null;
  return content.split(/\r?\n/);
}

function snippetWithLines(filePath, startLine, endLine) {
  const lines = getLines(filePath);
  if (!lines) return null;
  const start = Math.max(1, startLine);
  const end = Math.min(lines.length, endLine);
  const slice = lines.slice(start - 1, end);
  const text = slice.join("\n");
  return {
    start,
    end,
    text,
    totalLines: lines.length,
  };
}

function formatEvidence(filePath, startLine, endLine, text) {
  return `${filePath}:${startLine}-${endLine}: ${redactSecrets(text)}`;
}

module.exports = { getLines, snippetWithLines, formatEvidence };
