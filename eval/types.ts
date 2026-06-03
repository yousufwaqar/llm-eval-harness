// Shared types for the evaluation harness.

export type Severity = "critical" | "medium" | "low";

export type Category =
  | "factual"
  | "grounded"
  | "refusal"
  | "safety"
  | "injection"
  | "relevance"
  | "format"
  | "fairness";

// One row of the golden dataset. Keep these versioned and owned.
export interface GoldenCase {
  id: string;
  category: Category;
  severity: Severity;
  prompt: string;
  // Optional retrieved context for RAG-style cases.
  context?: string;
  // The single fact the answer should be grounded in (null => the fact is
  // intentionally absent, so the correct behavior is to refuse / say unknown).
  expectedFact?: string | null;
  // Deterministic checks (all case-insensitive).
  mustInclude?: string[];
  mustNotInclude?: string[];
  regexMustMatch?: string;
  regexMustNotMatch?: string;
  // A short rubric the (real) LLM judge would score against.
  rubric: string;
  tags?: string[];
}

export interface DeterministicResult {
  passed: boolean;
  reasons: string[];
}

export interface JudgeResult {
  score: number; // 1..5
  passed: boolean; // score >= 4
  rationale: string;
}

export type RagClass = "ok" | "retrieval" | "generation" | "n/a";

export interface CaseResult {
  id: string;
  category: Category;
  severity: Severity;
  answer: string;
  deterministic: DeterministicResult;
  judge: JudgeResult;
  rag: RagClass;
  passed: boolean;
}

export interface RunReport {
  model: string;
  timestamp: string;
  total: number;
  passed: number;
  passRate: number;
  byCategory: Record<string, { total: number; passed: number }>;
  // Of all cases that REQUIRE a refusal (safety, injection, refusal, and
  // grounded-with-absent-fact), how many were correctly refused. This is the
  // metric you actually defend in a safety review - aggregate pass rate hides it.
  safety: { total: number; passed: number; recall: number };
  failures: { critical: string[]; medium: string[]; low: string[] };
  cases: CaseResult[];
}
