"use strict";

const fs = require("fs");
const path = require("path");
const { writeActiveProject } = require("../utils/active_project");
const { formatToon } = require("../utils/toon");
const { log } = require("../utils/logger");

async function toolSetActiveProject(args) {
  const root = path.resolve(String(args.path || "").trim());
  if (!root) {
    return formatToon(["status", "message"], [["error", "path is required"]]);
  }
  try {
    if (!fs.statSync(root).isDirectory()) {
      return formatToon(["status", "message"], [["error", "path is not a directory"]]);
    }
  } catch {
    return formatToon(["status", "message"], [["error", "path does not exist"]]);
  }

  const filePath = writeActiveProject(root);
  log("info", "set_active_project", { root });
  return formatToon(["status", "root", "path"], [["ok", root, filePath]]);
}

module.exports = { toolSetActiveProject };
