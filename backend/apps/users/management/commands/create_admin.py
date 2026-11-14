"""Create (or promote) a single admin account.

Usage on Render (service codearena-api -> Shell):
    python manage.py create_admin \
        --email danagulizbolatova5@gmail.com \
        --handle Danagull \
        --school "ЖОББОМ" \
        --password '<choose-a-strong-password>'

The email is the login identifier and is never changed after creation. The
handle is the display name; it stays editable from the settings page, together
with school and class.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

User = get_user_model()


class Command(BaseCommand):
    help = 'Create an admin account, or promote an existing user to admin'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True, help='Login email (unique, immutable)')
        parser.add_argument('--handle', required=True, help='Display name, 3-20 chars: letters/digits/_')
        parser.add_argument('--password', required=True, help='Initial password (min 8 chars)')
        parser.add_argument('--school', default='', help='School name, e.g. "ЖОББОМ"')
        parser.add_argument('--class-name', default='', help='Class, e.g. "11 A"')
        parser.add_argument(
            '--allow-existing-handle',
            action='store_true',
            help='Reuse a handle already taken by the same email (idempotent re-run)',
        )

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        handle = options['handle'].strip()
        password = options['password']
        school = options['school'].strip()
        class_name = options['class_name'].strip()
        allow_existing_handle = options['allow_existing_handle']

        if len(password) < 8:
            raise CommandError('Password must be at least 8 characters.')

        existing_by_email = User.objects.filter(email__iexact=email).first()
        existing_by_handle = User.objects.filter(handle__iexact=handle).first()

        if existing_by_handle and (
            not existing_by_email or existing_by_handle.pk != existing_by_email.pk
        ):
            if not allow_existing_handle:
                raise CommandError(
                    f'Handle "{handle}" is already used by {existing_by_handle.email}. '
                    'Pick another handle or pass --allow-existing-handle to keep it.'
                )

        with transaction.atomic():
            if existing_by_email:
                user = existing_by_email
                created = False
            else:
                user = User(email=email)
                created = True

            # Apply the requested handle when it is free or already owned by this
            # same user. A handle owned by someone else was rejected above.
            user.handle = handle

            user.role = 'admin'
            user.is_staff = True
            user.is_superuser = True
            user.is_verified = True
            user.is_active = True
            user.is_banned = False
            user.school = school
            user.class_name = class_name
            user.set_password(password)
            user.save()

        verb = 'Created' if created else 'Updated'
        self.stdout.write(
            self.style.SUCCESS(
                f'{verb} admin: {user.email} (handle={user.handle}, role={user.role}, '
                f'school="{user.school}", class="{user.class_name}")'
            )
        )
        self.stdout.write(
            'Email is the login identifier and is not editable from the settings page; '
            'handle, school and class can be changed there.'
        )