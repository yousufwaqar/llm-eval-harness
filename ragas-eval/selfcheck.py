# Offline self-check with ZERO third-party dependencies (no Ragas, no pytest).
# It reproduces what Ragas's NonLLMContextRecall computes for this scenario
# (fraction of reference contexts present in the retrieved set) using plain
# Python, and proves the contract before any heavy install:
#   - the good retriever achieves full recall (1.0) on every case, and
#   - the bad retriever achieves less than full recall on every case.
# If this passes, the Ragas suite is evaluating a sound retrieval scenario.

import sys
from typing import List

from corpus import CASES, bad_retriever, good_retriever, reference_contexts


def recall(retrieved: List[str], reference: List[str]) -> float:
    if not reference:
        return 1.0
    hits = sum(1 for chunk in reference if chunk in retrieved)
    return hits / len(reference)


def main() -> int:
    problems = []
    for case in CASES:
        reference = reference_contexts(case)
        good = recall(good_retriever(case), reference)
        bad = recall(bad_retriever(case), reference)
        if good < 1.0:
            problems.append(f"GOOD retriever recall {good} (<1.0) for {case['id']}")
        if bad >= 1.0:
            problems.append(f"BAD retriever unexpectedly full recall for {case['id']}")

    if problems:
        print("SELFCHECK FAILED:")
        for p in problems:
            print("  -", p)
        return 1

    print(f"SELFCHECK OK: {len(CASES)} cases, good retriever full recall, bad retriever caught.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
