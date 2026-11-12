import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
                ('slug', models.SlugField(blank=True, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='Problem',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=200)),
                ('slug', models.SlugField(blank=True, max_length=250, unique=True)),
                ('difficulty', models.CharField(
                    choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard'), ('expert', 'Expert')],
                    default='easy',
                    max_length=10,
                )),
                ('statement', models.TextField()),
                ('statement_html', models.TextField(blank=True)),
                ('time_ms', models.PositiveIntegerField(default=1000)),
                ('memory_mb', models.PositiveIntegerField(default=256)),
                ('status', models.CharField(
                    choices=[('draft', 'Draft'), ('published', 'Published')],
                    default='draft',
                    max_length=10,
                )),
                ('solver_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('author', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='authored_problems',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.CreateModel(
            name='TestCase',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('input', models.TextField()),
                ('expected_output', models.TextField()),
                ('is_sample', models.BooleanField(default=False)),
                ('order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('problem', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='test_cases',
                    to='problems.problem',
                )),
            ],
            options={
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='ProblemTag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('problem', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='problems.problem')),
                ('tag', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='problems.tag')),
            ],
            options={
                'unique_together': {('problem', 'tag')},
            },
        ),
        migrations.AddField(
            model_name='problem',
            name='tags',
            field=models.ManyToManyField(blank=True, through='problems.ProblemTag', to='problems.tag'),
        ),
        migrations.CreateModel(
            name='UserProblemStatus',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(
                    choices=[('solved', 'Solved'), ('attempted', 'Attempted'), ('todo', 'Todo')],
                    default='todo',
                    max_length=10,
                )),
                ('solved_at', models.DateTimeField(blank=True, null=True)),
                ('problem', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='problems.problem')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('user', 'problem')},
            },
        ),
    ]
