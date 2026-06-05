import type { GoldenCase, Category, Severity } from "./types.ts";

// Fail-fast schema validation for the golden dataset. A malformed dataset is a
// silent quality hole (a case that never runs, or a typo'd severity that skips
// the gate), so we validate structure and enums at load time and refuse to run
// on a bad file rather than producing a misleading green.

const CATEGORIES: Category[] = [
  "factual",
  "grounded",
  "refusal",
  "safety",
  "injection",
  "relevance",
  "format",
  "fairness",
];
const SEVERITIES: Severity[] = ["critical", "medium", "low"];

export function validateGolden(data: unknown): GoldenCase[] {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    throw new Error("golden dataset must be a JSON array of cases");
  }

  const ids = new Set<string>();

  data.forEach((raw, i) => {
    const c = raw as Record<string, unknown>;
    const where = `case[${i}]${typeof c.id === "string" ? ` (${c.id})` : ""}`;

    if (typeof c.id !== "string" || c.id.length === 0) {
      errors.push(`${where}: missing string "id"`);
    } else if (ids.has(c.id)) {
      errors.push(`${where}: duplicate id "${c.id}"`);
    } else {
      ids.add(c.id);
    }

    if (!CATEGORIES.includes(c.category as Category)) {
      errors.push(`${where}: invalid category "${String(c.category)}" (expected one of ${CATEGORIES.join(", ")})`);
    }
    if (!SEVERITIES.includes(c.severity as Severity)) {
      errors.push(`${where}: invalid severity "${String(c.severity)}" (expected one of ${SEVERITIES.join(", ")})`);
    }
    if (typeof c.prompt !== "string" || c.prompt.length === 0) {
      errors.push(`${where}: missing string "prompt"`);
    }
    if (typeof c.rubric !== "string" || c.rubric.length === 0) {
      errors.push(`${where}: missing string "rubric"`);
    }

    for (const key of ["mustInclude", "mustNotInclude", "tags"] as const) {
      const val = c[key];
      if (val !== undefined) {
        if (!Array.isArray(val)) {
          errors.push(`${where}: "${key}" must be an array of strings if present`);
        } else if (!val.every((el) => typeof el === "string")) {
          errors.push(`${where}: "${key}" must contain only strings`);
        }
      }
    }
    if (c.context !== undefined && typeof c.context !== "string") {
      errors.push(`${where}: "context" must be a string if present`);
    }
    if ("expectedFact" in c && c.expectedFact !== null && typeof c.expectedFact !== "string") {
      errors.push(`${where}: "expectedFact" must be a string or null`);
    }
    for (const key of ["regexMustMatch", "regexMustNotMatch"] as const) {
      if (c[key] !== undefined) {
        if (typeof c[key] !== "string") {
          errors.push(`${where}: "${key}" must be a string if present`);
        } else {
          try {
            new RegExp(c[key] as string);
          } catch {
            errors.push(`${where}: "${key}" is not a valid regular expression`);
          }
        }
      }
    }
    // A grounded case should declare expectedFact (string for present, null for
    // intentionally-absent) so the RAG classifier can attribute failures.
    if (c.category === "grounded" && !("expectedFact" in c)) {
      errors.push(`${where}: grounded case must declare "expectedFact" (string or null)`);
    }
  });

  if (errors.length) {
    throw new Error(`Invalid golden dataset:\n  - ${errors.join("\n  - ")}`);
  }

  return data as GoldenCase[];
}
