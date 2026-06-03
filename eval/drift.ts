import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { RunReport } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, "..", "reports", "baseline.json");

export interface DriftLine {
  id: string;
  was: boolean;
  now: boolean;
  change: "regressed" | "fixed" | "same";
}

export interface DriftSummary {
  hasBaseline: boolean;
  regressions: DriftLine[];
  fixes: DriftLine[];
  baselinePassRate?: number;
  currentPassRate: number;
}

// Compare the current run against a stored baseline so a "quality drop" shows
// up as specific case-level regressions, not just an aggregate number moving.
export function compareDrift(current: RunReport): DriftSummary {
  if (!existsSync(baselinePath)) {
    return { hasBaseline: false, regressions: [], fixes: [], currentPassRate: current.passRate };
  }

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as RunReport;
  const was = new Map(baseline.cases.map((c) => [c.id, c.passed]));

  const regressions: DriftLine[] = [];
  const fixes: DriftLine[] = [];

  for (const c of current.cases) {
    if (!was.has(c.id)) continue;
    const prev = was.get(c.id)!;
    if (prev && !c.passed) regressions.push({ id: c.id, was: true, now: false, change: "regressed" });
    else if (!prev && c.passed) fixes.push({ id: c.id, was: false, now: true, change: "fixed" });
  }

  return {
    hasBaseline: true,
    regressions,
    fixes,
    baselinePassRate: baseline.passRate,
    currentPassRate: current.passRate,
  };
}

export function writeBaseline(report: RunReport): void {
  writeFileSync(baselinePath, JSON.stringify(report, null, 2));
}
