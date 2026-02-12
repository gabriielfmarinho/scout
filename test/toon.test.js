"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatToon } = require("../src/utils/toon");

test("formatToon escapes pipes and newlines", () => {
  const out = formatToon(["a", "b"], [["x|y", "l1\n\n"]]);
  assert.match(out, /x\\\|y/);
  assert.match(out, /l1\\n/);
});
