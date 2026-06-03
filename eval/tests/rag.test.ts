import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRag } from "../rag.ts";
import type { GoldenCase } from "../types.ts";

function grounded(overrides: Partial<GoldenCase>): GoldenCase {
  return {
    id: "g",
    category: "grounded",
    severity: "medium",
    prompt: "p",
    rubric: "r",
    ...overrides,
  };
}

test("non-grounded cases are n/a", () => {
  const c: GoldenCase = { id: "x", category: "factual", severity: "low", prompt: "p", rubric: "r" };
  assert.equal(classifyRag(c, "anything"), "n/a");
});

test("fact in context and answer => ok", () => {
  const c = grounded({ expectedFact: "4.2 million", context: "Q3 revenue was 4.2 million." });
  assert.equal(classifyRag(c, "It was 4.2 million."), "ok");
});

test("fact in context but missing from answer => generation failure", () => {
  const c = grounded({ expectedFact: "4.2 million", context: "Q3 revenue was 4.2 million." });
  assert.equal(classifyRag(c, "It was 4.2 billion."), "generation");
});

test("fact absent from context => retrieval failure", () => {
  const c = grounded({ expectedFact: "4.2 million", context: "Headcount grew to 120." });
  assert.equal(classifyRag(c, "It was 4.2 million."), "retrieval");
});

test("intentionally-absent fact: admitting unavailable => ok", () => {
  const c = grounded({ expectedFact: null, context: "Revenue only." });
  assert.equal(classifyRag(c, "That is not available in the context."), "ok");
});

test("intentionally-absent fact: inventing a value => generation failure", () => {
  const c = grounded({ expectedFact: null, context: "Revenue only." });
  assert.equal(classifyRag(c, "The margin was 18 percent."), "generation");
});
