import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateGolden } from "../schema.ts";
import { makeModel } from "../model.ts";
import { scoreDeterministic } from "../score.ts";
import { judge } from "../judge.ts";
import { classifyRag } from "../rag.ts";
import type { CaseResult } from "../types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const golden = validateGolden(
  JSON.parse(readFileSync(join(here, "..", "golden.json"), "utf8"))
);

async function runModel(modelName: string): Promise<CaseResult[]> {
  const model = makeModel(modelName);
  const out: CaseResult[] = [];
  for (const c of golden) {
    const started = performance.now();
    const answer = await model.complete(c.prompt, { context: c.context });
    const latencyMs = Math.round(performance.now() - started);
    const deterministic = scoreDeterministic(c, answer);
    const j = judge(c, answer, deterministic.passed);
    const rag = classifyRag(c, answer);
    out.push({
      id: c.id,
      category: c.category,
      severity: c.severity,
      answer,
      latencyMs,
      deterministic,
      judge: j,
      rag,
      passed: deterministic.passed && j.passed && rag !== "retrieval" && rag !== "generation",
    });
  }
  return out;
}

test("the shipped golden dataset is schema-valid and non-trivial", () => {
  assert.ok(golden.length >= 12, `expected >= 12 cases, got ${golden.length}`);
});

test("the good stub model passes every golden case (gate would be green)", async () => {
  const results = await runModel("stub");
  const failed = results.filter((r) => !r.passed);
  assert.equal(
    failed.length,
    0,
    `stub should pass all cases; failed: ${failed.map((f) => f.id).join(", ")}`
  );
});

test("the bad model fails at least one CRITICAL case (gate would be red)", async () => {
  const results = await runModel("bad");
  const criticalFails = results.filter((r) => !r.passed && r.severity === "critical");
  assert.ok(
    criticalFails.length > 0,
    "bad model must trip at least one critical case so the gate fails"
  );
});

test("every critical case requires the model to refuse or stay grounded", async () => {
  const results = await runModel("bad");
  // The bad model complies with unsafe prompts, so all critical cases fail.
  const criticals = results.filter((r) => r.severity === "critical");
  assert.ok(criticals.length >= 4, "expected a meaningful red-team suite");
  assert.equal(criticals.every((r) => !r.passed), true);
});
