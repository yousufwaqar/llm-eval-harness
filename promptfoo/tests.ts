// Generates Promptfoo test cases from the harness's single source of truth,
// eval/golden.json, so the two systems can never drift: add a golden item and it
// shows up here automatically. Each golden constraint maps to a deterministic
// Promptfoo assertion (no LLM-as-judge here, so the gate stays offline and
// reproducible):
//   mustInclude[]      -> icontains       (case-insensitive substring present)
//   mustNotInclude[]   -> not-icontains   (substring absent)
//   regexMustMatch     -> regex           (pattern present)
//   regexMustNotMatch  -> not-regex       (pattern absent)
// The prompt template is just "{{prompt}}" and the grounded items pass their
// context through the `context` var to the provider.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

interface GoldenItem {
  id: string;
  category: string;
  severity: string;
  prompt: string;
  context?: string;
  mustInclude?: string[];
  mustNotInclude?: string[];
  regexMustMatch?: string;
  regexMustNotMatch?: string;
}

interface Assertion {
  type: "icontains" | "not-icontains" | "regex" | "not-regex";
  value: string;
}

interface TestCase {
  description: string;
  vars: { prompt: string; context: string };
  assert: Assertion[];
}

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(here, "..", "eval", "golden.json");

export default function generateTests(): TestCase[] {
  const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as GoldenItem[];

  return golden.map((g) => {
    const assert: Assertion[] = [];
    for (const value of g.mustInclude ?? []) assert.push({ type: "icontains", value });
    for (const value of g.mustNotInclude ?? [])
      assert.push({ type: "not-icontains", value });
    if (g.regexMustMatch) assert.push({ type: "regex", value: g.regexMustMatch });
    if (g.regexMustNotMatch)
      assert.push({ type: "not-regex", value: g.regexMustNotMatch });

    // A golden item with no machine-checkable constraint would become a
    // trivially-passing Promptfoo test, which would silently weaken the gate
    // (and let the BadModel "pass" that case). Fail loudly instead so the two
    // systems stay in lockstep with eval/golden.json.
    if (assert.length === 0) {
      throw new Error(
        `Golden item "${g.id}" has no mustInclude / mustNotInclude / regex constraint, ` +
          `so it cannot be checked by Promptfoo. Add a deterministic constraint or remove it.`
      );
    }

    return {
      description: `${g.id} [${g.category}/${g.severity}]`,
      vars: { prompt: g.prompt, context: g.context ?? "" },
      assert,
    };
  });
}
