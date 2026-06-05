# A custom, deterministic DeepEval metric. DeepEval's built-in metrics are all
# LLM-powered (they call a judge model), which would need an API key and a
# network and would make CI non-deterministic. This metric instead wraps the
# dependency-free `check()` contract, so it scores 1.0 when every golden
# constraint holds and 0.0 otherwise: an offline, reproducible gate.
#
# It follows DeepEval's documented custom-metric contract: inherit BaseMetric,
# implement measure() / a_measure() (both set self.score and self.success), and
# is_successful(). One metric instance carries one golden item's constraints.

from typing import Any, Dict

from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase

from constraints import check


class GoldenConstraintMetric(BaseMetric):
    def __init__(self, item: Dict[str, Any], threshold: float = 1.0):
        self.threshold = threshold
        self.item = item
        self.error = None
        self.reason = None
        self.score = 0.0
        self.success = False

    def measure(self, test_case: LLMTestCase) -> float:
        try:
            passed, reasons = check(test_case.actual_output, self.item)
            self.score = 1.0 if passed else 0.0
            self.success = self.score >= self.threshold
            self.reason = "all constraints satisfied" if passed else "; ".join(reasons)
            return self.score
        except Exception as e:
            self.error = str(e)
            raise

    async def a_measure(self, test_case: LLMTestCase) -> float:
        # No LLM call to await: the sync implementation is already non-blocking.
        return self.measure(test_case)

    def is_successful(self) -> bool:
        if self.error is not None:
            self.success = False
        return self.success

    @property
    def __name__(self):
        return f"GoldenConstraint[{self.item['id']}]"
