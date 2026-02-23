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

## context_manifest.json
Progressive disclosure index for specialist context files:
```json
{
  "version": 1,
  "generatedAt": "2026-02-23T12:34:56.789Z",
  "source": "project_brief.json",
  "specialists": [
    {
      "topic": "overview",
      "count": 12,
      "cache_path": "/home/user/.engineering-ai/projects/demo/cache/specialists/overview.json",
      "doc_path": "/home/user/.engineering-ai/projects/demo/docs/specialists/overview.md"
    }
  ]
}
```

## cache/specialists/<topic>.json
Canonical specialist payload for lossless retrieval (one file per topic):
```json
{
  "topic": "flows",
  "items": [
    {
      "topic": "flows",
      "text": "http: GET /health",
      "summary": "http: GET /health",
      "rationale": "Derived from project analysis",
      "evidence": "src/api.js:10-10: app.get('/health', handler)",
      "source": "project_brief",
      "confidence": "high",
      "owner": "scout",
      "status": "reviewed",
      "quality_score": 100,
      "quality_issues": []
    }
  ]
}
```

## global/context_manifest.json
Global progressive disclosure index:
```json
{
  "version": 1,
  "generatedAt": "2026-02-23T12:34:56.789Z",
  "totalEntries": 4,
  "specialists": [
    {
      "topic": "coding",
      "count": 2,
      "cache_path": "/home/user/.engineering-ai/global/specialists/coding.json",
      "doc_path": "/home/user/.engineering-ai/global/specialists/coding.md"
    }
  ]
}
```

## global/specialists/<topic>.json
Canonical global context specialist file:
```json
{
  "topic": "security",
  "entries": [
    {
      "id": "append-173...",
      "text": "Always validate input",
      "summary": "Always validate input",
      "rationale": "Prevent injection and malformed requests",
      "priority": "must",
      "topic": "security",
      "confidence": "high",
      "owner": "security",
      "status": "approved",
      "createdAt": "2026-02-23T12:34:56.789Z",
      "updatedAt": "2026-02-23T12:34:56.789Z",
      "source": "update_global_context",
      "evidence": "docs/security.md:12-14: Validate and sanitize every external input",
      "quality_score": 100,
      "quality_issues": []
    }
  ]
}
```

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
