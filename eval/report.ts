import { writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { RunReport, CaseResult } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const reportsDir = join(here, "..", "reports");

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// A reviewer-friendly markdown scorecard. Doubles as the GitHub Actions job
// summary so every CI run shows the verdict at a glance without opening logs.
export function buildScorecard(report: RunReport, gatePass: boolean): string {
  const lines: string[] = [];
  lines.push(`# LLM Eval Scorecard`);
  lines.push("");
  lines.push(`- **Model:** \`${report.model}\``);
  lines.push(`- **Gate:** ${gatePass ? "PASS" : "FAIL"}`);
  lines.push(`- **Pass rate:** ${report.passed}/${report.total} (${pct(report.passRate)})`);
  lines.push(
    `- **Safety recall:** ${report.safety.passed}/${report.safety.total} (${pct(report.safety.recall)}) correctly refused`
  );
  lines.push(
    `- **Failures:** critical=${report.failures.critical.length}, medium=${report.failures.medium.length}, low=${report.failures.low.length}`
  );
  lines.push("");
  lines.push(`## By category`);
  lines.push("");
  lines.push(`| Category | Passed | Total | Pass rate |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const [cat, v] of Object.entries(report.byCategory).sort()) {
    lines.push(`| ${cat} | ${v.passed} | ${v.total} | ${pct(v.total ? v.passed / v.total : 0)} |`);
  }
  lines.push("");
  lines.push(`## Cases`);
  lines.push("");
  lines.push(`| Case | Category | Severity | RAG | Result |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const c of report.cases) {
    lines.push(
      `| ${c.id} | ${c.category} | ${c.severity} | ${c.rag} | ${c.passed ? "PASS" : "FAIL"} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

function row(c: CaseResult): string {
  const cls = c.passed ? "pass" : "fail";
  const why = c.passed
    ? ""
    : [
        ...c.deterministic.reasons,
        c.judge.passed ? "" : `judge ${c.judge.score}/5`,
        c.rag === "retrieval" || c.rag === "generation" ? `rag:${c.rag}` : "",
      ]
        .filter(Boolean)
        .join("; ");
  return `<tr class="${cls}">
    <td>${esc(c.id)}</td><td>${c.category}</td><td>${c.severity}</td>
    <td>${c.rag}</td><td class="result">${c.passed ? "PASS" : "FAIL"}</td>
    <td class="why">${esc(why)}</td></tr>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Self-contained HTML dashboard (no external assets) - open reports/report.html
// in a browser or attach it as a CI artifact / screenshot for demos.
export function buildHtml(report: RunReport, gatePass: boolean): string {
  const badge = gatePass ? "PASS" : "FAIL";
  const badgeColor = gatePass ? "#1a7f37" : "#cf222e";
  const catRows = Object.entries(report.byCategory)
    .sort()
    .map(
      ([cat, v]) =>
        `<tr><td>${cat}</td><td>${v.passed}/${v.total}</td><td>${pct(
          v.total ? v.passed / v.total : 0
        )}</td></tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>LLM Eval Report - ${esc(report.model)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 2rem; color: #1f2328; }
  h1 { margin-bottom: .2rem; }
  .meta { color: #57606a; margin-bottom: 1rem; }
  .badge { display:inline-block; padding:.25rem .75rem; border-radius:6px; color:#fff;
           font-weight:700; background:${badgeColor}; }
  .cards { display:flex; gap:1rem; flex-wrap:wrap; margin:1rem 0; }
  .card { border:1px solid #d0d7de; border-radius:8px; padding:.75rem 1rem; min-width:150px; }
  .card .n { font-size:1.6rem; font-weight:700; }
  table { border-collapse:collapse; width:100%; margin:1rem 0; }
  th,td { border:1px solid #d0d7de; padding:.4rem .6rem; text-align:left; font-size:.9rem; }
  th { background:#f6f8fa; }
  tr.pass .result { color:#1a7f37; font-weight:700; }
  tr.fail .result { color:#cf222e; font-weight:700; }
  td.why { color:#57606a; font-size:.82rem; }
</style></head>
<body>
  <h1>LLM Eval Report</h1>
  <div class="meta">model <code>${esc(report.model)}</code> &middot; ${esc(report.timestamp)} &middot; Gate <span class="badge">${badge}</span></div>
  <div class="cards">
    <div class="card"><div class="n">${pct(report.passRate)}</div><div>pass rate (${report.passed}/${report.total})</div></div>
    <div class="card"><div class="n">${pct(report.safety.recall)}</div><div>safety recall (${report.safety.passed}/${report.safety.total})</div></div>
    <div class="card"><div class="n">${report.failures.critical.length}</div><div>critical failures</div></div>
    <div class="card"><div class="n">${report.failures.medium.length}</div><div>medium failures</div></div>
  </div>
  <h2>By category</h2>
  <table><thead><tr><th>Category</th><th>Passed</th><th>Pass rate</th></tr></thead>
  <tbody>${catRows}</tbody></table>
  <h2>Cases</h2>
  <table><thead><tr><th>Case</th><th>Category</th><th>Severity</th><th>RAG</th><th>Result</th><th>Why (if failed)</th></tr></thead>
  <tbody>${report.cases.map(row).join("\n")}</tbody></table>
</body></html>`;
}

// Write reports/report.html + reports/scorecard.md, and append the scorecard to
// the GitHub Actions job summary when running in CI.
export function writeReports(report: RunReport, gatePass: boolean): void {
  const scorecard = buildScorecard(report, gatePass);
  writeFileSync(join(reportsDir, "report.html"), buildHtml(report, gatePass));
  writeFileSync(join(reportsDir, "scorecard.md"), scorecard);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, scorecard + "\n");
  }
}
