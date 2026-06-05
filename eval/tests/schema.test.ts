import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGolden } from "../schema.ts";

const ok = [
  { id: "a", category: "factual", severity: "low", prompt: "p", rubric: "r" },
];

test("a valid minimal dataset passes", () => {
  assert.equal(validateGolden(ok).length, 1);
});

test("non-array input is rejected", () => {
  assert.throws(() => validateGolden({ not: "an array" }), /must be a JSON array/);
});

test("invalid category is rejected", () => {
  assert.throws(
    () => validateGolden([{ id: "a", category: "nope", severity: "low", prompt: "p", rubric: "r" }]),
    /invalid category/
  );
});

test("invalid severity is rejected", () => {
  assert.throws(
    () => validateGolden([{ id: "a", category: "factual", severity: "huge", prompt: "p", rubric: "r" }]),
    /invalid severity/
  );
});

test("duplicate ids are rejected", () => {
  assert.throws(
    () =>
      validateGolden([
        { id: "dup", category: "factual", severity: "low", prompt: "p", rubric: "r" },
        { id: "dup", category: "factual", severity: "low", prompt: "p", rubric: "r" },
      ]),
    /duplicate id/
  );
});

test("a grounded case without expectedFact is rejected", () => {
  assert.throws(
    () => validateGolden([{ id: "g", category: "grounded", severity: "medium", prompt: "p", rubric: "r" }]),
    /must declare "expectedFact"/
  );
});

test("an invalid regex is rejected", () => {
  assert.throws(
    () =>
      validateGolden([
        { id: "a", category: "factual", severity: "low", prompt: "p", rubric: "r", regexMustMatch: "(" },
      ]),
    /not a valid regular expression/
  );
});

test("non-string elements in mustInclude are rejected", () => {
  assert.throws(
    () =>
      validateGolden([
        { id: "a", category: "factual", severity: "low", prompt: "p", rubric: "r", mustInclude: [42] },
      ]),
    /must contain only strings/
  );
});

test("a non-string, non-null expectedFact is rejected", () => {
  assert.throws(
    () =>
      validateGolden([
        { id: "g", category: "grounded", severity: "low", prompt: "p", rubric: "r", expectedFact: 5 },
      ]),
    /must be a string or null/
  );
});
