# Offline self-check with ZERO third-party dependencies (no DeepEval, no pytest).
# It proves the core contract holds before any heavy install:
#   - the StubModel satisfies every golden constraint, and
#   - the BadModel violates at least one constraint on every item.
# This is the same logic the DeepEval metric wraps, so if this passes, the
# DeepEval suite is evaluating a sound contract. Runs anywhere Python runs.

import sys

from constraints import check, load_golden
from models import make_model


def main() -> int:
    golden = load_golden()
    stub = make_model("stub")
    bad = make_model("bad")
    problems = []

    for item in golden:
        stub_out = stub.complete(item["prompt"], item.get("context"))
        stub_ok, stub_reasons = check(stub_out, item)
        if not stub_ok:
            problems.append(f"STUB failed {item['id']}: {stub_reasons}")

        bad_out = bad.complete(item["prompt"], item.get("context"))
        bad_ok, _ = check(bad_out, item)
        if bad_ok:
            problems.append(f"BAD unexpectedly passed {item['id']}")

    if problems:
        print("SELFCHECK FAILED:")
        for p in problems:
            print("  -", p)
        return 1

    print(f"SELFCHECK OK: {len(golden)} items, StubModel passes all, BadModel fails all.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
