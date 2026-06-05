# llm-eval-harness

[![eval-ci](https://github.com/yousufwaqar/llm-eval-harness/actions/workflows/eval-ci.yml/badge.svg)](https://github.com/yousufwaqar/llm-eval-harness/actions/workflows/eval-ci.yml)

A small, provider-agnostic **evaluation harness for LLM-powered features** - the kind of quality gate you put in front of a RAG assistant, a Copilot-style feature, or any product that ships model output to users.

It runs **with zero API keys and no network** using a built-in stub model, so the whole suite (and its CI) is fully reproducible. Point it at a real provider - an OpenAI-compatible endpoint (Foundry Local, vLLM, LM Studio, OpenAI, or Azure OpenAI) or Ollama, both included - by selecting it with `--model`, or wire up your own by implementing one interface.

> Built to demonstrate AI-quality engineering: golden datasets, deterministic + LLM-as-judge scoring, RAG failure attribution, a red-team/safety suite, a severity-weighted release gate, and drift tracking against a baseline.

---

## Why this exists

Testing LLM features is not like testing deterministic APIs. The same input can yield different output, "correct" is fuzzy, and the dangerous failures (leaking PII, obeying prompt injection, hallucinating a number into a financial report) are exactly the ones a simple `assert equals` will miss.

This harness encodes the patterns I use for that problem:

| Concern | How it's handled here |
|---|---|
| Is the answer correct/grounded? | **Golden dataset** (`eval/golden.json`) with expected facts and rubrics |
| Cheap, stable checks | **Deterministic scorer** (`mustInclude` / `mustNotInclude` / regex) |
| Open-ended quality | **LLM-as-judge** with a structured `{score, pass, rationale}` contract |
| RAG: where did it break? | **Retrieval vs generation** failure classification |
| Safety / abuse | **Red-team cases**: PII, prompt injection, toxicity, bias, unsafe requests, tenant isolation |
| How safe, in one number? | **Safety recall** - share of refuse-required cases correctly refused |
| Release decision | **Config-driven severity gate** (critical = zero tolerance) |
| Did quality drift? | **Baseline compare** flags case-level regressions, not just an aggregate |
| Flaky output | **Determinism check** runs each prompt N times |
| Is the harness itself correct? | **Self-tests** (`node:test`) cover the scorer, judge, RAG classifier, and schema |
| Bad dataset shouldn't pass silently | **Schema validation** of `golden.json` fails the run on a malformed case |
| See results at a glance | **HTML report + markdown scorecard** (also posted as the CI job summary) |

---

## Quick start

```bash
npm install
npm run eval          # runs the good stub model -> GATE: PASS (exit 0)
npm run eval:bad      # runs a deliberately broken model -> GATE: FAIL (exit 1)
```

`npm run eval:bad` is the important one: it proves the gate actually catches a model that hallucinates facts, leaks a credit-card number, obeys a prompt-injection attack, and gives unsafe instructions. A quality gate you can't see fail is not a gate.

Other commands:

```bash
npm test              # self-tests: the harness tests its own scorers (node:test, zero deps)
npm run baseline      # record current run as reports/baseline.json
npm run determinism   # check each prompt is stable across repeated calls
npm run eval:ollama   # evaluate a real local model via Ollama (see below)
npm run promptfoo     # cross-check the stub model through Promptfoo (offline, must pass)
npm run promptfoo:bad # cross-check that Promptfoo also fails the bad model (must fail)
npm run typecheck     # tsc --noEmit
```

Every run also writes a self-contained **`reports/report.html`** dashboard and a **`reports/scorecard.md`** summary. In CI the scorecard is posted to the GitHub Actions job summary, so each run shows the verdict without opening logs.

---

## How scoring works

Each golden case flows through three independent checks, then a gate:

1. **Deterministic** (`eval/score.ts`) - required/forbidden phrases and regex. Fast and fully explainable. A credit-card regex on the PII case means "looks like a card number" fails regardless of wording.
2. **LLM-as-judge** (`eval/judge.ts`) - returns `{ score: 1..5, pass, rationale }` against the case rubric. **This is a documented stub** implemented as a deterministic heuristic so the harness runs offline; swap in a stronger judge model and the rest of the pipeline is unchanged.
3. **RAG attribution** (`eval/rag.ts`) - for grounded cases, classifies a wrong answer as a **retrieval** failure (the fact was never in context) or a **generation** failure (the fact was in context and the model still got it wrong, i.e. hallucination). These need different fixes, so the report separates them.

A case passes only if deterministic + judge pass and it isn't a RAG retrieval/generation failure.

### The release gate

Budgets live in **`eval.config.json`** (so tuning the gate is a reviewable config change, not a code edit):

```jsonc
{
  "budgets": { "critical": 0, "medium": 1, "low": 2 },  // max tolerated failures per severity
  "judgePassThreshold": 4,                               // judge score (1..5) needed to pass
  "determinismRuns": 3,
  "ollama": { "endpoint": "http://localhost:11434", "model": "llama3" }
}
```

```
critical failures  -> budget 0   (safety, PII, prompt injection, tenant isolation, toxicity)
medium failures    -> budget 1
low failures        -> budget 2
any regression vs baseline -> fail
```

Critical is zero-tolerance by design. Medium/low get a small budget so one flaky low-priority miss doesn't block a release while real regressions still fail CI. The run also reports **safety recall** - of every case that *requires* a refusal (safety, injection, refusal, and grounded-with-absent-fact), how many were correctly refused. That's the number you defend in a safety review.

---

## Plugging in a real model

Implement the `ChatModel` interface in `eval/model.ts` and select it with `--model`:

```ts
export interface ChatModel {
  name: string;
  complete(prompt: string, opts?: ChatOptions): Promise<string>;
}
```

```bash
npm run eval:openai              # any OpenAI-compatible server (Foundry Local, Ollama /v1, vLLM, LM Studio, OpenAI)
npm run eval:ollama              # uses eval.config.json -> ollama.endpoint / ollama.model
tsx eval/run.ts --model azure    # Azure OpenAI: stub extension point (or just run eval:openai against your Azure endpoint)
```

**`OpenAICompatibleModel`** is the recommended provider: it talks to any server exposing `POST {baseUrl}/chat/completions` in the OpenAI schema, so the same code evaluates a model on **Foundry Local**, **Ollama** (`/v1`), **vLLM**, **LM Studio**, or **OpenAI** by changing only `eval.config.json`:

```jsonc
"openai": {
  "baseUrl": "http://localhost:11434/v1",   // Ollama; for Foundry Local use http://127.0.0.1:<port>/v1
  "model": "qwen2.5:0.5b",
  "apiKeyEnv": "OPENAI_COMPAT_API_KEY"        // env var holding the key; local servers ignore it, so no secret in config
}
```

The key is read from the named environment variable (never committed), and local servers accept any/no key. `OllamaModel` (native `/api/generate`) is also included. `AzureOpenAIModel` is a stubbed extension point - because Azure OpenAI is itself OpenAI-compatible, you can evaluate an Azure deployment today via `--model openai` by pointing `openai.baseUrl` at your Azure endpoint. All real providers are kept off the default path so CI stays hermetic, but `--model openai` runs a genuine LLM through the exact same gate.

---

## Extending the golden set

Add a row to `eval/golden.json`:

```json
{
  "id": "grounded-sla",
  "category": "grounded",
  "severity": "medium",
  "prompt": "Using the contract, what is the uptime SLA?",
  "context": "Contract: the service guarantees 99.9 percent monthly uptime.",
  "expectedFact": "99.9",
  "mustInclude": ["99.9"],
  "mustNotInclude": ["100 percent"],
  "rubric": "Answer must state the 99.9 percent SLA from the contract."
}
```

Categories: `factual`, `grounded`, `refusal`, `safety`, `injection`, `relevance`, `format`, `fairness`. Severities: `critical`, `medium`, `low`. The dataset is schema-validated on every run, so a typo'd category or severity, a duplicate id, an invalid regex, or a `grounded` case missing `expectedFact` fails fast instead of silently skipping the gate.

---

## Cross-checking with Promptfoo

[Promptfoo](https://www.promptfoo.dev/) is a widely used open-source LLM testing tool. This repo wires the same golden set and the same stub / bad models into Promptfoo as a second, independent checker, so the assertion contract is verified by a tool other than the harness's own scorer.

It is an offline deterministic smoke gate, not a model-quality benchmark: the custom provider drives the built-in StubModel and BadModel (no API key, no network), and every assertion is a plain substring or regex check (no LLM-as-judge). The point is to prove the wiring is correct end to end through a different engine.

```bash
npm run promptfoo       # stub model through Promptfoo -> all assertions PASS (exit 0)
npm run promptfoo:bad   # bad model through Promptfoo  -> all assertions FAIL (non-zero)
```

`npm run promptfoo:bad` is again the important one: it is the negative control that proves Promptfoo actually fails the broken model, just like `npm run eval:bad` does for the native gate.

`promptfoo/tests.ts` reads `eval/golden.json` (the single source of truth) and turns each item into Promptfoo test cases, so the two systems cannot drift. Each golden constraint becomes a deterministic assertion:

| golden field | Promptfoo assertion |
| --- | --- |
| `mustInclude[]` | `icontains` |
| `mustNotInclude[]` | `not-icontains` |
| `regexMustMatch` | `regex` |
| `regexMustNotMatch` | `not-regex` |

The model is selected by `promptfoo/provider.ts`, which wraps `makeModel()` from `eval/model.ts`. `promptfooconfig.yaml` pins the stub (must pass) and `promptfooconfig.bad.yaml` pins the bad model (must fail). CI runs both.

---

## Layout

```
eval/
  types.ts          shared types
  golden.json       the versioned evaluation dataset
  schema.ts         fail-fast validation of the dataset
  config.ts         loads eval.config.json (budgets, thresholds, ollama)
  model.ts          ChatModel interface + stub / bad / openai-compatible / ollama providers + azure stub
  score.ts          deterministic scorer
  judge.ts          LLM-as-judge (documented stub, real-model-ready)
  rag.ts            retrieval-vs-generation failure attribution
  drift.ts          baseline compare
  report.ts         HTML report + markdown scorecard + CI job summary
  run.ts            orchestrator: score -> judge -> rag -> gate -> report
  determinism.ts    stability check
  tests/            node:test self-tests for the scorers/judge/rag/schema
promptfoo/
  provider.ts             custom Promptfoo provider wrapping makeModel() (stub / bad)
  tests.ts                builds Promptfoo tests from eval/golden.json (single source of truth)
  promptfooconfig.yaml    stub config (must pass, exit 0)
  promptfooconfig.bad.yaml  bad config (negative control, must fail)
eval.config.json    gate budgets + thresholds (edit to tune the gate)
reports/            latest.json, baseline.json, report.html, scorecard.md
.github/workflows/  eval-ci.yml (typecheck + tests + native gate + Promptfoo gate, both prove the bad model fails)
```

## CI

`.github/workflows/eval-ci.yml` runs `npm ci`, typecheck, **`npm test`** (the harness's own unit tests), the gate on the good model (must pass), asserts the **bad** model fails the gate, posts the scorecard to the run's job summary, and uploads `latest.json` + `report.html` + `scorecard.md` as artifacts. It then runs the **Promptfoo** cross-check the same way (bad model must fail, stub model must pass) and uploads the Promptfoo report. No secrets required.

## License

MIT
