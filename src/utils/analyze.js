"use strict";

const fs = require("fs");
const path = require("path");
const { readFileSafe } = require("./fs_utils");
const { getIndexedFiles } = require("./index_cache");
const { snippetWithLines, formatEvidence } = require("./snippet");

const MAX_FILE_BYTES = 1024 * 1024; // 1MB
const MAX_EVIDENCE = 40;

function readFileLimited(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function rel(cwd, filePath) {
  return path.relative(cwd, filePath) || filePath;
}

function findLine(content, regex) {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      return { line: i + 1, text: lines[i] };
    }
  }
  return null;
}

function evidenceFromFile(cwd, filePath, regex) {
  const content = readFileLimited(filePath);
  if (content) {
    const found = findLine(content, regex);
    if (found) {
      return formatEvidence(rel(cwd, filePath), found.line, found.line, found.text.trim());
    }
  }
  const snippet = snippetWithLines(filePath, 1, 1);
  if (!snippet) return null;
  return formatEvidence(rel(cwd, filePath), snippet.start, snippet.end, snippet.text.trim());
}

function addEvidence(evidence, topic, value, confidence, ev) {
  if (!ev || evidence.length >= MAX_EVIDENCE) return;
  evidence.push({ topic, value, confidence, evidence: ev });
}

function detectLanguages(files) {
  const langByExt = {
    ".js": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".jsx": "JavaScript",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".cs": "C#",
    ".php": "PHP",
    ".scala": "Scala",
  };
  const counts = {};
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (langByExt[ext]) counts[langByExt[ext]] = (counts[langByExt[ext]] || 0) + 1;
  }
  return Object.keys(counts)
    .map((name) => ({ name, count: counts[name] }))
    .sort((a, b) => b.count - a.count);
}

function parsePackageJson(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function analyzeProject(cwd, quick) {
  const files = getIndexedFiles(cwd);
  const relFiles = files.map((f) => rel(cwd, f));
  const evidence = [];

  const languages = detectLanguages(relFiles).map((l) => l.name);

  const buildTools = new Set();
  const frameworks = new Set();
  const infra = new Set();
  const ci = new Set();
  const architecture = new Set();
  const monorepo = new Set();
  const data = new Set();
  const test = new Set();

  const hasFile = (name) => relFiles.includes(name);
  const findFiles = (suffix) => relFiles.filter((f) => f.endsWith(suffix));

  // Build tools and JS frameworks
  const pkgPath = hasFile("package.json") ? path.join(cwd, "package.json") : null;
  if (pkgPath) {
    buildTools.add("npm");
    addEvidence(evidence, "build-tool", "npm", "high", evidenceFromFile(cwd, pkgPath, /"name"\s*:/));

    const pkg = parsePackageJson(pkgPath);
    if (pkg) {
      const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
      const depNames = Object.keys(deps || {});
      if (depNames.includes("react")) frameworks.add("React");
      if (depNames.includes("next")) frameworks.add("Next.js");
      if (depNames.includes("vue")) frameworks.add("Vue");
      if (depNames.includes("svelte")) frameworks.add("Svelte");
      if (depNames.includes("express")) frameworks.add("Express");
      if (depNames.includes("fastify")) frameworks.add("Fastify");
      if (depNames.includes("nestjs")) frameworks.add("NestJS");

      if (depNames.includes("jest")) test.add("Jest");
      if (depNames.includes("vitest")) test.add("Vitest");
      if (depNames.includes("mocha")) test.add("Mocha");
      if (depNames.includes("cypress")) test.add("Cypress");
      if (depNames.includes("playwright")) test.add("Playwright");

      if (depNames.includes("prisma")) data.add("Prisma");
      if (depNames.includes("mongoose")) data.add("MongoDB (mongoose)");
      if (depNames.includes("pg")) data.add("PostgreSQL (pg)");
      if (depNames.includes("mysql2") || depNames.includes("mysql")) data.add("MySQL");
      if (depNames.includes("redis")) data.add("Redis");
      if (depNames.includes("kafkajs")) data.add("Kafka");

      if (pkg.workspaces) monorepo.add("npm/yarn workspaces");
      if (pkg.scripts) {
        const scripts = Object.values(pkg.scripts).join(" ");
        if (/tsc/.test(scripts)) buildTools.add("tsc");
        if (/vite/.test(scripts)) buildTools.add("Vite");
        if (/webpack/.test(scripts)) buildTools.add("Webpack");
        if (/rollup/.test(scripts)) buildTools.add("Rollup");
      }

      addEvidence(evidence, "package.json", "dependencies", "high", evidenceFromFile(cwd, pkgPath, /"dependencies"\s*:/));
    }
  }

  if (hasFile("pnpm-lock.yaml")) buildTools.add("pnpm");
  if (hasFile("yarn.lock")) buildTools.add("yarn");
  if (hasFile("pnpm-workspace.yaml")) {
    monorepo.add("pnpm-workspace");
    addEvidence(evidence, "monorepo", "pnpm-workspace", "high", evidenceFromFile(cwd, path.join(cwd, "pnpm-workspace.yaml"), /packages|workspace/));
  }
  if (hasFile("turbo.json")) {
    monorepo.add("turborepo");
    addEvidence(evidence, "monorepo", "turborepo", "high", evidenceFromFile(cwd, path.join(cwd, "turbo.json"), /pipeline|tasks/));
  }
  if (hasFile("nx.json")) {
    monorepo.add("nx");
    addEvidence(evidence, "monorepo", "nx", "high", evidenceFromFile(cwd, path.join(cwd, "nx.json"), /projects|targets/));
  }
  if (hasFile("lerna.json")) {
    monorepo.add("lerna");
    addEvidence(evidence, "monorepo", "lerna", "high", evidenceFromFile(cwd, path.join(cwd, "lerna.json"), /packages/));
  }

  if (hasFile("pom.xml")) {
    buildTools.add("Maven");
    addEvidence(evidence, "build-tool", "Maven", "high", evidenceFromFile(cwd, path.join(cwd, "pom.xml"), /<project>/));
  }
  if (findFiles("build.gradle").length || findFiles("build.gradle.kts").length) {
    buildTools.add("Gradle");
    const gradle = findFiles("build.gradle")[0] || findFiles("build.gradle.kts")[0];
    addEvidence(evidence, "build-tool", "Gradle", "high", evidenceFromFile(cwd, path.join(cwd, gradle), /plugins|dependencies/));
  }
  if (hasFile("go.mod")) {
    buildTools.add("Go modules");
    addEvidence(evidence, "build-tool", "Go modules", "high", evidenceFromFile(cwd, path.join(cwd, "go.mod"), /module/));
  }
  if (hasFile("Cargo.toml")) {
    buildTools.add("Cargo");
    addEvidence(evidence, "build-tool", "Cargo", "high", evidenceFromFile(cwd, path.join(cwd, "Cargo.toml"), /\[package\]/));
  }

  // JVM frameworks
  const buildFiles = findFiles("pom.xml").concat(findFiles("build.gradle"), findFiles("build.gradle.kts"));
  for (const bf of buildFiles) {
    const full = path.join(cwd, bf);
    const content = readFileLimited(full) || "";
    if (/spring-boot|springframework/.test(content)) {
      frameworks.add("Spring");
      addEvidence(evidence, "framework", "Spring", "high", evidenceFromFile(cwd, full, /spring-boot|springframework/));
    }
    if (/ktor/.test(content)) {
      frameworks.add("Ktor");
      addEvidence(evidence, "framework", "Ktor", "medium", evidenceFromFile(cwd, full, /ktor/));
    }
  }

  // Infra and CI
  if (hasFile("Dockerfile")) {
    infra.add("Dockerfile");
    addEvidence(evidence, "infra", "Dockerfile", "high", evidenceFromFile(cwd, path.join(cwd, "Dockerfile"), /FROM/));
  }
  if (hasFile("docker-compose.yml") || hasFile("docker-compose.yaml")) {
    infra.add("Docker Compose");
    const compose = hasFile("docker-compose.yml") ? "docker-compose.yml" : "docker-compose.yaml";
    addEvidence(evidence, "infra", "Docker Compose", "high", evidenceFromFile(cwd, path.join(cwd, compose), /services:/));
  }
  if (relFiles.some((f) => f.endsWith(".tf"))) {
    infra.add("Terraform");
    const tf = relFiles.find((f) => f.endsWith(".tf"));
    addEvidence(evidence, "infra", "Terraform", "medium", evidenceFromFile(cwd, path.join(cwd, tf), /resource|provider/));
  }
  if (hasFile("Chart.yaml")) {
    infra.add("Helm");
    addEvidence(evidence, "infra", "Helm", "high", evidenceFromFile(cwd, path.join(cwd, "Chart.yaml"), /apiVersion|name/));
  }
  if (relFiles.some((f) => f.includes(".github/workflows/"))) {
    ci.add("GitHub Actions");
    const wf = relFiles.find((f) => f.includes(".github/workflows/"));
    addEvidence(evidence, "ci", "GitHub Actions", "high", evidenceFromFile(cwd, path.join(cwd, wf), /jobs:/));
  }
  if (hasFile(".gitlab-ci.yml")) {
    ci.add("GitLab CI");
    addEvidence(evidence, "ci", "GitLab CI", "high", evidenceFromFile(cwd, path.join(cwd, ".gitlab-ci.yml"), /stages:|jobs:/));
  }
  if (hasFile("Jenkinsfile")) {
    ci.add("Jenkins");
    addEvidence(evidence, "ci", "Jenkins", "high", evidenceFromFile(cwd, path.join(cwd, "Jenkinsfile"), /pipeline|stage/));
  }
  if (hasFile("azure-pipelines.yml")) {
    ci.add("Azure Pipelines");
    addEvidence(evidence, "ci", "Azure Pipelines", "high", evidenceFromFile(cwd, path.join(cwd, "azure-pipelines.yml"), /steps:|stages:/));
  }
  if (hasFile(".circleci/config.yml")) {
    ci.add("CircleCI");
    addEvidence(evidence, "ci", "CircleCI", "high", evidenceFromFile(cwd, path.join(cwd, ".circleci/config.yml"), /jobs:|workflows:/));
  }

  // Kubernetes manifests
  const yamlFiles = relFiles.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  for (const yml of yamlFiles) {
    const full = path.join(cwd, yml);
    const content = readFileLimited(full);
    if (!content) continue;
    if (/apiVersion:\s*apps\//.test(content) && /kind:\s*(Deployment|StatefulSet|DaemonSet|Service)/.test(content)) {
      infra.add("Kubernetes");
      addEvidence(evidence, "infra", "Kubernetes", "medium", evidenceFromFile(cwd, full, /kind:\s*(Deployment|StatefulSet|DaemonSet|Service)/));
      break;
    }
  }

  // Architecture heuristics
  if (relFiles.some((f) => f.includes("/src/domain/")) && relFiles.some((f) => f.includes("/src/infra/"))) {
    architecture.add("Hexagonal/Clean (domain + infra)");
  }
  if (relFiles.some((f) => f.includes("/src/main/java/")) || relFiles.some((f) => f.includes("/src/main/kotlin/"))) {
    architecture.add("JVM layered (src/main)");
  }
  if (relFiles.some((f) => f.startsWith("apps/")) && relFiles.some((f) => f.startsWith("packages/"))) {
    architecture.add("Monorepo (apps/packages)");
  }
  if (relFiles.some((f) => f.startsWith("cmd/")) && relFiles.some((f) => f.startsWith("internal/"))) {
    architecture.add("Go standard layout");
  }

  return {
    languages,
    buildTools: Array.from(buildTools),
    frameworks: Array.from(frameworks),
    infra: Array.from(infra),
    ci: Array.from(ci),
    architecture: Array.from(architecture),
    monorepo: Array.from(monorepo),
    data: Array.from(data),
    test: Array.from(test),
    evidence,
  };
}

module.exports = { analyzeProject };
