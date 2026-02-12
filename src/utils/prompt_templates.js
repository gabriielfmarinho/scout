"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { readFileSafe, writeFileEnsureDir } = require("./fs_utils");

function getTemplateRoots(projectRoot) {
  return {
    project: path.join(projectRoot, "prompts"),
    global: path.join(os.homedir(), ".engineering-ai", "prompts"),
  };
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    // ignore
  }
}

function listTemplateFiles(rootDir) {
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => name.toLowerCase().endsWith(".md"))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function safeResolveTemplatePath(rootDir, templateName) {
  const normalized = String(templateName || "").trim();
  if (!normalized) return null;
  if (normalized.includes("..") || normalized.includes("/") || normalized.includes("\\")) return null;
  if (!normalized.toLowerCase().endsWith(".md")) return null;
  const fullPath = path.resolve(rootDir, normalized);
  const rootPath = path.resolve(rootDir) + path.sep;
  if (!fullPath.startsWith(rootPath)) return null;
  return fullPath;
}

function extractTitle(content, fallback) {
  const lines = String(content || "").split(/\r?\n/);
  const h1 = lines.find((l) => /^#\s+/.test(l));
  if (h1) return h1.replace(/^#\s+/, "").trim();
  return fallback;
}

function listPromptTemplates(projectRoot, scope = "all") {
  const roots = getTemplateRoots(projectRoot);
  ensureDir(roots.global);
  const targets = scope === "project"
    ? [{ scope: "project", root: roots.project }]
    : scope === "global"
      ? [{ scope: "global", root: roots.global }]
      : [{ scope: "project", root: roots.project }, { scope: "global", root: roots.global }];

  const rows = [];
  for (const t of targets) {
    const files = listTemplateFiles(t.root);
    for (const file of files) {
      const fullPath = path.join(t.root, file);
      const content = readFileSafe(fullPath) || "";
      rows.push({
        scope: t.scope,
        name: file,
        title: extractTitle(content, file.replace(/\.md$/i, "")),
        path: fullPath,
      });
    }
  }
  return rows;
}

function getPromptTemplate(projectRoot, templateName, scope = "all") {
  const roots = getTemplateRoots(projectRoot);
  ensureDir(roots.global);
  const checks = scope === "project"
    ? [roots.project]
    : scope === "global"
      ? [roots.global]
      : [roots.project, roots.global];

  for (const rootDir of checks) {
    const filePath = safeResolveTemplatePath(rootDir, templateName);
    if (!filePath) continue;
    const content = readFileSafe(filePath);
    if (!content) continue;
    return {
      name: templateName,
      scope: rootDir === roots.project ? "project" : "global",
      path: filePath,
      content,
    };
  }
  return null;
}

function savePromptTemplate(projectRoot, templateName, content, scope = "project") {
  const roots = getTemplateRoots(projectRoot);
  const rootDir = scope === "global" ? roots.global : roots.project;
  ensureDir(rootDir);
  const filePath = safeResolveTemplatePath(rootDir, templateName);
  if (!filePath) {
    throw new Error("Invalid template name. Use a plain .md file name.");
  }
  writeFileEnsureDir(filePath, String(content || ""));
  return filePath;
}

module.exports = {
  listPromptTemplates,
  getPromptTemplate,
  savePromptTemplate,
};

