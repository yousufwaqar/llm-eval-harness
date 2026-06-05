# DeepEval pytest suite over the shared golden set.
#
# test_stub_passes: drives the well-behaved StubModel through DeepEval's
#   assert_test() and the custom GoldenConstraintMetric. Every case must pass.
# test_bad_model_is_caught: the NEGATIVE CONTROL. It drives the deliberately
#   broken BadModel and asserts the metric FAILS each case. (We call measure()
#   directly here rather than assert_test, because assert_test would raise on a
#   failing metric, whereas the whole point is that this test passes precisely
#   when the bad model is rejected.)
#
# Run with plain pytest:           pytest python-eval -q
# or the idiomatic DeepEval CLI:   deepeval test run python-eval/test_golden_deepeval.py

import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase

from constraints import load_golden
from metric import GoldenConstraintMetric
from models import make_model

GOLDEN = load_golden()
IDS = [item["id"] for item in GOLDEN]


def _build_case(item, model_name):
    model = make_model(model_name)
    context = item.get("context")
    output = model.complete(item["prompt"], context)
    return LLMTestCase(
        input=item["prompt"],
        actual_output=output,
        context=[context] if context else None,
    )


@pytest.mark.parametrize("item", GOLDEN, ids=IDS)
def test_stub_passes(item):
    test_case = _build_case(item, "stub")
    assert_test(test_case=test_case, metrics=[GoldenConstraintMetric(item)], run_async=False)


@pytest.mark.parametrize("item", GOLDEN, ids=IDS)
def test_bad_model_is_caught(item):
    test_case = _build_case(item, "bad")
    metric = GoldenConstraintMetric(item)
    metric.measure(test_case)
    assert not metric.is_successful(), (
        f"BadModel unexpectedly passed {item['id']}: {metric.reason}"
    )
