import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('submissions', '0002_submission_api_schema'),
    ]

    operations = [
        migrations.CreateModel(
            name='FailedSubmission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('error_message', models.TextField()),
                ('failed_at', models.DateTimeField(auto_now_add=True)),
                ('retry_count', models.PositiveIntegerField(default=0)),
                ('submission', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='failed_record',
                    to='submissions.submission',
                )),
            ],
            options={
                'ordering': ['-failed_at'],
            },
        ),
    ]
