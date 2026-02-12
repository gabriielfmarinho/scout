"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateSchema } = require("../src/utils/validate");

test("validateSchema rejects missing required", () => {
  const schema = { type: "object", properties: { q: { type: "string" } }, required: ["q"], additionalProperties: false };
  const errs = validateSchema(schema, {});
  assert.ok(errs.length > 0);
});

test("validateSchema rejects unknown fields", () => {
  const schema = { type: "object", properties: { q: { type: "string" } }, additionalProperties: false };
  const errs = validateSchema(schema, { q: "ok", x: 1 });
  assert.ok(errs.some((e) => e.includes("Unknown field")));
});
