import type { GoldenCase, RagClass } from "./types.ts";

// RAG failure attribution.
//
// When a grounded answer is wrong, the single most useful question is WHERE it
// broke: did retrieval fail to surface the needed fact (retrieval failure), or
// did the model have the fact in context and still answer wrong (generation /
// faithfulness failure)? Treating these the same hides the real fix - one is a
// retriever/index problem, the other is a prompt/model problem.
//
// Heuristic:
//  - Only grounded cases are in scope; others return "n/a".
//  - expectedFact === null  => the fact is intentionally absent. Correct
//    behavior is to say it's unavailable; inventing a value is a GENERATION
//    failure (hallucination).
//  - expectedFact present:
//      * fact not in the provided context        -> "retrieval" (we never had it)
//      * fact in context but missing from answer -> "generation" (had it, lost it)
//      * fact in context and in answer           -> "ok"
export function classifyRag(c: GoldenCase, answer: string): RagClass {
  if (c.category !== "grounded") return "n/a";

  const ans = answer.toLowerCase();

  if (c.expectedFact === null || c.expectedFact === undefined) {
    const admits = /\b(not available|don't know|cannot|can't|no information)\b/i.test(answer);
    return admits ? "ok" : "generation";
  }

  const fact = c.expectedFact.toLowerCase();
  const ctx = (c.context ?? "").toLowerCase();
  const factInContext = ctx.includes(fact);
  const factInAnswer = ans.includes(fact);

  if (!factInContext) return "retrieval";
  if (factInContext && !factInAnswer) return "generation";
  return "ok";
}
