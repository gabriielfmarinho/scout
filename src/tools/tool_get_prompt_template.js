"use strict";

const { getPromptTemplate, savePromptTemplate } = require("../utils/prompt_templates");

async function toolGetPromptTemplate(args) {
  const { resolveProjectRoot } = require("../utils/project_root");
  const { log } = require("../utils/logger");
  const cwd = resolveProjectRoot();
  log("info", "get_prompt_template_root", { root: cwd });
  const name = args.name;
  const scope = args.scope || "all";
  const createIfMissing = Boolean(args.create_if_missing);
  const defaultContent = args.default_content || "";

  let tpl = getPromptTemplate(cwd, name, scope);
  if (!tpl && createIfMissing) {
    const saved = savePromptTemplate(cwd, name, defaultContent, scope === "global" ? "global" : "project");
    tpl = {
      name,
      scope: scope === "global" ? "global" : "project",
      path: saved,
      content: defaultContent,
    };
  }

  if (!tpl) {
    return `Template not found: ${name}`;
  }

  const lines = [];
  lines.push(`# Prompt Template: ${tpl.name}`);
  lines.push("");
  lines.push(`- Scope: ${tpl.scope}`);
  lines.push(`- Path: ${tpl.path}`);
  lines.push("");
  lines.push("```md");
  lines.push(tpl.content);
  lines.push("```");
  return lines.join("\n");
}

module.exports = { toolGetPromptTemplate };

