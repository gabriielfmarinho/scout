# Scout MCP Usage Guide

This guide shows common workflows and how tools should be combined.

## 1) First-time project bootstrap
1. Call `analyze_project` to create `fingerprint.json` and `docs/specialists/architecture.md`.
2. Call `compress_context` to refresh `active-context.md` as the project brief router/index.
3. Optionally call `devlog_append` to log initial analysis.

Example (tool calls):
```json
{ "name": "analyze_project", "arguments": { "quick": false } }
```
```json
{ "name": "compress_context", "arguments": { "max_bullets": 30 } }
```
```json
{ "name": "devlog_append", "arguments": { "type": "analysis", "summary": "Initial repo analysis", "tags": ["bootstrap"] } }
```

## 2) Using global preferences
Store your global preferences once (name, style, standards):
```json
{ "name": "update_global_context", "arguments": { "mode": "append", "entries": ["[must] Use explicit error handling", "[prefer] Prefer short functions", "[prefer] Name: Gabriel"] } }
```

`get_context_bundle` will load global preferences before project preferences.

## 3) Set active project (no IDE config)
If you work across many projects, set the active root once per switch:
```json
{ "name": "set_active_project", "arguments": { "path": "/absolute/path/to/project" } }
```

Verify:
```json
{ "name": "get_project_root", "arguments": {} }
```

## 4) Before coding
Always call `get_context_bundle` to load rules and preferences.
```json
{ "name": "get_context_bundle", "arguments": { "max_items": 30 } }
```

## 5) When asked to locate behavior
Use `search_project` (keyword or hybrid) and keep snippets short.
```json
{ "name": "search_project", "arguments": { "query": "bucket write", "mode": "hybrid", "context_pack": "debug", "max_results": 20, "max_snippet_lines": 6 } }
```

## 6) Before large refactors
Use `analyze_impact` to identify impacted components.
```json
{ "name": "analyze_impact", "arguments": { "target": "billing status", "context_pack": "refactor" } }
```

Use `query_structure` for deterministic call graph queries:
```json
{ "name": "query_structure", "arguments": { "mode": "who_calls", "target": "updateInvoiceStatus" } }
```

Use `generate_project_brief` for architecture and risk snapshot:
```json
{ "name": "generate_project_brief", "arguments": { "context_pack": "default" } }
```

## 7) Code review
Use `review_diff` and tune the focus and severity.
```json
{ "name": "review_diff", "arguments": { "focus": "tests", "min_severity": "medium" } }
```

## 8) Detect drift
Use `detect_drift` only when explicit rules exist in project context.
```json
{ "name": "detect_drift", "arguments": { "max_results": 50 } }
```

## 9) Prepare PR description
Use `prepare_pr` after changes.
```json
{ "name": "prepare_pr", "arguments": { "include_review": true, "include_impact": true } }
```

## 10) Log decisions and changes
Use `devlog_append` after meaningful decisions or code changes.
```json
{ "name": "devlog_append", "arguments": { "type": "decision", "summary": "Adopted Redis caching", "tags": ["architecture"] } }
```
