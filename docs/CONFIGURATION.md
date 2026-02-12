# Scout MCP Configuration

## Global config file
By default, Scout loads defaults from:
```
~/.engineering-ai/scout.json
```

You can override with `SCOUT_CONFIG_PATH`.

Example:
```json
{
  "defaults": {
    "search_project": { "max_results": 25, "max_snippet_lines": 6 },
    "review_diff": { "min_severity": "medium" },
    "get_context_bundle": { "max_items": 40 }
  }
}
```

## Environment variables
- `SCOUT_CONFIG_PATH`: absolute path to config file
- `SCOUT_LOG_LEVEL`: `error | warn | info | debug`

## MCP client configuration
Your client may use a project-local MCP config.
Example:
```
.copilot/mcp-config.json
```
```json
{
  "servers": {
    "scout": {
      "type": "stdio",
      "command": "/absolute/path/to/scout-mcp",
      "args": []
    }
  }
}
```
