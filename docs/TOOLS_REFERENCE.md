# Scout MCP Tools Reference

This reference documents each tool, its parameters, and output format.

## get_context_bundle
- Purpose: Progressive disclosure loader for relevant context (global + specialist project files) before coding or analysis.
- Input:
  - `max_items` (int, default 50)
  - `page_size` (int, default 50)
  - `cursor` (string, default empty; opaque token returned by previous call)
  - `topics` (string[], default `["overview"]`; accepts predefined and dynamic topic names)
  - `global_topics` (string[], default `["all"]`; accepts predefined and dynamic topic names)
  - `context_pack` (default|debug|refactor|review, default `default`)
  - `evidence_level` (minimal|standard|full, default `full`)
  - `include_preferential` (bool, default `true`)
- Output: Markdown with evidence lines and metadata (`returned_items`, `total_items`, `has_more`, `next_cursor`).

## analyze_project
- Purpose: Detect languages, build tools, frameworks, infra, CI/CD, monorepo, data, tests.
- Input:
  - `quick` (bool, default false)
- Output: Markdown summary + evidence references. Persists:
  - `cache/core/fingerprint.json`
  - `docs/specialists/architecture.md`

## search_project
- Purpose: Keyword or hybrid code search with evidence.
- Input:
  - `query` (string, required)
  - `mode` (keyword|hybrid, default keyword)
  - `context_pack` (default|debug|refactor|review, default `default`)
  - `evidence_level` (minimal|standard|full, default `standard`)
  - `max_budget_items` (int, default 30)
  - `max_context_chars` (int, default 10000)
  - `max_per_file` (int, default 5)
  - `max_results` (int, default 50)
  - `max_snippet_lines` (int, default 8)
  - `max_files` (int, default 2000)
  - `max_file_bytes` (int, default 524288)
  - `max_ms` (int, default 20000)
  - `persist_to_context` (bool, default `true`) append search findings into project specialist context
  - `persist_topic` (string, default `flows`) specialist topic used when persisting
- Output: TOON table: `file | symbol_or_section | score | reason | evidence`

## analyze_impact
- Purpose: Identify potential impact of changing a target.
- Input:
  - `target` (string, required)
  - `context_pack` (default|debug|refactor|review, default `default`)
  - `evidence_level` (minimal|standard|full, default `standard`)
  - `max_budget_items` (int, default 30)
  - `max_context_chars` (int, default 10000)
  - `max_per_file` (int, default 5)
  - `max_results` (int, default 50)
  - `persist_to_context` (bool, default `true`) append analysis results into project specialist context
  - `persist_topic` (string, default `flows`) specialist topic used when persisting
- Output: TOON table: `component | impact | risk | evidence`

## generate_project_brief
- Purpose: Build structured project intelligence brief (summary, flows, integrations, runtime config, conventions, hotspots).
- Input:
  - `context_pack` (default|debug|refactor|review, default `default`)
- Output: Markdown report. Persists:
  - `cache/core/project_brief.json`
  - `docs/active-context.md` (project brief router/index)
  - `docs/specialists/architecture.md`

## query_structure
- Purpose: Structured repo queries against structural index.
- Input:
  - `mode` (who_calls|what_calls|find_symbol, default `who_calls`)
  - `target` (string, required)
  - `max_results` (int, default 50)
  - `context_pack` (default|debug|refactor|review, default `default`)
  - `evidence_level` (minimal|standard|full, default `standard`)
  - `persist_to_context` (bool, default `true`) append query findings into project specialist context
  - `persist_topic` (string, default `flows`) specialist topic used when persisting
- Output: TOON table with evidence.

## list_prompt_templates
- Purpose: List reusable prompt templates available to agents.
- Input:
  - `scope` (project|global|all, default `all`)
- Output: TOON table: `scope | name | title | path`

## get_prompt_template
- Purpose: Load a prompt template by file name and return its full content.
- Input:
  - `name` (string, required, must be a plain `.md` file name)
  - `scope` (project|global|all, default `all`)
  - `create_if_missing` (bool, default false)
  - `default_content` (string, default empty)
- Output: Markdown document with scope/path/content.

## review_diff
- Purpose: Review git diff for issues/tests/observability.
- Input:
  - `focus` (all|bugs|tests|observability|style)
  - `min_severity` (low|medium|high)
  - `staged` (bool)
- Output: TOON table: `severity | issue | file | suggestion | evidence`

## detect_drift
- Purpose: Detect drift from explicit rules in `active-context.md`.
- Input:
  - `max_results` (int, default 50)
  - `context_pack` (default|debug|refactor|review, default `default`)
  - `evidence_level` (minimal|standard|full, default `standard`)
  - `max_budget_items` (int, default 30)
  - `max_context_chars` (int, default 10000)
  - `max_per_file` (int, default 5)
- Output: TOON table: `rule | deviation | file | severity | evidence`

## compress_context
- Purpose: Generate/compact project docs and summaries.
- Input:
  - `max_bullets` (int, default 30)
- Output: Markdown report of updated files. Writes:
  - `docs/active-context.md`
  - `docs/decisions.md`
  - `docs/glossary.md` (optional)

## prepare_pr
- Purpose: Generate PR description from diff, review, impact.
- Input:
  - `include_review` (bool, default true)
  - `include_impact` (bool, default true)
- Output: Markdown PR template.

## devlog_append
- Purpose: Append a structured timeline entry.
- Input:
  - `type` (string, required)
  - `summary` (string, required)
  - `files` (string[], optional)
  - `tags` (string[], optional)
- Output: TOON confirmation row + updated file path.

## update_global_context
- Purpose: Update global preferences across projects.
- Input:
  - `mode` (append|replace, default append)
  - `priority` (must|prefer, default `prefer`) used as fallback for unprefixed entries
  - `topic` (string, optional) explicit global topic (supports dynamic topics)
  - `strict_priority` (bool, default `true`) when true, entries must be prefixed `[must]`/`[prefer]` or use `priority`
  - `entries` (string[], optional)
  - `entries_structured` (object[], optional) structured documentation entries
  - `strict_quality` (bool, default `false`) validates structured entries and rejects placeholders/invalid evidence/snippet mismatch
  - Requirement: at least one of `entries` or `entries_structured`
- Output: TOON confirmation row + `active-context.md` path + global `context_manifest.json`.

## update_project_context
- Purpose: Update project-scoped preferences/rules in specialist context files.
- Input:
  - `mode` (append|replace, default append)
  - `priority` (must|prefer, default `prefer`) used as fallback for unprefixed entries
  - `topic` (string, optional) explicit project topic (supports dynamic topics)
  - `strict_priority` (bool, default `true`) when true, entries must be prefixed `[must]`/`[prefer]` or use `priority`
  - `entries` (string[], optional)
  - `entries_structured` (object[], optional) structured documentation entries
  - `strict_quality` (bool, default `false`) validates structured entries and rejects placeholders/invalid evidence/snippet mismatch
  - Requirement: at least one of `entries` or `entries_structured`
- Output: TOON confirmation row + project manifest path.

## audit_context_quality
- Purpose: Audit quality of project/global documentation entries and flag low-quality items.
- Input:
  - `scope` (project|global|all, default `all`)
  - `min_quality` (int 0-100, default 70)
  - `max_results` (int, default 200)
- Output: TOON table: `scope | topic | quality | status | issues | evidence`

## set_active_project
- Purpose: Set the active project root without IDE configuration.
- Input:
  - `path` (string, required)
- Output: TOON confirmation row with root and saved path.

## get_project_root
- Purpose: Return the resolved project root and active project state.
- Input: none
- Output: TOON with resolved root and active root.
