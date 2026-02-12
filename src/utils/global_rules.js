"use strict";

function normalizeText(text) {
  return String(text || "").trim().replace(/^\s*-\s*/, "");
}

function parsePriorityPrefix(text) {
  const raw = normalizeText(text);
  const m = raw.match(/^\[(must|required|obrigatorio|obrigatório|prefer|preferential|preferencial)\]\s*(.*)$/i);
  if (!m) return null;
  const token = m[1].toLowerCase();
  const priority = /must|required|obrig/.test(token) ? "must" : "prefer";
  return { priority, text: (m[2] || "").trim() };
}

function parseRule(text, fallbackPriority = "prefer") {
  const parsed = parsePriorityPrefix(text);
  if (parsed) return parsed;
  return { priority: fallbackPriority, text: normalizeText(text) };
}

function formatRuleLine(rule) {
  const p = rule.priority === "must" ? "must" : "prefer";
  return `- [${p}] ${rule.text}`;
}

module.exports = {
  parsePriorityPrefix,
  parseRule,
  formatRuleLine,
  normalizeText,
};

