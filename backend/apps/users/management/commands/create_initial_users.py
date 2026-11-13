import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = 'Create initial users (admin, teacher, student) from environment variables'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Required passwords from environment
        required_env = {
            'admin': 'ADMIN_PWD',
            'teacher': 'TEACHER_PWD',
            'student': 'STUDENT_PWD',
        }

        missing = [var for var in required_env.values() if not os.environ.get(var)]
        if missing:
            raise CommandError(
                f'Missing required environment variables: {", ".join(missing)}. '
                f'Set them before running this command.'
            )

        users_to_create = [
            {
                'role': 'admin',
                'email': os.environ.get('ADMIN_EMAIL', 'admin@example.com'),
                'handle': os.environ.get('ADMIN_HANDLE', 'admin'),
                'password': os.environ['ADMIN_PWD'],
                'is_staff': True,
                'is_superuser': True,
                'is_verified': True,
            },
            {
                'role': 'teacher',
                'email': os.environ.get('TEACHER_EMAIL', 'teacher@example.com'),
                'handle': os.environ.get('TEACHER_HANDLE', 'teacher'),
                'password': os.environ['TEACHER_PWD'],
                'is_staff': False,
                'is_superuser': False,
                'is_verified': True,
            },
            {
                'role': 'student',
                'email': os.environ.get('STUDENT_EMAIL', 'student@example.com'),
                'handle': os.environ.get('STUDENT_HANDLE', 'student'),
                'password': os.environ['STUDENT_PWD'],
                'is_staff': False,
                'is_superuser': False,
                'is_verified': True,
            },
        ]

        created = 0
        skipped = 0

        for user_data in users_to_create:
            role = user_data.pop('role')
            email = user_data['email']
            handle = user_data['handle']

            if User.objects.filter(email=email).exists():
                self.stdout.write(self.style.WARNING(f'User {email} already exists, skipping'))
                skipped += 1
                continue

            if User.objects.filter(handle=handle).exists():
                self.stdout.write(self.style.WARNING(f'Handle {handle} already taken, skipping {email}'))
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(self.style.NOTICE(f'Would create: {email} ({handle}) as {role}'))
                continue

            user = User.objects.create_user(**user_data)
            self.stdout.write(self.style.SUCCESS(f'Created {user.email} ({user.handle}) as {role}'))
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Done: {created} created, {skipped} skipped'
            )
        )