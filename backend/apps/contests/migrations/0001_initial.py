import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('problems', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Contest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('contest_type', models.CharField(
                    choices=[('CF', 'Codeforces'), ('ICPC', 'ICPC'), ('IOI', 'IOI')],
                    default='CF', max_length=10,
                )),
                ('start_time', models.DateTimeField(db_index=True)),
                ('duration_minutes', models.IntegerField()),
                ('is_public', models.BooleanField(db_index=True, default=True)),
                ('is_rated', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(
                    null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_contests', to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.CreateModel(
            name='ContestProblem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=5)),
                ('order', models.PositiveIntegerField()),
                ('points', models.IntegerField(default=0)),
                ('contest', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='contest_problems', to='contests.contest',
                )),
                ('problem', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='problems.problem')),
            ],
            options={
                'ordering': ['order'],
            },
        ),
        migrations.CreateModel(
            name='ContestRegistration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('registered_at', models.DateTimeField(auto_now_add=True)),
                ('contest', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='contests.contest')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddField(
            model_name='contest',
            name='participants',
            field=models.ManyToManyField(
                blank=True, through='contests.ContestRegistration', to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='contest',
            name='problems',
            field=models.ManyToManyField(
                blank=True, through='contests.ContestProblem', to='problems.problem',
            ),
        ),
        migrations.AddIndex(
            model_name='contest',
            index=models.Index(fields=['is_public', 'start_time'], name='contests_co_is_publ_7b2f4e_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='contestproblem',
            unique_together={('contest', 'label'), ('contest', 'order')},
        ),
        migrations.AlterUniqueTogether(
            name='contestregistration',
            unique_together={('contest', 'user')},
        ),
    ]
