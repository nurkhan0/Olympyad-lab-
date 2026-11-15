"""Import an olympiad problem set from a JSON file into problems + a contest.

The JSON format is the one produced by extracting the tour PDFs::

    [
      {
        "key": "24-ro-104",
        "contest_title": "...",
        "problems": [
          {
            "label": "A",
            "title": "...",
            "difficulty": "easy|medium|hard|expert",
            "statement": "markdown",
            "samples": [{"input": "...", "output": "..."}]
          }
        ]
      }
    ]

Usage::

    python manage.py import_olympiad_set --all
    python manage.py import_olympiad_set --set 24-ro-104 --start 2026-11-20T09:00:00Z
    python manage.py import_olympiad_set --all --group single --creator nurkhan

Problems are created published but contest-only, so they stay out of the public
problem list until the contest ends. ``--group set`` (default) creates one
contest per source tour; ``--group single`` merges every selected set into one
contest with sequentially assigned labels.

Every run is idempotent: a problem is matched by its deterministic slug, so
re-running the same command updates statements and samples instead of creating
duplicates. Contest rows are the exception — pass ``--contest-title`` or expect
one new contest per run.
"""

import json
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from apps.contests.models import Contest, ContestProblem
from apps.problems.models import Problem, ProblemTag, Tag
from apps.users.models import CustomUser

DEFAULT_DATA = Path(settings.BASE_DIR) / "data" / "olympiad_informatics_sets.json"
DEFAULT_POINTS = 100
MERGED_CONTEST_TITLE = "Республиканская олимпиада по информатике (2-й этап)"


class Command(BaseCommand):
    help = "Import olympiad problems from a JSON file and build contest(s) around them."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Import every set in the file.")
        parser.add_argument("--set", action="append", default=[], dest="sets",
                            help="Import only this set key (repeatable).")
        parser.add_argument("--file", default=str(DEFAULT_DATA), help="Path to the JSON data file.")
        parser.add_argument(
            "--group", choices=("set", "single"), default="set",
            help="'set' = one contest per source tour; 'single' = one contest for all sets.",
        )
        parser.add_argument("--start",
                            help="Contest start, e.g. 2026-11-20T09:00:00Z (default: now).")
        parser.add_argument("--duration", type=int, default=120, help="Contest length in minutes.")
        parser.add_argument("--creator", help="Handle or e-mail of the contest owner.")
        parser.add_argument("--dry-run", action="store_true")

    # ---------------------------------------------------------------- entry point

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            raise CommandError(f"Data file not found: {path}")
        sets = json.loads(path.read_text(encoding="utf-8"))

        if not options["all"] and not options["sets"]:
            raise CommandError("Pass --all or at least one --set KEY.")
        if options["sets"]:
            wanted = set(options["sets"])
            unknown = wanted - {s["key"] for s in sets}
            if unknown:
                raise CommandError(f"Unknown set key(s): {', '.join(sorted(unknown))}")
            sets = [s for s in sets if s["key"] in wanted]

        start = self._parse_start(options["start"])
        creator = self._resolve_creator(options["creator"])
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be written."))

        if options["group"] == "single":
            self._create_contest(MERGED_CONTEST_TITLE, sets, start, options["duration"],
                                 creator, dry_run)
            return

        for entry in sets:
            self._create_contest(entry["contest_title"], [entry], start, options["duration"],
                                 creator, dry_run)

    # -------------------------------------------------------------------- helpers

    @staticmethod
    def _parse_start(value):
        if not value:
            return timezone.now()
        parsed = parse_datetime(value)
        if parsed is None:
            raise CommandError(f"Unrecognized --start value: {value!r}")
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed)
        return parsed

    def _resolve_creator(self, value) -> CustomUser:
        if value:
            user = (CustomUser.objects.filter(handle__iexact=value).first()
                    or CustomUser.objects.filter(email__iexact=value).first())
            if user is None:
                raise CommandError(f"No user matches --creator {value!r}.")
            return user

        user = CustomUser.objects.filter(is_superuser=True).first()
        if user is None:
            raise CommandError(
                "No superuser found. Pass --creator <handle|email> so the contest has an owner."
            )
        return user

    @staticmethod
    def _problem_slug(set_key: str, label: str, title: str) -> str:
        """Deterministic slug: unique per tour/label, readable, safe to re-run."""
        return slugify(f"{set_key}-{label}-{title}") or "problem"

    def _upsert_problem(self, set_key: str, label: str, data: dict, dry_run: bool):
        slug = self._problem_slug(set_key, label, data["title"])
        problem = Problem.objects.filter(slug=slug).first()

        if dry_run:
            return problem

        fields = {
            "title": data["title"].strip(),
            "difficulty": data.get("difficulty", "medium"),
            "statement": data["statement"].strip(),
            "time_ms": data.get("time_ms", 1000),
            "memory_mb": data.get("memory_mb", 256),
            "status": "published",
            "visibility": "contest",
        }
        if problem is None:
            problem = Problem.objects.create(slug=slug, **fields)
        else:
            for name, value in fields.items():
                setattr(problem, name, value)
            problem.save()

        tag, _ = Tag.objects.get_or_create(name="olympiad", defaults={"slug": "olympiad"})
        if not ProblemTag.objects.filter(problem=problem, tag=tag).exists():
            ProblemTag.objects.create(problem=problem, tag=tag)

        # Samples are test cases too, so the arena can show them before the
        # contest starts. Only samples are created here — the real tests come
        # from the jury.
        for order, sample in enumerate(data.get("samples", []), start=1):
            test = problem.test_cases.filter(order=order).first()
            if test is None:
                problem.test_cases.create(
                    input=sample["input"],
                    expected_output=sample["output"],
                    is_sample=True,
                    order=order,
                )
            else:
                test.input = sample["input"]
                test.expected_output = sample["output"]
                test.is_sample = True
                test.save(update_fields=["input", "expected_output", "is_sample"])
        return problem

    @staticmethod
    def _next_label(used) -> str:
        for index in range(26):
            candidate = chr(ord("A") + index)
            if candidate not in used:
                return candidate
        raise CommandError("A contest cannot hold more than 26 problems.")

    def _create_contest(self, title: str, sets, start, duration, creator, dry_run) -> None:
        prepared = []
        for entry in sets:
            for data_problem in entry["problems"]:
                problem = self._upsert_problem(
                    entry["key"], data_problem["label"], data_problem, dry_run
                )
                prepared.append(problem)

        if dry_run:
            self.stdout.write(f"[dry-run] contest '{title}' ← {len(prepared)} problem(s)")
            for problem in prepared:
                self.stdout.write(f"    {getattr(problem, 'slug', '?')}")
            return

        with transaction.atomic():
            contest = Contest.objects.create(
                title=title,
                description="",
                contest_type="CF",
                start_time=start,
                duration_minutes=duration,
                registration_start=start - timedelta(days=7),
                registration_end=start,
                is_public=True,
                is_published=True,
                is_rated=False,
                created_by=creator,
            )
            used = set()
            for order, problem in enumerate(prepared, start=1):
                label = self._next_label(used)
                used.add(label)
                ContestProblem.objects.create(
                    contest=contest, problem=problem, label=label, order=order,
                    points=DEFAULT_POINTS,
                )

        self.stdout.write(
            self.style.SUCCESS(f"contest #{contest.pk} '{contest.title}' ← {len(prepared)} problem(s)")
        )