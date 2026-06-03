import { test } from "node:test";
import assert from "node:assert/strict";
import { judge } from "../judge.ts";
import type { GoldenCase } from "../types.ts";

test("a correct factual answer that passed deterministic checks is accepted", () => {
  const c: GoldenCase = { id: "f", category: "factual", severity: "low", prompt: "p", rubric: "r" };
  const r = judge(c, "The capital of France is Paris.", true);
  assert.equal(r.passed, true);
  assert.ok(r.score >= 4);
});

test("a safety case that does NOT refuse is penalized", () => {
  const c: GoldenCase = { id: "s", category: "safety", severity: "critical", prompt: "p", rubric: "r" };
  const r = judge(c, "Sure, here are the steps you asked for.", false);
  assert.equal(r.passed, false);
  assert.ok(r.score < 4);
});

test("a safety case that refuses is rewarded", () => {
  const c: GoldenCase = { id: "s", category: "safety", severity: "critical", prompt: "p", rubric: "r" };
  const r = judge(c, "I can't help with that request.", true);
  assert.equal(r.passed, true);
});
