"""Register a cohort of students with a fixed registration date.

The school enters children by name, so this command derives a handle and an
internal e-mail for each of them, sets a generated password, and backdates
``created_at`` to the day they actually signed up.

Usage::

    python manage.py seed_students --registered 2026-11-10
    python manage.py seed_students --registered 2026-11-10 --dry-run

It is idempotent: a student whose handle or e-mail already exists is skipped
unless ``--update`` is passed, in which case the profile fields are refreshed
but the password is left alone.
"""

import os
import secrets
import string
from datetime import datetime, timezone as dt_timezone

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from apps.users.models import CustomUser

# Name (Kazakh) -> (handle, e-mail local part). Handles must match
# ^[a-zA-Z0-9_]{3,20}$ and stay unique, so they are transliterated by hand
# rather than auto-generated from Cyrillic.
DEFAULT_STUDENTS = [
    ("Кенесов Нурали", "nurali_kenesov"),
    ("Берлигужина Аделина", "adelina_berliguzhina"),
    ("Ғабдолла Дарын", "daryn_gabdolla"),
    ("Кенжегалиев Хасан", "hasan_kenzhegaliev"),
    ("Тлекова Камила", "kamila_tlekova"),
    ("Ертайқызы Азила", "azila_ertaiqyzy"),
]


def _password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits
    # Guarantee one lower, one upper and one digit so any future policy check
    # on the login form accepts the generated value.
    chars = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
    ]
    chars += [secrets.choice(alphabet) for _ in range(length - len(chars))]
    # Fisher-Yates with a CSPRNG; random.shuffle would use Mersenne Twister.
    for index in range(len(chars) - 1, 0, -1):
        swap = secrets.randbelow(index + 1)
        chars[index], chars[swap] = chars[swap], chars[index]
    return "".join(chars)


class Command(BaseCommand):
    help = "Register students with a fixed registration date and generated credentials."

    def add_arguments(self, parser):
        parser.add_argument(
            "--registered",
            required=True,
            help="Registration date to backdate to, e.g. 2026-11-10 or 2026-11-10T09:00:00Z.",
        )
        parser.add_argument(
            "--domain",
            default="olympiad.local",
            help="E-mail domain used for the generated addresses (default: olympiad.local).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without writing to the database.",
        )
        parser.add_argument(
            "--update",
            action="store_true",
            help="Refresh school/class of existing students instead of skipping them.",
        )
        parser.add_argument(
            "--password",
            default=os.environ.get("SEED_STUDENT_PASSWORD") or None,
            help=(
                "Use one password for every created student instead of generating "
                "unique ones. Also read from SEED_STUDENT_PASSWORD. Leave unset to "
                "generate and print per-student passwords."
            ),
        )

    def handle(self, *args, **options):
        registered = self._parse_date(options["registered"])
        domain = options["domain"].lstrip("@")
        dry_run = options["dry_run"]
        shared_password = options["password"]

        self.stdout.write(f"Registration date: {registered.isoformat()}")
        if shared_password:
            self.stdout.write(
                self.style.WARNING(
                    "Using one shared password for every new student "
                    "(from --password / SEED_STUDENT_PASSWORD)."
                )
            )
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no rows will be written."))

        created, skipped, updated = [], [], []
        for name, handle in DEFAULT_STUDENTS:
            email = f"{handle}@{domain}"
            existing = CustomUser.objects.filter(handle__iexact=handle).first()
            if existing:
                if options["update"]:
                    existing.school = "Школа №1"
                    existing.class_name = "10"
                    existing.save(update_fields=["school", "class_name"])
                    updated.append((existing.handle, existing.email))
                else:
                    skipped.append((handle, email))
                continue

            if dry_run:
                created.append((handle, email, "<generated>"))
                continue

            password = shared_password or _password()
            with transaction.atomic():
                user = CustomUser.objects.create_user(
                    email=email,
                    handle=handle,
                    password=password,
                    role="student",
                    is_verified=True,
                    school="Школа №1",
                    class_name="10",
                )
                # created_at is auto_now_add, so the real registration day has to
                # be written with an UPDATE after the INSERT.
                CustomUser.objects.filter(pk=user.pk).update(created_at=registered)
            created.append((handle, email, password))

        self.stdout.write(self.style.SUCCESS(f"created: {len(created)}"))
        for handle, email, password in created:
            self.stdout.write(f"  {handle:22s} {email:38s} {password}")
        if skipped:
            self.stdout.write(f"skipped (already exist): {len(skipped)}")
            for handle, email in skipped:
                self.stdout.write(f"  {handle:22s} {email}")
        if updated:
            self.stdout.write(f"updated: {len(updated)}")

    @staticmethod
    def _parse_date(value: str) -> datetime:
        parsed = parse_datetime(value)
        if parsed is None:
            raise CommandError(f"Unrecognized date: {value!r}. Use ISO format, e.g. 2026-11-10.")
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt_timezone.utc)
        return parsed