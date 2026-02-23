# Scout MCP Server

Scout is a local MCP (Model Context Protocol) server for software engineering context, analysis, search, and persistent project memory. It does **not** call any LLM internally. The LLM calls Scout via MCP tools over stdio.

## Key properties
- Evidence-first: every relevant statement includes file/line evidence.
- Minimal context: no full-file dumps unless necessary.
- Token-efficient: TOON for large lists, Markdown for human docs, JSON for internal cache.
- Local persistence outside the repo.
- Cross-platform: Windows, macOS, Linux.

## Architecture
Scout runs as a local process (stdio MCP server). All analysis is done on the local filesystem; no network calls are made.

## Data layout (global + per project)
```
~/.engineering-ai/
  global/
    active-context.md
    context_manifest.json
    specialists/
      coding.json
      coding.md
      security.json
      security.md
  projects/
    <project-name>/
      cache/
        fingerprint.json
        index.json
      docs/
        architecture.md
        active-context.md
        decisions.md
        glossary.md
      devlog/
        timeline.jsonl
```

### Global context
Global context is persisted canonically in `~/.engineering-ai/global/context_manifest.json` and `~/.engineering-ai/global/specialists/*.json`. `active-context.md` is an index/derived view. `get_context_bundle` supports on-demand global loading via `global_topics`.

### Project context
`~/.engineering-ai/projects/<project-name>/docs/active-context.md` stores preferences and rules specific to the current repo.

## Requirements
- Node.js 18+
- Git (for diff-based tools)

## Install
```bash
npm install
```

## Run the server
```bash
npm run start
```

Or via the CLI:
```bash
./bin/scout-mcp
```

## MCP client config example
Use your MCP client’s config format. Example generic JSON:
```json
{
  "mcpServers": {
    "scout": {
      "command": "scout-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

If your client needs a project-local config, a common pattern is a file at `.copilot/mcp-config.json` with a `servers` section. Use an absolute `command` if `scout-mcp` is not on PATH.

You can also force the project root via environment variable:
```
SCOUT_PROJECT_ROOT=/absolute/path/to/project
```

If the server starts outside the repo, Scout will try to auto-detect a single project under the current directory by looking for common markers (like `package.json`, `pom.xml`, `.git`). If exactly one is found, it uses that as root.

If you work across many projects, you can set the active project without IDE config by calling:
```json
{ "name": "set_active_project", "arguments": { "path": "/absolute/path/to/project" } }
```

You can verify the resolved root with:
```json
{ "name": "get_project_root", "arguments": {} }
```

You can also drop a `.scout` file in your project root to make root detection automatic. The file can be empty. Optionally, you can store JSON with a custom root:
```json
{ "root": "/absolute/path/to/project" }
```

## Tools

### Output formats
- **TOON**: structured tables for LLM consumption (token-efficient).
- **Markdown**: human-readable docs.
- **JSON**: internal cache only.

### Limits (token efficiency)
Many tools accept `max_results` and `max_snippet_lines`. Files larger than 1MB are skipped in analysis to control token usage.

### 1) `get_context_bundle`
When to use: before generating/modifying code or when applying preferences/patterns.

Example call:
```json
{ "name": "get_context_bundle", "arguments": { "max_items": 30 } }
```

### 2) `analyze_project`
When to use: understand architecture, languages, build tools, frameworks, infra, CI/CD, monorepo, data, and tests. Produces evidence per finding and skips files larger than 1MB for token efficiency.

Example call:
```json
{ "name": "analyze_project", "arguments": { "quick": false } }
```

### 3) `search_project`
When to use: locate code paths or behavior with context budget controls and task packs.

Example call:
```json
{ "name": "search_project", "arguments": { "query": "bucket write", "mode": "hybrid", "context_pack": "debug", "evidence_level": "minimal", "max_results": 20, "max_snippet_lines": 6, "max_files": 2000, "max_file_bytes": 524288, "max_ms": 20000 } }
```

### 4) `analyze_impact`
When to use: assess what may break if changing X. Combines structural and lexical signals.

Example call:
```json
{ "name": "analyze_impact", "arguments": { "target": "billing status", "context_pack": "refactor", "evidence_level": "standard" } }
```

Persist point-analysis into project context (merge, no full rewrite):
```json
{ "name": "analyze_impact", "arguments": { "target": "processPayment", "persist_to_context": true, "persist_topic": "flow-investigation" } }
```

### 5) `generate_project_brief`
When to use: produce a structured Project Brief (summary, flows, integrations, runtime configs, conventions, hotspots).

Example call:
```json
{ "name": "generate_project_brief", "arguments": { "context_pack": "default" } }
```

### 6) `query_structure`
When to use: run structured queries like who-calls, what-calls, and find-symbol.

Example call:
```json
{ "name": "query_structure", "arguments": { "mode": "who_calls", "target": "processPayment", "evidence_level": "minimal" } }
```

Persist point-query into project context (merge, no full rewrite):
```json
{ "name": "query_structure", "arguments": { "mode": "who_calls", "target": "processPayment", "persist_to_context": true, "persist_topic": "flow-investigation" } }
```

### 7) `review_diff`
When to use: diff review for bugs/tests/observability.

Example call:
```json
{ "name": "review_diff", "arguments": { "focus": "tests", "min_severity": "medium" } }
```

### 8) `detect_drift`
When to use: detect deviation from explicit rules in active context.

Example call:
```json
{ "name": "detect_drift", "arguments": { "max_results": 50 } }
```

### 9) `compress_context`
When to use: reduce context and update docs.

Example call:
```json
{ "name": "compress_context", "arguments": { "max_bullets": 30 } }
```

### 10) `prepare_pr`
When to use: prepare PR description from current diff.

Example call:
```json
{ "name": "prepare_pr", "arguments": { "include_review": true, "include_impact": true } }
```

### 11) `devlog_append`
When to use: after changes or relevant analysis.

Example call:
```json
{ "name": "devlog_append", "arguments": { "type": "analysis", "summary": "Analyzed billing flow", "files": ["src/billing.ts"], "tags": ["billing"] } }
```

### 12) `update_global_context`
When to use: update your global preferences (name, coding style, standards) across all projects.

Example call:
```json
{ "name": "update_global_context", "arguments": { "mode": "append", "entries": ["[must] Use explicit error handling", "[prefer] Prefer short functions", "[prefer] Name: Gabriel"] } }
```

Optional dynamic topic:
```json
{ "name": "update_global_context", "arguments": { "mode": "append", "topic": "team-playbook", "entries": ["[must] ADR required for breaking API changes"] } }
```

Structured quality-controlled entry:
```json
{ "name": "update_global_context", "arguments": { "entries_structured": [{ "topic": "team-playbook", "summary": "ADR required for breaking API changes", "rationale": "Preserve architecture decisions", "evidence": "docs/adr.md:1-1: ADR process", "confidence": "high", "owner": "architecture", "status": "approved", "priority": "must" }], "strict_quality": true } }
```

### 13) `update_project_context`
When to use: add project-scoped context rules/preferences to predefined or dynamic specialist topics.

Example call:
```json
{ "name": "update_project_context", "arguments": { "mode": "append", "topic": "domain-rules", "entries": ["[must] Maintain backward compatibility for billing payload"] } }
```

### 14) `audit_context_quality`
When to use: detect low-quality documentation/context entries (missing evidence, weak rationale, stale items).

Example call:
```json
{ "name": "audit_context_quality", "arguments": { "scope": "all", "min_quality": 75, "max_results": 200 } }
```

Quality essentials now enforced when `strict_quality=true`:
- rejects placeholder summaries (ex: `TODO`, `TBD`, `unknown`, `n/a`)
- validates evidence format and file/line range
- validates that evidence snippet matches the referenced lines
- enforces status workflow transitions (`draft -> reviewed -> approved -> deprecated`)

## Evidence-first behavior
All analysis and search outputs include evidence in the form:
```
<file>:<start>-<end>: <snippet>
```
This allows the LLM to verify claims and reduces hallucination.

## Context window management
- Every major retrieval tool supports `context_pack` (`default|debug|refactor|review`).
- Retrieval tools support `evidence_level` (`minimal|standard|full`) to control context size.
- Tools apply budget controls (`max_budget_items`, `max_context_chars`, `max_per_file`) with deduplication by evidence.
- Structural index and project brief are persisted to disk, so heavy analysis stays outside the model context window.
- Tool-level telemetry is persisted to `cache/telemetry.jsonl` for context and truncation monitoring.
- Global rules support priorities: `[must]` and `[prefer]`.
- `[must]` rules are always included in `get_context_bundle`; `[prefer]` rules are budgeted/on-demand.
- Progressive disclosure: specialist context files are indexed in `cache/context_manifest.json` and loaded by topic/cursor on demand.
- Dynamic topics: both project and global contexts accept dynamic specialist topics in addition to predefined ones.
- Lossless persistence: canonical context is stored in full specialist files under `cache/specialists/*.json`; pagination limits response size, not stored data.
- Automatic quality metadata: persisted entries keep `summary`, `rationale`, `owner`, `confidence`, `status`, `quality_score`, and `quality_issues`.
- Analysis merges with quality fields: `analyze_impact` and `query_structure` persist structured entries (not only raw text) when `persist_to_context=true`.

## Canonical persistence
- `cache/project_brief.json` is the canonical project intelligence snapshot.
- `cache/fingerprint.json` and `docs/architecture.md` are derived from the brief to keep outputs cohesive.
- `docs/active-context.md` is generated from the brief (plus recent devlog) by `compress_context`.

## Why Scout
- Lean context control: task packs, evidence levels, and strict context budget.
- Evidence-first outputs: every relevant claim can be traced back to file/line.
- Canonical project intelligence: one source of truth (`project_brief.json`) with derived artifacts.
- Structural understanding: symbol/call/reference indexing with deterministic queries.
- Incremental analysis: reuses unchanged file intelligence to keep re-analysis fast.
- Context telemetry: tracks truncation and latency per tool execution.

## Prompt Catalog (Abstract)
Use these prompts directly with your coding agent. They are tool-agnostic and focus on outcomes.

### 1) Quick Onboarding
```text
Give me a concise technical overview of this repository focused on "<topic>".
I want only essential context, with evidence for each key statement.
Respond in at most 8 bullets and list uncertainties at the end.
```

### 2) Feature Impact
```text
Analyze the impact of changing "<target>".
Map affected components, coupling points, execution paths, and likely regressions.
Return a prioritized list with risk level and evidence.
```

### 3) Structural Navigation
```text
Explain how "<symbol_or_component>" is connected in the system.
Show where it is defined, where it is used, and what it depends on.
Use only evidence-backed statements.
```

### 4) Deep Architecture Review
```text
Produce an architecture review for "<goal>".
Include critical flows, external integrations, runtime configuration points,
conventions/patterns, hotspots, and top risks.
Add confidence (high/medium/low) for each major finding.
```

### 5) Refactor Planning
```text
Design a safe refactor plan for "<target>".
Provide sequence of changes, blast radius, rollback points,
and the minimum test strategy needed to reduce risk.
Use evidence for every risk claim.
```

### 6) Drift and Standards Check
```text
Check if the current codebase behavior drifts from project conventions and active rules.
List deviations by severity, where they appear, and the smallest corrective action.
Keep the response compact and evidence-backed.
```

### 7) PR-Readiness Review
```text
Review current changes for bugs, missing tests, observability gaps, and risk.
Prioritize findings by severity and include evidence and concrete fix suggestions.
Keep the summary short and actionable.
```

### 8) Round Table Debate
```text
Run a senior round-table debate about "<option A> vs <option B>" for "<problem>".
Use three roles: Software Architect, Technology Specialist, Senior Software Engineer.
If project context exists, ground arguments in evidence from it.
If no project context exists, state assumptions first and debate by scenario.
End with a clear recommendation, trade-off matrix, and next steps.
```

See reusable template:
- `prompts/ROUND_TABLE_PROMPT.md`

### Prompt Template Automation
Scout can automate prompt template discovery/loading via MCP tools:

```json
{ "name": "list_prompt_templates", "arguments": { "scope": "all" } }
```

```json
{ "name": "get_prompt_template", "arguments": { "name": "ROUND_TABLE_PROMPT.md", "scope": "all" } }
```

Template roots:
- Project: `<project-root>/prompts`
- Global: `~/.engineering-ai/prompts`

## Optional configuration
You can set defaults in `~/.engineering-ai/scout.json` (or set `SCOUT_CONFIG_PATH`).

Example:
```json
{
  "defaults": {
    "search_project": { "max_results": 25, "max_snippet_lines": 6 },
    "review_diff": { "min_severity": "medium" }
  }
}
```

## Logging
Set `SCOUT_LOG_LEVEL` to `error`, `warn`, `info`, or `debug`. Logs are JSON lines on stderr.

## Search performance
If `rg` (ripgrep) is installed, `search_project` will use it for faster searches. Otherwise it falls back to the internal scanner.

## Security and privacy
- Scout runs locally and does not call external networks.
- All data is stored on the local filesystem under `~/.engineering-ai/`.

## Troubleshooting
- **Tools not listed**: ensure your MCP client is in Agent mode and points to the correct config file and command.
- **No diff**: `review_diff` requires a git repo and pending changes.
- **No results**: check `max_results`, query terms, and file permissions.

## Tests
```bash
npm test
```

## Extra docs
- `docs/USAGE.md`
- `docs/TOOLS_REFERENCE.md`
- `docs/CONFIGURATION.md`
- `docs/WORKFLOWS.md`
- `docs/DATA_MODEL.md`
