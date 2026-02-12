"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseUnifiedDiff } = require("../src/utils/diff");

test("parseUnifiedDiff extracts files and hunks", () => {
  const diff = [
    "diff --git a/src/a.js b/src/a.js",
    "index 123..456 100644",
    "--- a/src/a.js",
    "+++ b/src/a.js",
    "@@ -1,2 +1,3 @@",
    "-old",
    "+new",
    "+more",
  ].join("\n");
  const parsed = parseUnifiedDiff(diff);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].file, "src/a.js");
  assert.equal(parsed[0].hunks.length, 1);
});
