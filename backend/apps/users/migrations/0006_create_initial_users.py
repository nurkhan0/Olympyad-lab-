# Generated migration for creating initial test users
from django.db import migrations


def create_initial_users(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    db_alias = schema_editor.connection.alias
    mgr = CustomUser.objects.db_manager(db_alias)

    # Skip if users already exist (idempotent)
    if mgr.filter(email='admin@example.com').exists():
        return

    # Admin
    mgr.create_superuser(
        email='admin@example.com',
        handle='admin',
        password='admin123',
    )

    # Teacher
    mgr.create_user(
        email='teacher@example.com',
        handle='teacher',
        password='teacher123',
        role='teacher',
        is_verified=True,
    )

    # Student
    mgr.create_user(
        email='student@example.com',
        handle='student',
        password='student123',
        role='student',
        is_verified=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_alter_customuser_avatar_url_alter_customuser_role'),
    ]

    operations = [
        migrations.RunPython(create_initial_users, migrations.RunPython.noop),
    ]