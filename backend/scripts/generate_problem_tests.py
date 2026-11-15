"""Generate .in/.out test pairs for the three problems of the 12 November tour.

Run from ``backend/``::

    python3 scripts/generate_problem_tests.py

Reference solutions live next to the data so the expected output is computed,
never hand-written. Output goes to ``data/tests/<slug>/``:

* ``sample_N.in`` / ``sample_N.out`` — the samples from the tour PDF, marked as
  samples so the arena shows them before the contest;
* ``NN.in`` / ``NN.out``              — hidden tests, ordered after the samples.

The generator is deterministic (``random.Random(seed)``), so re-running it
produces identical files and a diff stays empty.
"""

import random
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
OUT = BASE / "data" / "tests"

# ---------------------------------------------------------------- reference code


def solve_ush_san(a: int, b: int, c: int, d: int) -> int:
    """Үш сан — the product of the two numbers that were not erased."""
    if d == a:
        return b * c
    if d == b:
        return a * c
    return a * b


def solve_happy(k: int) -> int:
    """Қуанышты сандар — squares of numbers ending in 5.

    (10m + 5)^2 = 100*m*(m+1) + 25, so a square ends in 25 exactly when its
    root ends in 5. The k-th such number is therefore (10k - 5)^2.
    """
    root = 10 * k - 5
    return root * root


def solve_olympiad(a: int, b: int, c: int, d: int) -> int:
    """Олимпиада — regions x districts x schools x pupils."""
    return a * b * c * d


# --------------------------------------------------------------------- generators

US_HIDDEN = [
    (1, 1, 1, 1),
    (100, 100, 100, 100),
    (1, 100, 1, 100),
    (100, 1, 1, 1),
    (100, 1, 1, 100),
    (7, 7, 7, 7),
    (3, 4, 5, 3),
    (3, 4, 5, 4),
    (3, 4, 5, 5),
    (99, 100, 99, 100),
    (1, 2, 3, 2),
    (50, 50, 25, 50),
    (2, 2, 100, 100),
    (100, 2, 2, 2),
    (13, 17, 13, 13),
    (64, 64, 64, 64),
    (1, 100, 100, 1),
    (100, 100, 1, 1),
    (37, 41, 43, 41),
    (10, 20, 30, 20),
]

HAPPY_K = [
    1, 2, 3, 10, 100, 1000, 12345, 99999999, 100000000, 5,
    7, 11, 42, 256, 999, 1024, 31415, 4242, 65535, 86420,
]

OLYMPIAD_CASES = [
    (1, 1, 1, 1),
    (100, 100, 100, 100),
    (19, 6, 20, 3),
    (1, 100, 1, 100),
    (100, 1, 100, 1),
    (2, 3, 4, 5),
    (99, 99, 99, 99),
    (1, 1, 1, 100),
    (50, 50, 50, 50),
    (7, 8, 9, 10),
    (33, 21, 13, 5),
    (100, 1, 1, 1),
    (1, 100, 100, 100),
    (10, 10, 10, 10),
    (64, 32, 16, 8),
    (17, 19, 23, 29),
    (3, 3, 3, 3),
    (100, 100, 1, 1),
    (2, 2, 2, 2),
    (12, 34, 56, 78),
]


def _write_pairs(slug: str, samples, hidden):
    directory = OUT / slug
    directory.mkdir(parents=True, exist_ok=True)

    # Samples first: load_problem_tests orders by file name, and a leading
    # zero-padded index keeps that order stable.
    for index, (payload, expected) in enumerate(samples, start=1):
        (directory / f"sample_{index}.in").write_text(payload, encoding="utf-8")
        (directory / f"sample_{index}.out").write_text(f"{expected}\n", encoding="utf-8")

    for index, (payload, expected) in enumerate(hidden, start=1):
        (directory / f"{index:02d}.in").write_text(payload, encoding="utf-8")
        (directory / f"{index:02d}.out").write_text(f"{expected}\n", encoding="utf-8")

    return directory


def main():
    rng = random.Random(20261112)

    # Үш сан — four lines: a, b, c, d. d is always one of a/b/c.
    ush_samples = [("2\n5\n7\n5\n", 14), ("10\n10\n5\n10\n", 50)]
    ush_hidden = []
    for a, b, c, d in US_HIDDEN:
        ush_hidden.append((f"{a}\n{b}\n{c}\n{d}\n", solve_ush_san(a, b, c, d)))
    for _ in range(10):
        a, b, c = (rng.randint(1, 100) for _ in range(3))
        d = rng.choice([a, b, c])
        ush_hidden.append((f"{a}\n{b}\n{c}\n{d}\n", solve_ush_san(a, b, c, d)))

    # Қуанышты сандар — a single integer k.
    happy_samples = [("2\n", 225)]
    happy_hidden = [(f"{k}\n", solve_happy(k)) for k in HAPPY_K]

    # Олимпиада — A B C D on one line.
    olym_samples = [("19 6 20 3\n", 6840)]
    olym_hidden = [
        (f"{a} {b} {c} {d}\n", solve_olympiad(a, b, c, d))
        for a, b, c, d in OLYMPIAD_CASES
    ]
    for _ in range(10):
        a, b, c, d = (rng.randint(1, 100) for _ in range(4))
        olym_hidden.append((f"{a} {b} {c} {d}\n", solve_olympiad(a, b, c, d)))

    written = []
    written.append(_write_pairs("24-ro-104-a", ush_samples, ush_hidden))
    written.append(_write_pairs("21-ro-112cs-b", happy_samples, happy_hidden))
    written.append(_write_pairs("21-ro-112cs-a", olym_samples, olym_hidden))

    for directory in written:
        pairs = len(list(directory.glob("*.in")))
        print(f"{directory.relative_to(BASE)}: {pairs} test(s)")

    # Sanity: the k-th happy number must match the definition for small k.
    for k in range(1, 6):
        assert solve_happy(k) == (10 * k - 5) ** 2
    print("reference solutions self-checked")


if __name__ == "__main__":
    main()