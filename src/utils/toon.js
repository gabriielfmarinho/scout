"use strict";

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str.replace(/\|/g, "\\|").replace(/\r?\n/g, "\\n");
}

function formatToon(headers, rows) {
  const lines = [];
  lines.push("#TOON");
  lines.push(headers.map(escapeCell).join(" | "));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(" | "));
  }
  return lines.join("\n");
}

module.exports = { formatToon, escapeCell };
