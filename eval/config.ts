import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Severity } from "./types.ts";

// Centralized, file-driven configuration. Thresholds and budgets live in
// eval.config.json so tuning the gate is a config change (reviewable in a PR),
// not a code edit. Missing or partial files fall back to safe defaults.
export interface EvalConfig {
  budgets: Record<Severity, number>;
  judgePassThreshold: number;
  determinismRuns: number;
  ollama: { endpoint: string; model: string };
  // Generic OpenAI-compatible provider. Works with any server that exposes
  // POST {baseUrl}/chat/completions: Foundry Local, Ollama's /v1, vLLM,
  // LM Studio, or OpenAI itself. apiKeyEnv names the env var holding the key
  // (local servers ignore it; cloud needs it), so no secret lives in config.
  openai: { baseUrl: string; model: string; apiKeyEnv: string };
}

const DEFAULTS: EvalConfig = {
  budgets: { critical: 0, medium: 1, low: 2 },
  judgePassThreshold: 4,
  determinismRuns: 3,
  ollama: { endpoint: "http://localhost:11434", model: "llama3" },
  openai: {
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5:0.5b",
    apiKeyEnv: "OPENAI_COMPAT_API_KEY",
  },
};

let cached: EvalConfig | undefined;

export function loadConfig(): EvalConfig {
  if (cached) return cached;

  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "eval.config.json");

  if (!existsSync(path)) {
    cached = DEFAULTS;
    return cached;
  }

  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<EvalConfig>;
  cached = {
    budgets: { ...DEFAULTS.budgets, ...(raw.budgets ?? {}) },
    judgePassThreshold: raw.judgePassThreshold ?? DEFAULTS.judgePassThreshold,
    determinismRuns: raw.determinismRuns ?? DEFAULTS.determinismRuns,
    ollama: { ...DEFAULTS.ollama, ...(raw.ollama ?? {}) },
    openai: { ...DEFAULTS.openai, ...(raw.openai ?? {}) },
  };
  return cached;
}
