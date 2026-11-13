# Generated migration for creating initial test users
from django.db import migrations
from django.contrib.auth.hashers import make_password


def create_initial_users(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    db_alias = schema_editor.connection.alias

    # Skip if users already exist (idempotent)
    if CustomUser.objects.using(db_alias).filter(email='admin@example.com').exists():
        return

    # Admin
    CustomUser.objects.using(db_alias).create(
        email='admin@example.com',
        handle='admin',
        password=make_password('admin123'),
        role='admin',
        is_staff=True,
        is_superuser=True,
        is_verified=True,
        is_active=True,
    )

    # Teacher
    CustomUser.objects.using(db_alias).create(
        email='teacher@example.com',
        handle='teacher',
        password=make_password('teacher123'),
        role='teacher',
        is_verified=True,
        is_active=True,
    )

    # Student
    CustomUser.objects.using(db_alias).create(
        email='student@example.com',
        handle='student',
        password=make_password('student123'),
        role='student',
        is_verified=True,
        is_active=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_alter_customuser_avatar_url_alter_customuser_role'),
    ]

    operations = [
        migrations.RunPython(create_initial_users, migrations.RunPython.noop),
    ]