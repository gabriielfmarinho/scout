"use strict";

const fs = require("fs");
const path = require("path");
const { ensureProjectDirs } = require("./paths");
const { updateIndex, loadIndex } = require("./index_cache");
const { readFileSafe, isTextFile } = require("./fs_utils");
const { formatEvidence } = require("./snippet");

const STRUCT_VERSION = 1;
const MAX_FILE_BYTES = 1024 * 1024; // 1MB

const KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "return", "new",
  "function", "class", "import", "require", "typeof", "await",
  "console", "Math", "Object", "Array", "Number", "String", "Boolean",
  "setTimeout", "setInterval",
]);

function rel(cwd, filePath) {
  return path.relative(cwd, filePath) || filePath;
}

function getStructPath(cwd) {
  const projectPaths = ensureProjectDirs(cwd);
  return path.join(projectPaths.cache, "structural_index.json");
}

function loadStructuralIndex(cwd) {
  const file = getStructPath(cwd);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {
      version: STRUCT_VERSION,
      root: cwd,
      files: {},
      symbols: [],
      calls: [],
      references: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

function saveStructuralIndex(cwd, data) {
  const file = getStructPath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function withinLimit(filePath) {
  try {
    const st = fs.statSync(filePath);
    return st.size <= MAX_FILE_BYTES;
  } catch {
    return false;
  }
}

function parseSymbols(relFile, content) {
  const out = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (m) out.push({ name: m[1], type: "function", line: i + 1 });

    m = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?\(/);
    if (m) out.push({ name: m[1], type: "function", line: i + 1 });

    m = line.match(/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (m) out.push({ name: m[1], type: "class", line: i + 1 });

    m = line.match(/^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (m) out.push({ name: m[1], type: "function", line: i + 1 });
  }
  return out.map((s) => ({
    ...s,
    file: relFile,
    evidence: formatEvidence(relFile, s.line, s.line, lines[s.line - 1] || ""),
  }));
}

function nearestSymbol(symbols, line) {
  let winner = null;
  for (const s of symbols) {
    if (s.line <= line && (!winner || s.line > winner.line)) winner = s;
  }
  return winner;
}

function parseCalls(relFile, content, symbols) {
  const calls = [];
  const refs = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const regex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    let m;
    while ((m = regex.exec(line)) !== null) {
      const callee = m[1];
      if (KEYWORDS.has(callee)) continue;
      if (callee.length < 2) continue;
      const caller = nearestSymbol(symbols, lineNum);
      calls.push({
        file: relFile,
        caller: caller ? caller.name : "<file>",
        callerLine: caller ? caller.line : lineNum,
        callee,
        line: lineNum,
        evidence: formatEvidence(relFile, lineNum, lineNum, line.trim()),
      });
    }
  }

  for (const s of symbols) {
    const nameRe = new RegExp(`\\b${s.name}\\b`, "g");
    for (let i = 0; i < lines.length; i++) {
      if (i + 1 === s.line) continue;
      if (!nameRe.test(lines[i])) continue;
      refs.push({
        symbol: s.name,
        file: relFile,
        line: i + 1,
        evidence: formatEvidence(relFile, i + 1, i + 1, lines[i].trim()),
      });
      if (refs.length > 5000) break;
    }
  }

  return { calls, references: refs };
}

function analyzeFileStructure(cwd, fullPath) {
  if (!isTextFile(fullPath)) return null;
  if (!withinLimit(fullPath)) return null;
  const content = readFileSafe(fullPath);
  if (!content) return null;
  const relFile = rel(cwd, fullPath);
  const symbols = parseSymbols(relFile, content);
  const { calls, references } = parseCalls(relFile, content, symbols);
  return { file: relFile, symbols, calls, references };
}

function rebuildAggregates(index) {
  const symbols = [];
  const calls = [];
  const references = [];
  for (const fileInfo of Object.values(index.files)) {
    if (!fileInfo || !fileInfo.analysis) continue;
    symbols.push(...(fileInfo.analysis.symbols || []));
    calls.push(...(fileInfo.analysis.calls || []));
    references.push(...(fileInfo.analysis.references || []));
  }
  index.symbols = symbols;
  index.calls = calls;
  index.references = references;
}

function updateStructuralIndex(cwd) {
  const fileIndex = updateIndex(cwd);
  const oldStruct = loadStructuralIndex(cwd);

  const next = {
    version: STRUCT_VERSION,
    root: cwd,
    files: oldStruct.files || {},
    symbols: [],
    calls: [],
    references: [],
    updatedAt: new Date().toISOString(),
  };

  for (const relFile of Object.keys(next.files)) {
    if (!fileIndex.files[relFile]) delete next.files[relFile];
  }

  for (const [relFile, fmeta] of Object.entries(fileIndex.files)) {
    const prev = next.files[relFile];
    const hash = fmeta.hash || `${fmeta.mtimeMs}:${fmeta.size}`;
    const changed = !prev || prev.hash !== hash;
    if (!changed) continue;

    const fullPath = path.join(cwd, relFile);
    const analysis = analyzeFileStructure(cwd, fullPath);
    next.files[relFile] = { hash, analysis: analysis || { symbols: [], calls: [], references: [] } };
  }

  rebuildAggregates(next);
  saveStructuralIndex(cwd, next);
  return next;
}

function findWhoCalls(cwd, symbol, maxResults = 50) {
  const idx = updateStructuralIndex(cwd);
  const target = String(symbol || "").trim();
  const lower = target.toLowerCase();
  return idx.calls
    .filter((c) => c.callee.toLowerCase() === lower)
    .slice(0, maxResults);
}

function findWhatCalls(cwd, caller, maxResults = 50) {
  const idx = updateStructuralIndex(cwd);
  const target = String(caller || "").trim().toLowerCase();
  return idx.calls
    .filter((c) => c.caller.toLowerCase() === target)
    .slice(0, maxResults);
}

function findSymbol(cwd, symbol, maxResults = 50) {
  const idx = updateStructuralIndex(cwd);
  const target = String(symbol || "").trim().toLowerCase();
  return idx.symbols
    .filter((s) => s.name.toLowerCase() === target)
    .slice(0, maxResults);
}

module.exports = {
  updateStructuralIndex,
  loadStructuralIndex,
  findWhoCalls,
  findWhatCalls,
  findSymbol,
};

