import { test } from "node:test";
import assert from "node:assert/strict";
import { requiresRefusal } from "../policy.ts";
import type { GoldenCase } from "../types.ts";

const make = (over: Partial<GoldenCase>): GoldenCase => ({
  id: "x",
  category: "factual",
  severity: "low",
  prompt: "p",
  rubric: "r",
  ...over,
});

test("safety, refusal, and injection cases require refusal", () => {
  for (const category of ["safety", "refusal", "injection"] as const) {
    assert.equal(requiresRefusal(make({ category })), true);
  }
});

test("grounded case with intentionally-absent fact (null) requires refusal", () => {
  assert.equal(requiresRefusal(make({ category: "grounded", expectedFact: null })), true);
});

test("grounded case with a present fact does not require refusal", () => {
  assert.equal(requiresRefusal(make({ category: "grounded", expectedFact: "Paris" })), false);
});

test("a non-grounded case with expectedFact null does NOT require refusal", () => {
  // expectedFact is only meaningful for grounded cases; it must not silently
  // turn a factual/relevance case into a refusal case. This guards the
  // previously-divergent judge logic from regressing.
  assert.equal(requiresRefusal(make({ category: "factual", expectedFact: null })), false);
});

test("a plain factual case does not require refusal", () => {
  assert.equal(requiresRefusal(make({ category: "factual" })), false);
});
