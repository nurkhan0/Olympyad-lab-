import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('problems', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('submissions', '0001_initial'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='submission',
            name='submissions_user_id_8a1c2b_idx',
        ),
        migrations.RemoveIndex(
            model_name='submission',
            name='submissions_user_id_3d4e5f_idx',
        ),
        migrations.RemoveIndex(
            model_name='submission',
            name='submissions_problem_6g7h8i_idx',
        ),
        migrations.RemoveIndex(
            model_name='submission',
            name='submissions_contest_9j0k1l_idx',
        ),
        migrations.RemoveIndex(
            model_name='submission',
            name='submissions_submitt_2m3n4o_idx',
        ),
        migrations.RemoveIndex(
            model_name='submission',
            name='submissions_status_5p6q7r_idx',
        ),
        migrations.RemoveIndex(
            model_name='submission',
            name='submissions_contest_8s9t0u_idx',
        ),
        migrations.RemoveField(
            model_name='submission',
            name='compile_output',
        ),
        migrations.RemoveField(
            model_name='submission',
            name='contest',
        ),
        migrations.RemoveField(
            model_name='submission',
            name='judged_at',
        ),
        migrations.RemoveField(
            model_name='submission',
            name='score',
        ),
        migrations.RemoveField(
            model_name='submission',
            name='source_code',
        ),
        migrations.RemoveField(
            model_name='submission',
            name='submitted_at',
        ),
        migrations.RemoveField(
            model_name='submission',
            name='verdict_detail',
        ),
        migrations.AddField(
            model_name='submission',
            name='code',
            field=models.TextField(default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='submission',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='submission',
            name='verdict',
            field=models.CharField(
                blank=True,
                choices=[
                    ('AC', 'Accepted'),
                    ('WA', 'Wrong Answer'),
                    ('TLE', 'Time Limit Exceeded'),
                    ('MLE', 'Memory Limit Exceeded'),
                    ('RE', 'Runtime Error'),
                    ('CE', 'Compilation Error'),
                ],
                max_length=5,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='submission',
            name='language',
            field=models.CharField(
                choices=[('python', 'Python 3'), ('cpp', 'C++17'), ('java', 'Java 17')],
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name='submission',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('judging', 'Judging'),
                    ('done', 'Done'),
                    ('error', 'Error'),
                ],
                default='pending',
                max_length=10,
            ),
        ),
        migrations.AddIndex(
            model_name='submission',
            index=models.Index(
                fields=['user', 'problem', 'created_at'],
                name='submissions_user_id_a1b2c3_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='submission',
            index=models.Index(fields=['status'], name='submissions_status_d4e5f6_idx'),
        ),
        migrations.AlterModelOptions(
            name='submission',
            options={'ordering': ['-created_at']},
        ),
    ]
