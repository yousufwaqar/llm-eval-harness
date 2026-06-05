// Custom Promptfoo provider that drives the harness's own ChatModel
// implementations (StubModel / BadModel) instead of a hosted API. This lets
// Promptfoo evaluate the exact same offline models the native harness uses, so
// the suite runs with zero API keys and zero network: a deterministic smoke
// gate, not a model-quality benchmark.
//
// Model selection order: provider `config.model` (set in promptfooconfig.yaml /
// promptfooconfig.bad.yaml), then the PROMPTFOO_MODEL env var (handy for ad-hoc
// runs), then "stub". The bad run is a negative control: it must FAIL the
// assertions that the stub run passes, proving the gate actually catches
// regressions.

import { makeModel, type ChatModel } from "../eval/model.ts";

interface ProviderOptions {
  id?: string;
  config?: { model?: string };
}

interface CallApiContext {
  vars?: Record<string, unknown>;
}

export default class GoldenProvider {
  private readonly modelName: string;
  private readonly model: ChatModel;

  constructor(options?: ProviderOptions) {
    this.modelName = options?.config?.model ?? process.env.PROMPTFOO_MODEL ?? "stub";
    this.model = makeModel(this.modelName);
  }

  id(): string {
    return `golden:${this.modelName}`;
  }

  async callApi(prompt: string, context?: CallApiContext): Promise<{ output: string }> {
    const ctx = context?.vars?.context;
    const opts =
      typeof ctx === "string" && ctx.length > 0 ? { context: ctx } : undefined;
    const output = await this.model.complete(prompt, opts);
    return { output };
  }
}
