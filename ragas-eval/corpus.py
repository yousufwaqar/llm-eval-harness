# A tiny, self-contained retrieval scenario for the Ragas track. Ragas's core
# value is evaluating RETRIEVAL quality (did the retriever fetch the right
# context?), separately from generation. To demonstrate that with a real,
# deterministic, offline Ragas metric we need two things the rest of the harness
# does not already provide: a small corpus, and two retrievers (a good one and a
# deliberately broken one) so the negative control is meaningful.
#
# Dependency-free on purpose: selfcheck.py reuses this with plain Python, and the
# Ragas pytest suite layers the real NonLLMContextRecall metric on top.

from typing import Dict, List, TypedDict

# A small corpus of grounded passages (the revenue/budget ones are reused from
# eval/golden.json's grounded cases; "uptime" is an unrelated distractor).
CORPUS: Dict[str, str] = {
    "revenue": "Q3 revenue was 4.2 million USD, up 12 percent year over year. Headcount grew to 120.",
    "budget": "The annual budget was approved by the finance committee on March 2. Attendees included the CFO.",
    "uptime": "The service guarantees 99.9 percent monthly uptime.",
}


class RetrievalCase(TypedDict):
    id: str
    query: str
    reference_id: str  # the corpus chunk that SHOULD be retrieved


CASES: List[RetrievalCase] = [
    {"id": "retrieve-revenue", "query": "What was Q3 revenue?", "reference_id": "revenue"},
    {"id": "retrieve-budget", "query": "Who approved the budget?", "reference_id": "budget"},
]


def reference_contexts(case: RetrievalCase) -> List[str]:
    return [CORPUS[case["reference_id"]]]


def good_retriever(case: RetrievalCase) -> List[str]:
    """A correct retriever: returns exactly the relevant chunk."""
    return [CORPUS[case["reference_id"]]]


def bad_retriever(case: RetrievalCase) -> List[str]:
    """A broken retriever: returns an unrelated chunk, never the relevant one."""
    distractor = "uptime" if case["reference_id"] != "uptime" else "revenue"
    return [CORPUS[distractor]]
