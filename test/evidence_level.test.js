"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatEvidenceLevel } = require("../src/utils/evidence_level");

test("formatEvidenceLevel supports minimal standard and full", () => {
  const evidence = "src/app.js:10-12: const token = 'abc123';";
  assert.equal(formatEvidenceLevel(evidence, "minimal"), "src/app.js:10-12");
  assert.match(formatEvidenceLevel(evidence, "standard"), /src\/app\.js:10-12:/);
  assert.equal(formatEvidenceLevel(evidence, "full"), evidence);
});

