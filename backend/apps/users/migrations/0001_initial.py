import uuid

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models

import apps.users.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomUser',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(
                    default=False,
                    help_text='Designates that this user has all permissions without explicitly assigning them.',
                    verbose_name='superuser status',
                )),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('handle', models.CharField(
                    max_length=30,
                    unique=True,
                    validators=[django.core.validators.RegexValidator(
                        message='Handle must be 3–20 characters: letters, digits, or underscores.',
                        regex='^[a-zA-Z0-9_]{3,20}$',
                    )],
                )),
                ('role', models.CharField(
                    choices=[('user', 'User'), ('admin', 'Admin')],
                    default='user',
                    max_length=10,
                )),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(default=False)),
                ('is_verified', models.BooleanField(default=False)),
                ('is_banned', models.BooleanField(default=False)),
                ('rating', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('groups', models.ManyToManyField(
                    blank=True,
                    help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.group',
                    verbose_name='groups',
                )),
                ('user_permissions', models.ManyToManyField(
                    blank=True,
                    help_text='Specific permissions for this user.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.permission',
                    verbose_name='user permissions',
                )),
            ],
            options={
                'abstract': False,
            },
            managers=[
                ('objects', apps.users.models.CustomUserManager()),
            ],
        ),
        migrations.CreateModel(
            name='EmailVerifyToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.UUIDField(default=uuid.uuid4, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='users.customuser',
                )),
            ],
        ),
        migrations.CreateModel(
            name='RefreshToken',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('token', models.TextField(unique=True)),
                ('jti', models.UUIDField(default=uuid.uuid4, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('is_revoked', models.BooleanField(default=False)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='refresh_tokens',
                    to='users.customuser',
                )),
            ],
        ),
        migrations.AddIndex(
            model_name='refreshtoken',
            index=models.Index(fields=['jti'], name='users_refre_jti_aa1383_idx'),
        ),
        migrations.AddIndex(
            model_name='refreshtoken',
            index=models.Index(fields=['user', 'is_revoked'], name='users_refre_user_id_fca4a4_idx'),
        ),
    ]
