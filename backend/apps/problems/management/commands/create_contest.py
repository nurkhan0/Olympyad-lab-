"""Create (or update) a contest from an explicit list of problem slugs.

Unlike ``import_olympiad_set``, which works from the tour JSON, this command
takes the problems you name — used for the hand-picked 12 November contest that
mixes problems from different tours.

Usage::

    python manage.py create_contest \
        --title "Үш сан, Қуанышты сандар, Олимпиада" \
        --slug 24-ro-104-a --slug 21-ro-112cs-b --slug 21-ro-112cs-a \
        --start 2026-11-12T09:00:00Z

A contest is matched by its exact title, so re-running updates it in place
instead of creating a second one. ``start_time`` only moves when ``--start`` is
passed explicitly; problem links are added or re-labelled, never duplicated.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.contests.models import Contest, ContestProblem
from apps.problems.models import Problem
from apps.users.models import CustomUser

DEFAULT_DURATION = 180
DEFAULT_POINTS = 100
REGISTRATION_LEAD_DAYS = 7


class Command(BaseCommand):
    help = "Create or update a contest from a list of problem slugs."

    def add_arguments(self, parser):
        parser.add_argument("--title", required=True, help="Exact contest title (matched on re-run).")
        parser.add_argument("--slug", action="append", default=[], dest="slugs",
                            help="Problem slug to include (repeatable, order defines A, B, C...).")
        parser.add_argument("--start", help="ISO datetime; also moves an existing contest.")
        parser.add_argument("--duration", type=int, default=DEFAULT_DURATION,
                            help=f"Contest length in minutes (default {DEFAULT_DURATION}).")
        parser.add_argument("--points", type=int, default=DEFAULT_POINTS,
                            help=f"Points per problem (default {DEFAULT_POINTS}).")
        parser.add_argument("--creator", help="Contest owner (handle or e-mail).")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        if not options["slugs"]:
            raise CommandError("Pass at least one --slug.")

        problems = []
        for slug in options["slugs"]:
            problem = Problem.objects.filter(slug=slug).first()
            if problem is None:
                raise CommandError(f"No problem with slug {slug!r}.")
            problems.append(problem)

        start_explicit = options["start"] is not None
        start = self._parse_start(options["start"])
        creator = self._resolve_creator(options["creator"])
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be written."))
            for index, problem in enumerate(problems):
                self.stdout.write(f"  {chr(ord('A') + index)}  {problem.slug}  {problem.title}")
            return

        contest, created = self._upsert_contest(
            options["title"], start, options["duration"], creator, start_explicit
        )
        for index, problem in enumerate(problems):
            label = chr(ord("A") + index)
            link = ContestProblem.objects.filter(contest=contest, problem=problem).first()
            if link is None:
                ContestProblem.objects.create(
                    contest=contest, problem=problem, label=label,
                    order=index + 1, points=options["points"],
                )
            elif (link.label, link.order, link.points) != (label, index + 1, options["points"]):
                link.label, link.order, link.points = label, index + 1, options["points"]
                link.save(update_fields=["label", "order", "points"])

        verb = "created" if created else "updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"contest #{contest.pk} {verb} '{contest.title}' ← {len(problems)} problem(s), "
                f"start {contest.start_time.isoformat()}, duration {contest.duration_minutes} min"
            )
        )

    # -------------------------------------------------------------------- helpers

    @staticmethod
    def _parse_start(value):
        if not value:
            return timezone.now() + timedelta(days=7)
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

    def _upsert_contest(self, title, start, duration, creator, start_explicit):
        contest = Contest.objects.filter(title=title).first()
        if contest is None:
            with transaction.atomic():
                contest = Contest.objects.create(
                    title=title,
                    description="",
                    contest_type="CF",
                    start_time=start,
                    duration_minutes=duration,
                    registration_start=start - timedelta(days=REGISTRATION_LEAD_DAYS),
                    registration_end=start,
                    is_public=True,
                    is_published=True,
                    is_rated=False,
                    created_by=creator,
                )
            return contest, True

        contest.duration_minutes = duration
        if contest.created_by is None:
            contest.created_by = creator
        if start_explicit:
            contest.start_time = start
        contest.registration_start = contest.start_time - timedelta(days=REGISTRATION_LEAD_DAYS)
        contest.registration_end = contest.start_time
        contest.is_public = True
        contest.is_published = True
        contest.is_rated = False
        contest.save()
        return contest, False