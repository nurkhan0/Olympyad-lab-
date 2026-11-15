"""Load ``.in``/``.out`` test pairs from a directory into a problem.

Files are read from ``backend/data/tests/<slug>/`` by default:

* ``sample_*.in`` / ``sample_*.out`` — visible samples (marked ``is_sample``);
* ``NN.in`` / ``NN.out``           — hidden tests.

Usage::

    python manage.py load_problem_tests --slug 24-ro-104-a
    python manage.py load_problem_tests --slug 21-ro-112cs-b --dir /tmp/tests
    python manage.py load_problem_tests --slug 24-ro-104-a --dry-run

The loader is idempotent: tests are upserted by ``order`` (samples occupy the
leading positions), and a test that is no longer on disk is deleted. A problem
therefore always ends up with exactly the tests in the directory — re-running
never appends a second copy.
"""

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.problems.models import Problem, TestCase

DEFAULT_ROOT = Path(settings.BASE_DIR) / "data" / "tests"


class Command(BaseCommand):
    help = "Load .in/.out test pairs into a problem's test cases."

    def add_arguments(self, parser):
        parser.add_argument("--slug", required=True, help="Problem slug, e.g. 24-ro-104-a.")
        parser.add_argument("--dir", dest="directory",
                            help="Directory with the pairs (default: data/tests/<slug>).")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        slug = options["slug"]
        problem = Problem.objects.filter(slug=slug).first()
        if problem is None:
            raise CommandError(f"No problem with slug {slug!r}.")

        directory = Path(options["directory"]) if options["directory"] else DEFAULT_ROOT / slug
        if not directory.is_dir():
            raise CommandError(f"No such directory: {directory}")

        pairs = self._read_pairs(directory)
        if not pairs:
            raise CommandError(f"No .in/.out pairs found in {directory}")

        self.stdout.write(
            f"{slug}: {len(pairs)} pair(s) from {directory} "
            f"({sum(1 for p in pairs if p['is_sample'])} sample, "
            f"{sum(1 for p in pairs if not p['is_sample'])} hidden)"
        )
        if options["dry_run"]:
            for pair in pairs:
                kind = "sample" if pair["is_sample"] else "hidden"
                self.stdout.write(f"  #{pair['order']:<3d} {kind}")
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be written."))
            return

        with transaction.atomic():
            problem.test_cases.exclude(order__in=[p["order"] for p in pairs]).delete()
            for pair in pairs:
                TestCase.objects.update_or_create(
                    problem=problem,
                    order=pair["order"],
                    defaults={
                        "input": pair["input"],
                        "expected_output": pair["expected_output"],
                        "is_sample": pair["is_sample"],
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"{slug}: {problem.test_cases.count()} test case(s) stored "
                f"({problem.test_cases.filter(is_sample=True).count()} sample)"
            )
        )

    @staticmethod
    def _read_pairs(directory: Path):
        """Read pairs, samples first, then hidden tests by numeric order."""
        samples, hidden = [], []
        for path in sorted(directory.glob("*.in")):
            out_path = path.with_suffix(".out")
            if not out_path.exists():
                raise CommandError(f"{path.name} has no matching .out file.")
            is_sample = path.stem.startswith("sample_")
            entry = {
                "name": path.stem,
                "input": path.read_text(encoding="utf-8"),
                "expected_output": out_path.read_text(encoding="utf-8"),
                "is_sample": is_sample,
            }
            (samples if is_sample else hidden).append(entry)

        def order_key(entry):
            """Numeric file names order 2 before 10; anything else sorts last."""
            tail = entry["name"].rsplit("_", 1)[-1]
            return (0, int(tail), entry["name"]) if tail.isdigit() else (1, 0, entry["name"])

        ordered = []
        for order, entry in enumerate(sorted(samples, key=order_key), start=1):
            ordered.append({**entry, "order": order})
        for order, entry in enumerate(sorted(hidden, key=order_key), start=len(samples) + 1):
            ordered.append({**entry, "order": order})
        return ordered