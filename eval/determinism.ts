import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { GoldenCase } from "./types.ts";
import { makeModel } from "./model.ts";

// Determinism / stability check: call the model N times per prompt and report
// any prompt whose output is not stable. Non-determinism is a first-class
// quality risk for LLM features (flaky evals, unreproducible bugs). For a real
// provider you would set temperature=0 and still expect some variance; this
// surfaces it instead of hiding it.
const RUNS = 3;

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const model = makeModel(process.argv.includes("--model") ? process.argv[process.argv.indexOf("--model") + 1] : "stub");
  const golden = JSON.parse(readFileSync(join(here, "golden.json"), "utf8")) as GoldenCase[];

  let unstable = 0;
  for (const c of golden) {
    const outputs = new Set<string>();
    for (let i = 0; i < RUNS; i++) {
      outputs.add(await model.complete(c.prompt, { temperature: 0, context: c.context }));
    }
    const stable = outputs.size === 1;
    if (!stable) unstable++;
    console.log(`${stable ? "stable  " : "UNSTABLE"}  ${c.id}  (${outputs.size} distinct / ${RUNS})`);
  }

  console.log(`\n${golden.length - unstable}/${golden.length} prompts stable across ${RUNS} runs`);
  process.exit(unstable === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
