from .base import *  # noqa: F401, F403

DEBUG = False

# Use SQLite for tests so no Postgres/Redis are required.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db_test.sqlite3",
    }
}

# In-memory cache for tests (rate-limiting uses cache).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Celery: run tasks eagerly in tests.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = "memory://"

# Channels: use in-memory layer for tests (no Redis required).
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

# Password hashing: use fast hasher for tests.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Disable debug toolbar in tests.
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != "debug_toolbar"]  # noqa: F405
MIDDLEWARE = [m for m in MIDDLEWARE if "debug_toolbar" not in m]  # noqa: F405

SECRET_KEY = "test-secret-key-not-for-production"
ALLOWED_HOSTS = ["*"]

# Cookies: test environment uses HTTP, so Secure must be False.
COOKIE_SECURE = False
