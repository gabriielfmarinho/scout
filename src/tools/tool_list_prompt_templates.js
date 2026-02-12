"use strict";

const { formatToon } = require("../utils/toon");
const { listPromptTemplates } = require("../utils/prompt_templates");

async function toolListPromptTemplates(args) {
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "list_prompt_templates_root", { root: cwd });
  const scope = args.scope || "all";
  const rows = listPromptTemplates(cwd, scope).map((t) => [
    t.scope,
    t.name,
    t.title,
    t.path,
  ]);
  if (!rows.length) {
    rows.push([scope, "", "No templates found", ""]);
  }
  return formatToon(["scope", "name", "title", "path"], rows);
}

module.exports = { toolListPromptTemplates };

