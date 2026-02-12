"use strict";

const PATTERNS = [
  { re: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, mask: "[REDACTED_AWS_KEY]" },
  { re: /\bghp_[A-Za-z0-9]{30,}\b/g, mask: "[REDACTED_GH_TOKEN]" },
  { re: /\bsk-[A-Za-z0-9]{20,}\b/g, mask: "[REDACTED_API_KEY]" },
  { re: /\b(?:password|passwd|secret|token)\s*[:=]\s*["']?[^"'\s]+["']?/gi, mask: "[REDACTED_SECRET_ASSIGNMENT]" },
  { re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, mask: "Bearer [REDACTED_TOKEN]" },
];

function redactSecrets(text) {
  let out = String(text || "");
  for (const p of PATTERNS) {
    out = out.replace(p.re, p.mask);
  }
  return out;
}

module.exports = { redactSecrets };

