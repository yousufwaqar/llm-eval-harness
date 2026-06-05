# Ragas pytest suite: evaluates RETRIEVAL quality with a real, offline Ragas
# metric, NonLLMContextRecall. That metric is non-LLM (string comparison between
# retrieved_contexts and reference_contexts), so it needs no API key, no judge
# model, and no network, which keeps CI deterministic.
#
# Context recall here = fraction of the reference (relevant) contexts that the
# retriever actually returned. The good retriever fetches the right chunk
# (recall 1.0, must pass); the bad retriever fetches an unrelated chunk
# (recall 0.0, the negative control that proves the gate catches bad retrieval).
#
# Run with plain pytest:           pytest ragas-eval -q
# Ragas scoring is async, so each test wraps it in asyncio.run().

import asyncio

import pytest
from ragas.dataset_schema import SingleTurnSample
from ragas.metrics import NonLLMContextRecall

from corpus import CASES, bad_retriever, good_retriever, reference_contexts

IDS = [case["id"] for case in CASES]


def _context_recall(retrieved, reference):
    # threshold=0.99: a reference context counts as "recalled" only when a
    # retrieved chunk is essentially identical to it. This keeps the good case
    # (identical strings, similarity 1.0) at full recall while ensuring an
    # unrelated distractor cannot accidentally clear the default 0.5 bar.
    metric = NonLLMContextRecall(threshold=0.99)
    sample = SingleTurnSample(retrieved_contexts=retrieved, reference_contexts=reference)
    return asyncio.run(metric.single_turn_ascore(sample))


@pytest.mark.parametrize("case", CASES, ids=IDS)
def test_good_retrieval_passes(case):
    score = _context_recall(good_retriever(case), reference_contexts(case))
    assert score == pytest.approx(1.0), f"good retriever recall {score} for {case['id']}"


@pytest.mark.parametrize("case", CASES, ids=IDS)
def test_bad_retrieval_is_caught(case):
    score = _context_recall(bad_retriever(case), reference_contexts(case))
    assert score < 1.0, f"bad retriever unexpectedly passed {case['id']} with recall {score}"
