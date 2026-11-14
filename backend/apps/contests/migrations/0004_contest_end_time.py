"""Persist Contest.end_time.

``end_time`` used to be a Python property (``start_time + duration_minutes``),
which meant the ORM could not filter or order by it. It is now a real column;
existing rows are backfilled in the same migration so nothing is left NULL.
"""

from datetime import timedelta

from django.db import migrations, models


def backfill_end_time(apps, schema_editor):
    Contest = apps.get_model('contests', 'Contest')
    for contest in Contest.objects.all().iterator():
        contest.end_time = contest.start_time + timedelta(minutes=contest.duration_minutes)
        contest.save(update_fields=['end_time'])


class Migration(migrations.Migration):

    dependencies = [
        ('contests', '0003_contest_is_published_contest_max_participants_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='contest',
            name='end_time',
            field=models.DateTimeField(db_index=True, editable=False, null=True),
        ),
        migrations.RunPython(backfill_end_time, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='contest',
            name='end_time',
            field=models.DateTimeField(db_index=True, editable=False),
        ),
    ]