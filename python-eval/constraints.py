# Dependency-free constraint checker, shared by the DeepEval metric and the
# offline self-check. It reads the SAME single source of truth as the
# TypeScript harness (eval/golden.json) and applies the same four deterministic
# constraint types, so the two tracks can never drift:
#   mustInclude[]      case-insensitive substring must be present
#   mustNotInclude[]   case-insensitive substring must be absent
#   regexMustMatch     regex must match
#   regexMustNotMatch  regex must not match
# It deliberately uses NO LLM and NO third-party packages: it is a contract
# check, not a model-quality judge, and it must run with plain Python.

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

_GOLDEN_PATH = Path(__file__).resolve().parent.parent / "eval" / "golden.json"


def load_golden() -> List[Dict[str, Any]]:
    return json.loads(_GOLDEN_PATH.read_text(encoding="utf-8"))


def check(output: str, item: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Return (passed, reasons). passed is True only if every constraint holds."""
    reasons: List[str] = []
    lowered = output.lower()

    for needle in item.get("mustInclude", []):
        if needle.lower() not in lowered:
            reasons.append(f"missing required substring: {needle!r}")

    for needle in item.get("mustNotInclude", []):
        if needle.lower() in lowered:
            reasons.append(f"contains banned substring: {needle!r}")

    must_match = item.get("regexMustMatch")
    if must_match and re.search(must_match, output) is None:
        reasons.append(f"did not match required regex: {must_match}")

    must_not_match = item.get("regexMustNotMatch")
    if must_not_match and re.search(must_not_match, output) is not None:
        reasons.append(f"matched banned regex: {must_not_match}")

    return (len(reasons) == 0, reasons)
