"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), ".engineering-ai", "scout.json");
let cached = null;

function loadConfig() {
  if (cached) return cached;
  const envPath = process.env.SCOUT_CONFIG_PATH;
  const configPath = envPath || DEFAULT_CONFIG_PATH;
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    cached = JSON.parse(raw);
  } catch {
    cached = {};
  }
  return cached;
}

function getToolDefaults(toolName) {
  const cfg = loadConfig();
  if (!cfg || !cfg.defaults) return {};
  return cfg.defaults[toolName] || {};
}

module.exports = { loadConfig, getToolDefaults, DEFAULT_CONFIG_PATH };
