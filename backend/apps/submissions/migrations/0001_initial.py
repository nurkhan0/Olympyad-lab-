import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('contests', '0001_initial'),
        ('problems', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Submission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('language', models.CharField(choices=[
                    ('python3', 'Python 3.12'), ('cpp17', 'GNU G++17'), ('cpp20', 'GNU G++20'),
                    ('java17', 'Java 17'), ('go', 'Go 1.22'), ('rust', 'Rust 2021'),
                ], max_length=20)),
                ('source_code', models.TextField()),
                ('status', models.CharField(choices=[
                    ('PENDING', 'In Queue'), ('RUNNING', 'Running'), ('AC', 'Accepted'),
                    ('WA', 'Wrong Answer'), ('TLE', 'Time Limit Exceeded'),
                    ('MLE', 'Memory Limit Exceeded'), ('RE', 'Runtime Error'),
                    ('CE', 'Compilation Error'), ('SE', 'System Error'),
                ], db_index=True, default='PENDING', max_length=20)),
                ('verdict_detail', models.JSONField(default=dict)),
                ('time_ms', models.IntegerField(blank=True, null=True)),
                ('memory_kb', models.IntegerField(blank=True, null=True)),
                ('score', models.IntegerField(default=0)),
                ('compile_output', models.TextField(blank=True)),
                ('submitted_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('judged_at', models.DateTimeField(blank=True, null=True)),
                ('contest', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    to='contests.contest',
                )),
                ('problem', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='problems.problem')),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='submissions', to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.AddIndex(
            model_name='submission',
            index=models.Index(fields=['user', 'problem'], name='submissions_user_id_8a1c2b_idx'),
        ),
        migrations.AddIndex(
            model_name='submission',
            index=models.Index(fields=['user', 'status'], name='submissions_user_id_3d4e5f_idx'),
        ),
        migrations.AddIndex(
            model_name='submission',
            index=models.Index(fields=['problem', 'status'], name='submissions_problem_6g7h8i_idx'),
        ),
        migrations.AddIndex(
            model_name='submission',
            index=models.Index(fields=['contest', 'user'], name='submissions_contest_9j0k1l_idx'),
        ),
        migrations.AddIndex(
            model_name='submission',
            index=models.Index(fields=['-submitted_at'], name='submissions_submitt_2m3n4o_idx'),
        ),
        migrations.AddIndex(
            model_name='submission',
            index=models.Index(fields=['status', '-submitted_at'], name='submissions_status_5p6q7r_idx'),
        ),
        migrations.AddIndex(
            model_name='submission',
            index=models.Index(fields=['contest', '-submitted_at'], name='submissions_contest_8s9t0u_idx'),
        ),
    ]
