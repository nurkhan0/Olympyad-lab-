"""Seed registrations and submissions for one contest.

Gives a freshly created contest a believable scoreboard: every student has at
least one attempt, some solve, some only try. Useful for demos and for checking
that standings, penalties and the arena render correctly.

Usage::

    python manage.py seed_contest_activity --contest-title "Үш сан, Қуанышты сандар, Олимпиада"
    python manage.py seed_contest_activity --contest-title "..." --dry-run
    python manage.py seed_contest_activity --contest-title "..." --reset

Idempotent: a student who already has submissions in the contest is left alone
unless ``--reset`` is passed. Submission timestamps are backdated into the
contest window, because standings only count submissions created between
``start_time`` and the end of the contest.

These are demo attempts, not real judging: the verdict is written directly, so
the row does not depend on a Celery worker being available.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.contests.models import Contest, ContestRegistration
from apps.problems.models import Problem
from apps.submissions.models import Submission
from apps.users.models import CustomUser

# handle, problem slug, verdict, minutes after the contest start
#
# The shape of the scoreboard: everyone attempts something, Adelina solves all
# three, two students solve exactly one, two solve nothing but try twice.
ACTIVITY = [
    ("adelina_berliguzhina", "24-ro-104-a", "AC", 10),
    ("adelina_berliguzhina", "21-ro-112cs-b", "WA", 15),
    ("adelina_berliguzhina", "21-ro-112cs-b", "AC", 22),
    ("adelina_berliguzhina", "21-ro-112cs-a", "AC", 40),
    ("nurali_kenesov", "24-ro-104-a", "AC", 12),
    ("nurali_kenesov", "21-ro-112cs-b", "WA", 18),
    ("nurali_kenesov", "21-ro-112cs-b", "WA", 30),
    ("daryn_gabdolla", "24-ro-104-a", "AC", 8),
    ("daryn_gabdolla", "21-ro-112cs-a", "WA", 25),
    ("hasan_kenzhegaliev", "21-ro-112cs-a", "AC", 33),
    ("kamila_tlekova", "21-ro-112cs-b", "WA", 14),
    ("kamila_tlekova", "21-ro-112cs-b", "WA", 28),
    ("azila_ertaiqyzy", "24-ro-104-a", "WA", 9),
    ("azila_ertaiqyzy", "21-ro-112cs-a", "WA", 20),
]

CORRECT_CODE = {
    "24-ro-104-a": """import sys

data = sys.stdin.read().split()
a, b, c, d = (int(x) for x in data[:4])
if d == a:
    print(b * c)
elif d == b:
    print(a * c)
else:
    print(a * b)
""",
    "21-ro-112cs-b": """k = int(input())
root = 10 * k - 5
print(root * root)
""",
    "21-ro-112cs-a": """a, b, c, d = (int(x) for x in input().split())
print(a * b * c * d)
""",
}

# Deliberately wrong: the shape is right, the logic is not. A WA row should be
# explainable by reading the code, not random noise.
WRONG_CODE = {
    "24-ro-104-a": """a = int(input())
b = int(input())
c = int(input())
d = int(input())
print(a * b * c)
""",
    "21-ro-112cs-b": """k = int(input())
print((10 * k) ** 2)
""",
    "21-ro-112cs-a": """a, b, c, d = (int(x) for x in input().split())
print(a + b + c + d)
""",
}


class Command(BaseCommand):
    help = "Seed registrations and submissions so a contest has a scoreboard."

    def add_arguments(self, parser):
        parser.add_argument("--contest-title", required=True,
                            help="Exact title of the contest to populate.")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--reset", action="store_true",
                            help="Seed even if the student already has submissions.")

    def handle(self, *args, **options):
        contest = Contest.objects.filter(title=options["contest_title"]).first()
        if contest is None:
            raise CommandError(f"No contest titled {options['contest_title']!r}.")

        problems = {p.slug: p for p in Problem.objects.filter(
            slug__in={row[1] for row in ACTIVITY}
        )}
        dry_run = options["dry_run"]
        reset = options["reset"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be written."))

        registrations, created, skipped = 0, 0, 0
        for handle, slug, verdict, minute in ACTIVITY:
            user = CustomUser.objects.filter(handle__iexact=handle).first()
            if user is None:
                self.stderr.write(f"  skip {handle}: no such user")
                continue
            problem = problems.get(slug)
            if problem is None:
                self.stderr.write(f"  skip {slug}: no such problem")
                continue

            if not dry_run and not ContestRegistration.objects.filter(
                contest=contest, user=user
            ).exists():
                ContestRegistration.objects.create(contest=contest, user=user)
                registrations += 1

            created_at = contest.start_time + timedelta(minutes=minute)

            # Idempotency is per (student, problem, moment): a student has many
            # attempts in one contest, so "does this student have any submission"
            # would collapse the whole matrix into a single row per student.
            already = Submission.objects.filter(
                contest=contest, user=user, problem=problem, created_at=created_at
            ).exists()
            if already and not reset:
                skipped += 1
                continue

            code = (CORRECT_CODE if verdict == "AC" else WRONG_CODE).get(slug, "")
            language = "cpp" if (slug == "24-ro-104-a" and verdict == "AC") else "python"
            self.stdout.write(
                f"  {handle:22s} {slug:16s} {verdict} +{minute:>3d} min"
            )

            if dry_run:
                created += 1
                continue

            with transaction.atomic():
                submission = Submission.objects.create(
                    user=user,
                    problem=problem,
                    contest=contest,
                    code=code,
                    language=language,
                    status="done",
                    verdict=verdict,
                    time_ms=40 + (minute % 7) * 15,
                    memory_kb=15000 + (minute % 5) * 2048,
                )
                # created_at is auto_now_add, so the attempt is backdated into
                # the contest window with an UPDATE after the INSERT.
                Submission.objects.filter(pk=submission.pk).update(created_at=created_at)
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"contest #{contest.pk}: {created} submission(s) written, "
                f"{registrations} registration(s), {skipped} student(s) already had attempts"
            )
        )