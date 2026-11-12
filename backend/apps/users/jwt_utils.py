import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from decouple import config

ACCESS_TOKEN_LIFETIME = timedelta(minutes=15)
REFRESH_TOKEN_LIFETIME = timedelta(days=7)

JWT_ACCESS_SECRET = config('JWT_ACCESS_SECRET')
JWT_REFRESH_SECRET = config('JWT_REFRESH_SECRET')
JWT_ALGORITHM = 'HS256'


def generate_access_token(user) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'sub': str(user.id),
        'email': user.email,
        'handle': user.handle,
        'role': user.role,
        'iat': now,
        'exp': now + ACCESS_TOKEN_LIFETIME,
    }
    return jwt.encode(payload, JWT_ACCESS_SECRET, algorithm=JWT_ALGORITHM)


def generate_refresh_token(user) -> tuple[str, uuid.UUID, datetime]:
    now = datetime.now(timezone.utc)
    jti = uuid.uuid4()
    expires_at = now + REFRESH_TOKEN_LIFETIME
    payload = {
        'sub': str(user.id),
        'jti': str(jti),
        'iat': now,
        'exp': expires_at,
    }
    token_str = jwt.encode(payload, JWT_REFRESH_SECRET, algorithm=JWT_ALGORITHM)
    return token_str, jti, expires_at


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_ACCESS_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_REFRESH_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None
