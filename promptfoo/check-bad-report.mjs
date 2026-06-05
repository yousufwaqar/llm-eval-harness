// Verifies the Promptfoo BadModel negative control failed for the RIGHT reason.
//
// `promptfoo eval` exits non-zero both when assertions fail (the outcome we
// want) AND when something genuinely breaks: a bad config, a provider that
// won't load, a crash in the test generator. Treating any non-zero exit as
// "the gate works" would let a broken setup masquerade as a passing negative
// control. So instead of trusting the exit code, we read the JSON report and
// assert the bad run failed on ASSERTIONS, with no runtime errors and no
// case slipping through:
//   errors    === 0   (nothing crashed / failed to load)
//   successes === 0   (the bad model passed nothing)
//   failures  >  0    (every case was caught)
//
// Usage: node promptfoo/check-bad-report.mjs [path-to-report.json]

import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "promptfoo/promptfoo-bad-report.json";

let stats;
try {
  const report = JSON.parse(readFileSync(path, "utf8"));
  stats = report?.results?.stats;
} catch (e) {
  console.error(`Could not read Promptfoo report at ${path}: ${e.message}`);
  process.exit(1);
}

if (!stats) {
  console.error(`Report ${path} has no results.stats; cannot verify the negative control.`);
  process.exit(1);
}

const { successes = 0, failures = 0, errors = 0 } = stats;
const total = successes + failures + errors;
console.log(
  `Promptfoo BadModel run: ${successes} passed, ${failures} failed, ${errors} errors (of ${total}).`
);

const problems = [];
if (total === 0) problems.push("no test cases ran");
if (errors > 0)
  problems.push(`${errors} runtime/load error(s): the bad run must fail on assertions, not crash`);
if (successes > 0)
  problems.push(`${successes} case(s) unexpectedly PASSED the bad model`);
if (failures === 0) problems.push("no assertion failures recorded");

if (problems.length > 0) {
  console.error("Negative control INVALID: " + problems.join("; "));
  process.exit(1);
}

console.log("OK: every case failed the bad model on assertions, with zero errors.");
