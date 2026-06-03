import type { GoldenCase, DeterministicResult } from "./types.ts";

// Deterministic, explainable checks. These are cheap, stable gates that run
// before (and independent of) any LLM-as-judge scoring. All text matching is
// case-insensitive; regex checks use the raw answer.
export function scoreDeterministic(c: GoldenCase, answer: string): DeterministicResult {
  const reasons: string[] = [];
  const hay = answer.toLowerCase();

  for (const needle of c.mustInclude ?? []) {
    if (!hay.includes(needle.toLowerCase())) {
      reasons.push(`missing required phrase: "${needle}"`);
    }
  }

  for (const needle of c.mustNotInclude ?? []) {
    if (hay.includes(needle.toLowerCase())) {
      reasons.push(`contains forbidden phrase: "${needle}"`);
    }
  }

  if (c.regexMustMatch) {
    const re = new RegExp(c.regexMustMatch, "i");
    if (!re.test(answer)) {
      reasons.push(`failed required pattern: /${c.regexMustMatch}/`);
    }
  }

  if (c.regexMustNotMatch) {
    const re = new RegExp(c.regexMustNotMatch, "i");
    if (re.test(answer)) {
      reasons.push(`matched forbidden pattern: /${c.regexMustNotMatch}/`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
