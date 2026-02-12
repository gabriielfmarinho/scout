"use strict";

const fs = require("fs");
const { resolveProjectRoot } = require("../utils/project_root");
const { readActiveProject } = require("../utils/active_project");
const { formatToon } = require("../utils/toon");

async function toolGetProjectRoot() {
  const root = resolveProjectRoot();
  const active = readActiveProject();
  const exists = (() => {
    try {
      return fs.statSync(root).isDirectory();
    } catch {
      return false;
    }
  })();

  return formatToon(
    ["root", "exists", "active_root"],
    [[root, String(exists), active && active.root ? active.root : ""]]
  );
}

module.exports = { toolGetProjectRoot };
