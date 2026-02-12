"use strict";

const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { readFileSafe, isTextFile } = require("./fs_utils");
const { snippetWithLines, formatEvidence } = require("./snippet");
const { getIndexedFiles } = require("./index_cache");
const { isGitRepo, runGit } = require("./git");
const { findSymbol } = require("./structural_index");

let RG_AVAILABLE = null;

const DEFAULT_MAX_FILES = 2000;
const DEFAULT_MAX_FILE_BYTES = 512 * 1024; // 512KB
const DEFAULT_MAX_MS = 20000;

function hasRipgrep() {
  if (RG_AVAILABLE !== null) return RG_AVAILABLE;
  try {
    execFileSync("rg", ["--version"], { stdio: "ignore" });
    RG_AVAILABLE = true;
  } catch {
    RG_AVAILABLE = false;
  }
  return RG_AVAILABLE;
}

function getGitFiles(cwd) {
  if (!isGitRepo(cwd)) return null;
  try {
    const out = runGit(["ls-files"], { cwd });
    return out.split(/\r?\n/).filter(Boolean).map((f) => path.join(cwd, f));
  } catch {
    return null;
  }
}

function scoreMatch(filePath, line, queryTerms) {
  let score = 0;
  const lowerLine = line.toLowerCase();
  for (const term of queryTerms) {
    if (lowerLine.includes(term)) score += 1;
  }
  const baseName = path.basename(filePath).toLowerCase();
  for (const term of queryTerms) {
    if (baseName.includes(term)) score += 2;
  }
  return score;
}

function searchInFile(filePath, queryTerms, maxSnippetLines) {
  const content = readFileSafe(filePath);
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const matches = [];

  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    if (queryTerms.every((t) => lowerLine.includes(t))) {
      const start = Math.max(1, i + 1 - Math.floor(maxSnippetLines / 2));
      const end = Math.min(lines.length, start + maxSnippetLines - 1);
      const snippet = snippetWithLines(filePath, start, end);
      const score = scoreMatch(filePath, lines[i], queryTerms);
      matches.push({
        file: filePath,
        line: i + 1,
        score,
        snippet,
      });
    }
  }

  return matches;
}

function timeExceeded(start, maxMs) {
  return maxMs > 0 && Date.now() - start > maxMs;
}

function searchProject({ cwd, query, max_results, max_snippet_lines, max_files, max_file_bytes, max_ms }) {
  const terms = query
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (hasRipgrep()) {
    return searchProjectRg({ cwd, terms, query, max_results, max_snippet_lines, max_ms });
  }

  const files = getGitFiles(cwd) || getIndexedFiles(cwd);
  const maxFiles = Number(max_files || DEFAULT_MAX_FILES);
  const maxBytes = Number(max_file_bytes || DEFAULT_MAX_FILE_BYTES);
  const maxMs = Number(max_ms || DEFAULT_MAX_MS);
  const start = Date.now();

  const limitedFiles = files.slice(0, maxFiles);
  const results = [];
  let scanned = 0;
  let truncated = files.length > maxFiles;

  for (const file of limitedFiles) {
    if (timeExceeded(start, maxMs)) {
      truncated = true;
      break;
    }
    scanned += 1;
    if (!isTextFile(file)) continue;
    try {
      const stat = fs.statSync(file);
      if (stat.size > maxBytes) continue;
    } catch {
      continue;
    }
    const matches = searchInFile(file, terms, max_snippet_lines);
    for (const match of matches) {
      results.push(match);
      if (results.length >= max_results * 3) break;
    }
    if (results.length >= max_results * 3) break;
  }

  results.sort((a, b) => b.score - a.score);
  const mapped = results.slice(0, max_results).map((r) => {
    const relFile = path.relative(cwd, r.file) || r.file;
    const evidence = r.snippet
      ? formatEvidence(relFile, r.snippet.start, r.snippet.end, r.snippet.text)
      : `${relFile}:${r.line}`;
    return {
      file: relFile,
      symbol_or_section: `line ${r.line}`,
      score: r.score,
      reason: "query terms match",
      evidence,
    };
  });

  if (truncated) {
    mapped.push({
      file: "",
      symbol_or_section: "meta",
      score: 0,
      reason: "search truncated",
      evidence: `scanned=${scanned} max_files=${maxFiles} max_ms=${maxMs}`,
    });
  }

  return mapped;
}

function searchProjectRg({ cwd, terms, query, max_results, max_snippet_lines, max_ms }) {
  if (!terms.length) return [];
  const start = Date.now();
  const primary = terms[0];
  const args = ["--json", "-n", "--fixed-strings", "-i", primary, cwd];
  let output = "";
  try {
    output = execFileSync("rg", args, { encoding: "utf8" });
  } catch (err) {
    const stdout = err && err.stdout ? String(err.stdout) : "";
    output = stdout;
  }

  const lines = output.split(/\r?\n/).filter(Boolean);
  const matches = [];
  for (const line of lines) {
    if (timeExceeded(start, Number(max_ms || DEFAULT_MAX_MS))) break;
    try {
      const obj = JSON.parse(line);
      if (obj.type !== "match") continue;
      const data = obj.data;
      const filePath = data.path.text;
      const lineText = data.lines.text;
      const lineNum = data.line_number;
      const lowerLine = lineText.toLowerCase();
      if (!terms.every((t) => lowerLine.includes(t))) continue;
      const snippet = snippetWithLines(filePath, Math.max(1, lineNum - Math.floor(max_snippet_lines / 2)), lineNum + Math.floor(max_snippet_lines / 2));
      const score = scoreMatch(filePath, lineText, terms);
      matches.push({ file: filePath, line: lineNum, score, snippet });
      if (matches.length >= max_results * 3) break;
    } catch {
      continue;
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const mapped = matches.slice(0, max_results).map((r) => {
    const relFile = path.relative(cwd, r.file) || r.file;
    const evidence = r.snippet
      ? formatEvidence(relFile, r.snippet.start, r.snippet.end, r.snippet.text)
      : `${relFile}:${r.line}`;
    return {
      file: relFile,
      symbol_or_section: `line ${r.line}`,
      score: r.score,
      reason: "query terms match",
      evidence,
    };
  });

  return mapped;
}

function searchProjectHybrid({ cwd, query, max_results, max_snippet_lines, max_files, max_file_bytes, max_ms }) {
  const raw = searchProject({ cwd, query, max_results: max_results * 3, max_snippet_lines, max_files, max_file_bytes, max_ms });
  const terms = query
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const symbolHits = new Set();
  for (const t of terms) {
    const defs = findSymbol(cwd, t, 5);
    if (defs.length) symbolHits.add(t);
  }

  const boosted = raw.map((r) => {
    let score = Number(r.score) || 0;
    const lowerFile = path.basename(r.file).toLowerCase();
    for (const term of terms) {
      if (lowerFile.includes(term)) score += 2;
      if (symbolHits.has(term) && r.evidence.toLowerCase().includes(term)) score += 3;
    }
    return { ...r, score };
  });

  boosted.sort((a, b) => b.score - a.score);
  return boosted.slice(0, max_results);
}

module.exports = { searchProject, searchProjectHybrid };
