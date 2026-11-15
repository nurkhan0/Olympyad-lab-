"""Seed everything the olympiad demo needs — safe to run on every boot.

This is the single entry point used by ``scripts/entrypoint.sh`` when
``SEED_ON_BOOT`` is not disabled. Everything it does is idempotent:

1. ``import_olympiad_set`` — the tour problems, sample tests, tags, contests;
2. ``load_problem_tests``  — hidden tests from ``data/tests/<slug>/``;
3. ``create_contest``      — the hand-picked contests from
   ``data/custom_contests.json`` (for example the 12 November tour that mixes
   problems from different years);
4. ``seed_contest_activity`` — registrations and attempts, so a new contest has a
   scoreboard instead of an empty table;
5. ``seed_students``       — the six students with a backdated registration date.

Re-running updates statements and tests in place; it does not duplicate problems,
contests, submissions or students.

Environment variables (all optional):

* ``SEED_CONTEST_START``   — ISO datetime that overrides the start of every
  seeded contest; unset means "keep what the JSON says", which is also what a
  redeploy should do to a contest that already exists.
* ``SEED_REGISTERED``      — registration date backdated onto the students;
  default: ``2026-11-10``.
* ``SEED_STUDENT_PASSWORD``— one shared password for the students; default:
  generate a unique password per student and print it once to the log.
* ``SEED_STUDENT_DOMAIN``  — e-mail domain for the generated addresses;
  default: ``olympiad.local``.
* ``SEED_CONTEST_CREATOR`` — handle or e-mail the contests belong to; default:
  the first superuser, which is the account from the initial-users migration.
* ``SEED_RESET_STUDENT_PASSWORD`` — rewrite the students' passwords on boot.
  Turn it off again afterwards.

Usage::

    python manage.py seed_olympiad_data
    python manage.py seed_olympiad_data --dry-run
    python manage.py seed_olympiad_data --skip-activity
"""

import json
import os
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

DEFAULT_REGISTERED = "2026-11-10"
DEFAULT_DOMAIN = "olympiad.local"
TESTS_DIR = Path(settings.BASE_DIR) / "data" / "tests"
CONTESTS_FILE = Path(settings.BASE_DIR) / "data" / "custom_contests.json"


class Command(BaseCommand):
    help = "Idempotently seed olympiad problems, tests, contests, activity and students."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true",
                            help="Report what would be written, write nothing.")
        parser.add_argument("--skip-problems", action="store_true",
                            help="Do not import tour problems, tests or custom contests.")
        parser.add_argument("--skip-activity", action="store_true",
                            help="Do not seed registrations and submissions.")
        parser.add_argument("--skip-students", action="store_true",
                            help="Do not create students.")
        parser.add_argument("--group", choices=("set", "single"), default="set",
                            help="Passed through to import_olympiad_set.")
        parser.add_argument("--file", help="Override the problem-set JSON path.")
        parser.add_argument("--creator", help="Contest owner (handle or e-mail).")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        verbosity = options["verbosity"]

        if not options["skip_problems"]:
            self._seed_problems(options, dry_run, verbosity)
        else:
            self.stdout.write("skipping problems (--skip-problems)")

        # Students come before the activity: seeding attempts for handles that
        # do not exist yet would silently skip every row.
        if not options["skip_students"]:
            kwargs = {
                "registered": os.environ.get("SEED_REGISTERED") or DEFAULT_REGISTERED,
                "domain": os.environ.get("SEED_STUDENT_DOMAIN") or DEFAULT_DOMAIN,
                "dry_run": dry_run,
                "verbosity": verbosity,
            }
            password = os.environ.get("SEED_STUDENT_PASSWORD")
            if password:
                kwargs["password"] = password
            call_command("seed_students", **kwargs)
        else:
            self.stdout.write("skipping students (--skip-students)")

        if not options["skip_activity"]:
            self._seed_activity(dry_run, verbosity)
        else:
            self.stdout.write("skipping contest activity (--skip-activity)")

        self.stdout.write(self.style.SUCCESS("seed_olympiad_data: done"))

    # -------------------------------------------------------------------- stages

    def _seed_problems(self, options, dry_run, verbosity):
        kwargs = {
            "all": True,
            "group": options["group"],
            "dry_run": dry_run,
            "verbosity": verbosity,
        }
        if options["file"]:
            kwargs["file"] = options["file"]
        creator = options["creator"] or os.environ.get("SEED_CONTEST_CREATOR")
        if creator:
            kwargs["creator"] = creator
        seed_start = os.environ.get("SEED_CONTEST_START")
        if seed_start:
            kwargs["start"] = seed_start
        call_command("import_olympiad_set", **kwargs)

        # Hidden tests: one directory per problem slug.
        if TESTS_DIR.is_dir():
            for directory in sorted(TESTS_DIR.iterdir()):
                if not directory.is_dir() or not list(directory.glob("*.in")):
                    continue
                call_command("load_problem_tests", slug=directory.name, dry_run=dry_run,
                             verbosity=verbosity)

        # Hand-picked contests (for example the 12 November tour).
        if not CONTESTS_FILE.exists():
            return
        for entry in json.loads(CONTESTS_FILE.read_text(encoding="utf-8")):
            kwargs = {
                "title": entry["title"],
                "slug": entry["slugs"],
                "duration": entry.get("duration", 180),
                "dry_run": dry_run,
                "verbosity": verbosity,
            }
            if entry.get("start"):
                kwargs["start"] = entry["start"]
            if creator:
                kwargs["creator"] = creator
            call_command("create_contest", **kwargs)

    def _seed_activity(self, dry_run, verbosity):
        if not CONTESTS_FILE.exists():
            return
        for entry in json.loads(CONTESTS_FILE.read_text(encoding="utf-8")):
            call_command("seed_contest_activity", contest_title=entry["title"],
                         dry_run=dry_run, verbosity=verbosity)