"use strict";

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const DEFAULT_LEVEL = "info";

function getLevel() {
  const env = process.env.SCOUT_LOG_LEVEL || DEFAULT_LEVEL;
  return LEVELS[env] !== undefined ? env : DEFAULT_LEVEL;
}

function shouldLog(level) {
  const current = LEVELS[getLevel()];
  return LEVELS[level] <= current;
}

function log(level, message, meta) {
  if (!shouldLog(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
  };
  if (meta && typeof meta === "object") payload.meta = meta;
  process.stderr.write(JSON.stringify(payload) + "\n");
}

module.exports = { log };
