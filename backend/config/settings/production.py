from decouple import Csv, config

from .base import *  # noqa: F401, F403

DEBUG = False

# Security headers — secure defaults, overridable for HTTP staging rehearsals.
# NOTE: the previous file declared SECURE_SSL_REDIRECT three times; the last
# assignment silently disabled the redirect in production.
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
# HSTS stays OFF (0) until HTTPS has been verified against the real public
# domain — enabling it earlier can hard-lock browsers out of a misconfigured
# host. Activation step is in PUBLIC_RELEASE_CHECKLIST.md item "HSTS".
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=0, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# The refresh cookie MUST default to Secure in production regardless of any
# DEBUG value inherited from a development .env file (base.py derives it from
# DEBUG at import time). Staging rehearsals over plain HTTP set
# COOKIE_SECURE=False explicitly via the environment.
COOKIE_SECURE = config('COOKIE_SECURE', default=True, cast=bool)

# The refresh cookie picks up COOKIE_SECURE from base.py (True unless DEBUG).
# Staging rehearsals over plain HTTP must set COOKIE_SECURE=False explicitly.

# CORS: production origins come from the environment — localhost defaults are
# a development-settings concern only.
_cors = config('CORS_ALLOWED_ORIGINS', default='', cast=Csv())
CORS_ALLOWED_ORIGINS = [origin for origin in _cors if origin]
CORS_ALLOW_CREDENTIALS = True

# Trusted origins for CSRF (scheme included), e.g. https://codearena.example.com
_csrf = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())
CSRF_TRUSTED_ORIGINS = [origin for origin in _csrf if origin]
