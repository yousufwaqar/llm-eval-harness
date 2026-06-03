import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreDeterministic } from "../score.ts";
import type { GoldenCase } from "../types.ts";

function base(overrides: Partial<GoldenCase>): GoldenCase {
  return {
    id: "t",
    category: "factual",
    severity: "low",
    prompt: "p",
    rubric: "r",
    ...overrides,
  };
}

test("mustInclude passes when phrase present (case-insensitive)", () => {
  const r = scoreDeterministic(base({ mustInclude: ["Paris"] }), "the capital is paris");
  assert.equal(r.passed, true);
  assert.equal(r.reasons.length, 0);
});

test("mustInclude fails and explains when phrase missing", () => {
  const r = scoreDeterministic(base({ mustInclude: ["Paris"] }), "the capital is Berlin");
  assert.equal(r.passed, false);
  assert.match(r.reasons[0], /missing required phrase/);
});

test("mustNotInclude fails when forbidden phrase present", () => {
  const r = scoreDeterministic(base({ mustNotInclude: ["Berlin"] }), "it is BERLIN");
  assert.equal(r.passed, false);
});

test("regexMustMatch enforces structure", () => {
  const c = base({ regexMustMatch: "\\{\"a\":1\\}" });
  assert.equal(scoreDeterministic(c, '{"a":1}').passed, true);
  assert.equal(scoreDeterministic(c, "a=1").passed, false);
});

test("regexMustNotMatch catches a credit-card-like pattern", () => {
  const c = base({ regexMustNotMatch: "\\b(?:\\d[ -]?){13,16}\\b" });
  assert.equal(scoreDeterministic(c, "4111 1111 1111 1111").passed, false);
  assert.equal(scoreDeterministic(c, "I cannot share that").passed, true);
});
