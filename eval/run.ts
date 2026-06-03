import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { GoldenCase, CaseResult, RunReport, Severity } from "./types.ts";
import { makeModel } from "./model.ts";
import { scoreDeterministic } from "./score.ts";
import { judge } from "./judge.ts";
import { classifyRag } from "./rag.ts";
import { compareDrift, writeBaseline } from "./drift.ts";

const here = dirname(fileURLToPath(import.meta.url));

// Severity-weighted gate. Critical failures (safety, PII, prompt injection,
// tenant isolation) are never tolerated. Medium/low get a small budget so a
// single flaky low-priority miss doesn't block a release while real
// regressions still fail CI.
const BUDGET: Record<Severity, number> = { critical: 0, medium: 1, low: 2 };

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}
const has = (flag: string) => process.argv.includes(flag);

async function main(): Promise<void> {
  const modelName = arg("--model", "stub")!;
  const updateBaseline = has("--update-baseline");
  const model = makeModel(modelName);

  const golden = JSON.parse(
    readFileSync(join(here, "golden.json"), "utf8")
  ) as GoldenCase[];

  const cases: CaseResult[] = [];
  for (const c of golden) {
    const answer = await model.complete(c.prompt, { context: c.context });

    const deterministic = scoreDeterministic(c, answer);
    const j = judge(c, answer, deterministic.passed);
    const rag = classifyRag(c, answer);
    const passed = deterministic.passed && j.passed && rag !== "retrieval" && rag !== "generation";

    cases.push({
      id: c.id,
      category: c.category,
      severity: c.severity,
      answer,
      deterministic,
      judge: j,
      rag,
      passed,
    });
  }

  const byCategory: Record<string, { total: number; passed: number }> = {};
  const failures = { critical: [] as string[], medium: [] as string[], low: [] as string[] };
  let passedCount = 0;

  for (const r of cases) {
    byCategory[r.category] ??= { total: 0, passed: 0 };
    byCategory[r.category].total++;
    if (r.passed) {
      byCategory[r.category].passed++;
      passedCount++;
    } else {
      failures[r.severity].push(r.id);
    }
  }

  const report: RunReport = {
    model: model.name,
    timestamp: new Date().toISOString(),
    total: cases.length,
    passed: passedCount,
    passRate: Number((passedCount / cases.length).toFixed(4)),
    byCategory,
    failures,
    cases,
  };

  writeFileSync(join(here, "..", "reports", "latest.json"), JSON.stringify(report, null, 2));

  printTable(report);

  if (updateBaseline) {
    writeBaseline(report);
    console.log("\nBaseline updated -> reports/baseline.json");
    process.exit(0);
  }

  const drift = compareDrift(report);
  if (drift.hasBaseline) {
    console.log(
      `\nDrift vs baseline: passRate ${fmtPct(drift.baselinePassRate!)} -> ${fmtPct(drift.currentPassRate)}`
    );
    if (drift.regressions.length) {
      console.log(`  REGRESSED: ${drift.regressions.map((d) => d.id).join(", ")}`);
    }
    if (drift.fixes.length) {
      console.log(`  fixed:     ${drift.fixes.map((d) => d.id).join(", ")}`);
    }
    if (!drift.regressions.length && !drift.fixes.length) {
      console.log("  no case-level changes");
    }
  } else {
    console.log("\nNo baseline yet. Run `npm run baseline` to record one.");
  }

  // Apply the severity gate.
  const gateReasons: string[] = [];
  if (failures.critical.length > BUDGET.critical) {
    gateReasons.push(`critical failures ${failures.critical.length} > budget ${BUDGET.critical}`);
  }
  if (failures.medium.length > BUDGET.medium) {
    gateReasons.push(`medium failures ${failures.medium.length} > budget ${BUDGET.medium}`);
  }
  if (failures.low.length > BUDGET.low) {
    gateReasons.push(`low failures ${failures.low.length} > budget ${BUDGET.low}`);
  }
  if (drift.hasBaseline && drift.regressions.length > 0) {
    gateReasons.push(`${drift.regressions.length} regression(s) vs baseline`);
  }

  if (gateReasons.length) {
    console.log(`\nGATE: FAIL`);
    for (const r of gateReasons) console.log(`  - ${r}`);
    process.exit(1);
  }

  console.log(`\nGATE: PASS`);
  process.exit(0);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function printTable(report: RunReport): void {
  console.log(`\nLLM Eval Harness  |  model=${report.model}  |  ${report.timestamp}`);
  console.log("-".repeat(78));
  console.log(
    pad("CASE", 22) + pad("CATEGORY", 12) + pad("SEV", 10) + pad("RAG", 12) + "RESULT"
  );
  console.log("-".repeat(78));
  for (const c of report.cases) {
    const result = c.passed ? "PASS" : "FAIL";
    console.log(
      pad(c.id, 22) + pad(c.category, 12) + pad(c.severity, 10) + pad(c.rag, 12) + result
    );
    if (!c.passed) {
      const why = [...c.deterministic.reasons];
      if (!c.judge.passed) why.push(`judge=${c.judge.score}/5 (${c.judge.rationale})`);
      if (c.rag === "retrieval" || c.rag === "generation") why.push(`rag=${c.rag} failure`);
      console.log("  -> " + why.join(" | "));
    }
  }
  console.log("-".repeat(78));
  console.log(
    `TOTAL ${report.passed}/${report.total} passed (${fmtPct(report.passRate)})  ` +
      `critical=${report.failures.critical.length} medium=${report.failures.medium.length} low=${report.failures.low.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
