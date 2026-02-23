"use strict";

const { getGlobalContextPath, ensureGlobalSpecialists, loadGlobalEntries } = require("./global_specialized_context");

let cachedItems = null;

function loadGlobalContextCached(forceReload = false, options = {}) {
  if ((!cachedItems || forceReload)) {
    ensureGlobalSpecialists();
    cachedItems = loadGlobalEntries({ topics: ["all"] });
  }
  const topics = Array.isArray(options.topics) ? options.topics : ["all"];
  if (topics.includes("all")) return cachedItems;
  const wanted = new Set(topics);
  return cachedItems.filter((item) => wanted.has(item.topic));
}

function invalidateGlobalContextCache() {
  cachedItems = null;
}

function preloadGlobalContextCache() {
  return loadGlobalContextCached(false);
}

module.exports = {
  getGlobalContextPath,
  loadGlobalContextCached,
  invalidateGlobalContextCache,
  preloadGlobalContextCache,
};
