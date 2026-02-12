"use strict";

const { toolGetContextBundle } = require("./tool_get_context_bundle");
const { toolAnalyzeProject } = require("./tool_analyze_project");
const { toolSearchProject } = require("./tool_search_project");
const { toolAnalyzeImpact } = require("./tool_analyze_impact");
const { toolReviewDiff } = require("./tool_review_diff");
const { toolDetectDrift } = require("./tool_detect_drift");
const { toolCompressContext } = require("./tool_compress_context");
const { toolPreparePr } = require("./tool_prepare_pr");
const { toolDevlogAppend } = require("./tool_devlog_append");
const { toolUpdateGlobalContext } = require("./tool_update_global_context");
const { toolSetActiveProject } = require("./tool_set_active_project");
const { toolGetProjectRoot } = require("./tool_get_project_root");
const { toolQueryStructure } = require("./tool_query_structure");
const { toolGenerateProjectBrief } = require("./tool_generate_project_brief");
const { toolListPromptTemplates } = require("./tool_list_prompt_templates");
const { toolGetPromptTemplate } = require("./tool_get_prompt_template");
const { validateSchema } = require("../utils/validate");
const { getToolDefaults } = require("../utils/config");

const TOOLS = [
  {
    name: "get_context_bundle",
    description: "Load concise project rules/decisions/preferences with evidence-first references.",
    inputSchema: {
      type: "object",
      properties: {
        max_items: { type: "integer", minimum: 1, maximum: 200, default: 50 },
        context_pack: { type: "string", enum: ["default", "debug", "refactor", "review"], default: "default" },
        evidence_level: { type: "string", enum: ["minimal", "standard", "full"], default: "standard" },
        include_preferential: { type: "boolean", default: true },
        max_budget_items: { type: "integer", minimum: 1, maximum: 300, default: 30 },
        max_context_chars: { type: "integer", minimum: 1000, maximum: 100000, default: 10000 },
        max_per_file: { type: "integer", minimum: 1, maximum: 50, default: 5 },
      },
      additionalProperties: false,
    },
    handler: toolGetContextBundle,
  },
  {
    name: "analyze_project",
    description: "Analyze repo architecture, language, build tools, frameworks, and persist fingerprint/architecture docs.",
    inputSchema: {
      type: "object",
      properties: {
        quick: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
    handler: toolAnalyzeProject,
  },
  {
    name: "search_project",
    description: "Search repository code using keyword or hybrid mode with evidence snippets and scores.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        mode: { type: "string", enum: ["keyword", "hybrid"], default: "keyword" },
        context_pack: { type: "string", enum: ["default", "debug", "refactor", "review"], default: "default" },
        evidence_level: { type: "string", enum: ["minimal", "standard", "full"], default: "standard" },
        max_budget_items: { type: "integer", minimum: 1, maximum: 300, default: 30 },
        max_context_chars: { type: "integer", minimum: 1000, maximum: 100000, default: 10000 },
        max_per_file: { type: "integer", minimum: 1, maximum: 50, default: 5 },
        max_results: { type: "integer", minimum: 1, maximum: 200, default: 50 },
        max_snippet_lines: { type: "integer", minimum: 1, maximum: 20, default: 8 },
        max_files: { type: "integer", minimum: 100, maximum: 20000, default: 2000 },
        max_file_bytes: { type: "integer", minimum: 1024, maximum: 5242880, default: 524288 },
        max_ms: { type: "integer", minimum: 1000, maximum: 120000, default: 20000 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    handler: toolSearchProject,
  },
  {
    name: "analyze_impact",
    description: "Assess impact of a change target (file/symbol/term) with evidence-based affected components and risk.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string" },
        context_pack: { type: "string", enum: ["default", "debug", "refactor", "review"], default: "default" },
        evidence_level: { type: "string", enum: ["minimal", "standard", "full"], default: "standard" },
        max_budget_items: { type: "integer", minimum: 1, maximum: 300, default: 30 },
        max_context_chars: { type: "integer", minimum: 1000, maximum: 100000, default: 10000 },
        max_per_file: { type: "integer", minimum: 1, maximum: 50, default: 5 },
        max_results: { type: "integer", minimum: 1, maximum: 200, default: 50 },
      },
      required: ["target"],
      additionalProperties: false,
    },
    handler: toolAnalyzeImpact,
  },
  {
    name: "review_diff",
    description: "Review git diff with evidence-first findings (bugs/tests/observability/etc.) and severity filtering.",
    inputSchema: {
      type: "object",
      properties: {
        focus: { type: "string", enum: ["all", "bugs", "tests", "observability", "style"], default: "all" },
        min_severity: { type: "string", enum: ["low", "medium", "high"], default: "low" },
        staged: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
    handler: toolReviewDiff,
  },
  {
    name: "detect_drift",
    description: "Detect confirmed drift from explicit rules in active context and fingerprint.",
    inputSchema: {
      type: "object",
      properties: {
        max_results: { type: "integer", minimum: 1, maximum: 200, default: 50 },
        context_pack: { type: "string", enum: ["default", "debug", "refactor", "review"], default: "default" },
        evidence_level: { type: "string", enum: ["minimal", "standard", "full"], default: "standard" },
        max_budget_items: { type: "integer", minimum: 1, maximum: 300, default: 30 },
        max_context_chars: { type: "integer", minimum: 1000, maximum: 100000, default: 10000 },
        max_per_file: { type: "integer", minimum: 1, maximum: 50, default: 5 },
      },
      additionalProperties: false,
    },
    handler: toolDetectDrift,
  },
  {
    name: "compress_context",
    description: "Compress project context into stable docs (active-context, decisions, glossary) with minimal tokens.",
    inputSchema: {
      type: "object",
      properties: {
        max_bullets: { type: "integer", minimum: 5, maximum: 100, default: 30 },
      },
      additionalProperties: false,
    },
    handler: toolCompressContext,
  },
  {
    name: "generate_project_brief",
    description: "Generate a structured project brief (flows, integrations, runtime config, conventions, hotspots) with evidence.",
    inputSchema: {
      type: "object",
      properties: {
        context_pack: { type: "string", enum: ["default", "debug", "refactor", "review"], default: "default" },
      },
      additionalProperties: false,
    },
    handler: toolGenerateProjectBrief,
  },
  {
    name: "query_structure",
    description: "Run structured repository queries (who-calls/what-calls/find-symbol) against structural index.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["who_calls", "what_calls", "find_symbol"], default: "who_calls" },
        target: { type: "string" },
        max_results: { type: "integer", minimum: 1, maximum: 200, default: 50 },
        context_pack: { type: "string", enum: ["default", "debug", "refactor", "review"], default: "default" },
        evidence_level: { type: "string", enum: ["minimal", "standard", "full"], default: "standard" },
      },
      required: ["target"],
      additionalProperties: false,
    },
    handler: toolQueryStructure,
  },
  {
    name: "list_prompt_templates",
    description: "List reusable prompt templates from project/global template directories.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["project", "global", "all"], default: "all" },
      },
      additionalProperties: false,
    },
    handler: toolListPromptTemplates,
  },
  {
    name: "get_prompt_template",
    description: "Load a prompt template by file name from project/global directories. Can optionally create missing templates.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        scope: { type: "string", enum: ["project", "global", "all"], default: "all" },
        create_if_missing: { type: "boolean", default: false },
        default_content: { type: "string", default: "" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    handler: toolGetPromptTemplate,
  },
  {
    name: "prepare_pr",
    description: "Prepare PR description using git diff plus optional review/impact.",
    inputSchema: {
      type: "object",
      properties: {
        include_review: { type: "boolean", default: true },
        include_impact: { type: "boolean", default: true },
      },
      additionalProperties: false,
    },
    handler: toolPreparePr,
  },
  {
    name: "devlog_append",
    description: "Append a structured devlog event after relevant analysis or code change.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string" },
        summary: { type: "string" },
        files: { type: "array", items: { type: "string" }, default: [] },
        tags: { type: "array", items: { type: "string" }, default: [] }
      },
      required: ["type", "summary"],
      additionalProperties: false,
    },
    handler: toolDevlogAppend,
  },
  {
    name: "update_global_context",
    description: "Update global user preferences context stored outside the repo.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["append", "replace"], default: "append" },
        priority: { type: "string", enum: ["must", "prefer"], default: "prefer" },
        strict_priority: { type: "boolean", default: true },
        entries: { type: "array", items: { type: "string" }, default: [] },
      },
      required: ["entries"],
      additionalProperties: false,
    },
    handler: toolUpdateGlobalContext,
  },
  {
    name: "set_active_project",
    description: "Set the active project root used by Scout when IDE does not provide it.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" }
      },
      required: ["path"],
      additionalProperties: false,
    },
    handler: toolSetActiveProject,
  },
  {
    name: "get_project_root",
    description: "Return the resolved project root and active project state.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: toolGetProjectRoot,
  },
];

function listTools() {
  return TOOLS.map(({ handler, ...t }) => t);
}

async function callTool(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    return {
      content: [
        { type: "text", text: `Unknown tool: ${name}` },
      ],
      isError: true,
    };
  }
  const defaults = getToolDefaults(name);
  const merged = { ...defaults, ...(args || {}) };
  const errors = validateSchema(tool.inputSchema, merged);
  if (errors.length) {
    return {
      content: [{ type: "text", text: `Invalid arguments: ${errors.join("; ")}` }],
      isError: true,
    };
  }

  const text = await tool.handler(merged);
  return {
    content: [{ type: "text", text }],
  };
}

module.exports = { listTools, callTool };
