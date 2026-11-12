import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

handle_validator = RegexValidator(
    regex=r'^[a-zA-Z0-9_]{3,20}$',
    message='Handle must be 3–20 characters: letters, digits, or underscores.',
)


class CustomUserManager(BaseUserManager):
    def create_user(self, email, handle, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        if not handle:
            raise ValueError('Handle is required')
        email = self.normalize_email(email)
        user = self.model(email=email, handle=handle, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, handle, password=None, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must be is_superuser=True.')

        return self.create_user(email, handle, password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    handle = models.CharField(max_length=30, unique=True, validators=[handle_validator])
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    is_banned = models.BooleanField(default=False)
    rating = models.IntegerField(default=0)
    avatar_url = models.URLField(max_length=500, blank=True, default='')
    school = models.CharField(max_length=200, blank=True, default="")
    class_name = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['handle']

    def __str__(self):
        return self.email


class RefreshToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name='refresh_tokens',
    )
    token = models.TextField(unique=True)
    jti = models.UUIDField(unique=True, default=uuid.uuid4)
    expires_at = models.DateTimeField()
    is_revoked = models.BooleanField(default=False)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['jti']),
            models.Index(fields=['user', 'is_revoked']),
        ]

    def __str__(self):
        return f'{self.user.email} — {self.jti}'


class EmailVerifyToken(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    expires_at = models.DateTimeField()

    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f'{self.user.email} — {self.token}'