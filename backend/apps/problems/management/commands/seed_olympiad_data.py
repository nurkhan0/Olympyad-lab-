"""Seed everything the olympiad demo needs — safe to run on every boot.

This is the single entry point used by ``scripts/entrypoint.sh`` when
``SEED_ON_BOOT`` is not disabled. It only does idempotent work:

* ``import_olympiad_set`` — problems, sample tests, tags and the contest(s);
* ``seed_students``       — the six students with a backdated registration date.

Neither command duplicates rows on a second run, so a redeploy refreshes the
statements and picks up new problems without creating a second contest or
overwriting the students' passwords.

Environment variables (all optional):

* ``SEED_CONTEST_START``   — ISO datetime for the contest start; default: a week
  from the first run, so registration is open.
* ``SEED_REGISTERED``      — registration date backdated onto the students;
  default: ``2026-11-10``.
* ``SEED_STUDENT_PASSWORD``— one shared password for the students; default:
  generate a unique password per student and print it once to the log.
* ``SEED_STUDENT_DOMAIN``  — e-mail domain for the generated addresses;
  default: ``olympiad.local``.
* ``SEED_CONTEST_CREATOR`` — handle or e-mail the contests belong to; default:
  the first superuser, which is the account from the initial-users migration.

Usage::

    python manage.py seed_olympiad_data
    python manage.py seed_olympiad_data --dry-run
    python manage.py seed_olympiad_data --skip-students
"""

import os

from django.core.management import call_command
from django.core.management.base import BaseCommand

DEFAULT_REGISTERED = "2026-11-10"
DEFAULT_DOMAIN = "olympiad.local"


class Command(BaseCommand):
    help = "Idempotently seed olympiad problems, contests and students."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true",
                            help="Report what would be written, write nothing.")
        parser.add_argument("--skip-problems", action="store_true",
                            help="Do not import problems/contests.")
        parser.add_argument("--skip-students", action="store_true",
                            help="Do not create students.")
        parser.add_argument("--group", choices=("set", "single"), default="set",
                            help="Passed through to import_olympiad_set.")
        parser.add_argument("--file", help="Override the problem-set JSON path.")
        parser.add_argument("--creator", help="Contest owner (handle or e-mail).")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if not options["skip_problems"]:
            kwargs = {
                "all": True,
                "group": options["group"],
                "dry_run": dry_run,
                "verbosity": options["verbosity"],
            }
            if options["file"]:
                kwargs["file"] = options["file"]
            creator = options["creator"] or os.environ.get("SEED_CONTEST_CREATOR")
            if creator:
                kwargs["creator"] = creator
            # Only pass --start when configured, so a redeploy never moves the
            # start time of a contest that already exists.
            seed_start = os.environ.get("SEED_CONTEST_START")
            if seed_start:
                kwargs["start"] = seed_start
            call_command("import_olympiad_set", **kwargs)
        else:
            self.stdout.write("skipping problems (--skip-problems)")

        if not options["skip_students"]:
            kwargs = {
                "registered": os.environ.get("SEED_REGISTERED") or DEFAULT_REGISTERED,
                "domain": os.environ.get("SEED_STUDENT_DOMAIN") or DEFAULT_DOMAIN,
                "dry_run": dry_run,
                "verbosity": options["verbosity"],
            }
            password = os.environ.get("SEED_STUDENT_PASSWORD")
            if password:
                kwargs["password"] = password
            call_command("seed_students", **kwargs)
        else:
            self.stdout.write("skipping students (--skip-students)")

        self.stdout.write(self.style.SUCCESS("seed_olympiad_data: done"))