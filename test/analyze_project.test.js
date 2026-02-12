"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { analyzeProject } = require("../src/utils/analyze");
const { ensureProjectDirs } = require("../src/utils/paths");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scout-analyze-"));
}

test("analyzeProject detects frameworks/infra/ci/monorepo", () => {
  const tmp = makeTempDir();
  const prev = process.cwd();
  process.chdir(tmp);
  ensureProjectDirs(tmp);

  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
    name: "demo",
    dependencies: { react: "18.0.0", pg: "8.0.0" },
    devDependencies: { jest: "29.0.0" }
  }, null, 2));
  fs.writeFileSync(path.join(tmp, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
  fs.mkdirSync(path.join(tmp, ".github", "workflows"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".github", "workflows", "ci.yml"), "jobs:\n  build:\n    steps: []\n");
  fs.writeFileSync(path.join(tmp, "docker-compose.yml"), "services:\n  app:\n    image: node\n");

  const result = analyzeProject(tmp, false);
  assert.ok(result.frameworks.includes("React"));
  assert.ok(result.test.includes("Jest"));
  assert.ok(result.data.some((d) => d.includes("PostgreSQL")));
  assert.ok(result.monorepo.includes("pnpm-workspace"));
  assert.ok(result.infra.includes("Docker Compose"));
  assert.ok(result.ci.includes("GitHub Actions"));

  process.chdir(prev);
});
