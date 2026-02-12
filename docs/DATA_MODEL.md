# Scout MCP Data Model

## Evidence
Evidence strings follow:
```
<file>:<start>-<end>: <snippet>
```

## devlog entry (timeline.jsonl)
Each line is a JSON object:
```json
{
  "timestamp": "2026-02-08T12:34:56.789Z",
  "type": "analysis",
  "summary": "Analyzed billing flow",
  "files": ["src/billing.ts"],
  "tags": ["billing"]
}
```

## fingerprint.json
Summary of project signals:
```json
{
  "languages": ["TypeScript"],
  "buildTools": ["npm", "tsc"],
  "frameworks": ["React"],
  "infra": ["Dockerfile"],
  "ci": ["GitHub Actions"],
  "architecture": ["Monorepo (apps/packages)"],
  "monorepo": ["pnpm-workspace"],
  "data": ["PostgreSQL (pg)"],
  "test": ["Jest"],
  "evidence": [
    {
      "topic": "framework",
      "value": "React",
      "confidence": "high",
      "evidence": "package.json:12-12: \"react\": \"18.0.0\""
    }
  ]
}
```
`fingerprint.json` is derived from `project_brief.json` in the current model.

## structural_index.json
Incremental structural index:
```json
{
  "version": 1,
  "root": "/repo",
  "files": {
    "src/service.ts": {
      "hash": "abc123",
      "analysis": {
        "symbols": [{ "name": "processPayment", "type": "function", "line": 10, "file": "src/service.ts", "evidence": "..." }],
        "calls": [{ "caller": "handler", "callee": "processPayment", "line": 22, "file": "src/service.ts", "evidence": "..." }],
        "references": [{ "symbol": "processPayment", "line": 44, "file": "src/service.ts", "evidence": "..." }]
      }
    }
  },
  "symbols": [],
  "calls": [],
  "references": [],
  "updatedAt": "2026-02-08T12:34:56.789Z"
}
```

## project_brief.json
Structured Project Intelligence snapshot:
```json
{
  "generatedAt": "2026-02-08T12:34:56.789Z",
  "summary": {
    "languages": ["TypeScript"],
    "frameworks": ["Express"],
    "architectureHints": ["Monorepo (apps/packages)"],
    "symbols": 120,
    "calls": 420,
    "references": 980
  },
  "flows": [],
  "integrations": [],
  "runtimeConfigs": [],
  "conventions": [],
  "hotspots": [],
  "evidence": []
}
```
`project_brief.json` is the canonical artifact; other summaries should be derived from it.

## project_intelligence_files.json
Incremental file-level intelligence cache used to avoid full rescans:
```json
{
  "version": 1,
  "files": {
    "src/api.js": {
      "hash": "sha1...",
      "flows": [],
      "integrations": [],
      "runtimeConfigs": [],
      "conventions": [],
      "hotspots": [],
      "markers": {},
      "analyzedAt": "2026-02-08T12:34:56.789Z"
    }
  },
  "updatedAt": "2026-02-08T12:34:56.789Z"
}
```

## telemetry.jsonl
One JSON object per tool execution with context-budget and latency metrics.
