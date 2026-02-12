# Scout MCP Workflows

## Daily development
1. `get_context_bundle`
2. `search_project` or `analyze_project` (if needed)
3. `query_structure` for who-calls/what-calls when refactoring
4. Make changes
5. `review_diff`
6. `prepare_pr`
7. `devlog_append`

## Adding team conventions
1. `update_global_context` (global prefs)
2. `compress_context` (project-specific)
3. `detect_drift` (verify adherence)

## Migration or refactor
1. `analyze_project`
2. `generate_project_brief`
3. `analyze_impact`
4. `query_structure`
5. `search_project`
6. Implement changes
7. `review_diff`
8. `prepare_pr`
