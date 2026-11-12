import pytest
import jwt
from datetime import datetime, timedelta, timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import UserFactory, AdminUserFactory
from ..jwt_utils import (
    JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET,
    JWT_ALGORITHM,
    generate_refresh_token,
)


def access_token(user) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "handle": user.handle,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=15),
    }
    return jwt.encode(payload, JWT_ACCESS_SECRET, algorithm=JWT_ALGORITHM)


@pytest.mark.django_db
class TestRegisterView:
    endpoint = "auth-register"

    def test_register_success(self):
        client = APIClient()
        url = reverse(self.endpoint)
        data = {
            "email": "newuser@example.com",
            "handle": "newuser",
            "password": "password123",
            "password_confirm": "password123",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["message"] == "Registration successful"

    def test_register_duplicate_email(self):
        UserFactory(email="dup@example.com", handle="dupuser")
        client = APIClient()
        url = reverse(self.endpoint)
        data = {
            "email": "DUP@example.com",
            "handle": "otheruser",
            "password": "password123",
            "password_confirm": "password123",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data

    def test_register_duplicate_handle(self):
        UserFactory(email="other@example.com", handle="dupuser")
        client = APIClient()
        url = reverse(self.endpoint)
        data = {
            "email": "new@example.com",
            "handle": "DUPUSER",
            "password": "password123",
            "password_confirm": "password123",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "handle" in response.data

    def test_register_password_too_short(self):
        client = APIClient()
        url = reverse(self.endpoint)
        data = {
            "email": "short@example.com",
            "handle": "shortuser",
            "password": "short",
            "password_confirm": "short",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data

    def test_register_password_mismatch(self):
        client = APIClient()
        url = reverse(self.endpoint)
        data = {
            "email": "mismatch@example.com",
            "handle": "mismatchuser",
            "password": "password123",
            "password_confirm": "different",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password_confirm" in response.data

    def test_register_invalid_handle(self):
        client = APIClient()
        url = reverse(self.endpoint)
        data = {
            "email": "bad@example.com",
            "handle": "ab",
            "password": "password123",
            "password_confirm": "password123",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "handle" in response.data

    def test_register_missing_fields(self):
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLoginView:
    endpoint = "auth-login"

    def test_login_success(self):
        user = UserFactory(email="login@example.com", handle="loginuser", password="password123")
        client = APIClient()
        url = reverse(self.endpoint)
        data = {"email": "login@example.com", "password": "password123"}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.data
        assert "user" in response.data
        assert response.data["user"]["email"] == "login@example.com"
        assert response.data["user"]["handle"] == "loginuser"
        # refresh token delivered only via HttpOnly cookie, not response body
        assert "refresh_token" not in response.data
        assert response.cookies.get("refresh_token") is not None
        assert response.cookies["refresh_token"]["path"] == "/api/v1/auth/"
        assert response.cookies["refresh_token"]["httponly"]

    def test_login_invalid_password(self):
        UserFactory(email="login@example.com", handle="loginuser", password="password123")
        client = APIClient()
        url = reverse(self.endpoint)
        data = {"email": "login@example.com", "password": "wrongpassword"}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_invalid_email(self):
        client = APIClient()
        url = reverse(self.endpoint)
        data = {"email": "nonexistent@example.com", "password": "password123"}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_inactive_user(self):
        UserFactory(email="inactive@example.com", handle="inactiveuser", password="password123", is_active=False)
        client = APIClient()
        url = reverse(self.endpoint)
        data = {"email": "inactive@example.com", "password": "password123"}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_banned_user(self):
        UserFactory(email="banned@example.com", handle="banneduser", password="password123", is_banned=True)
        client = APIClient()
        url = reverse(self.endpoint)
        data = {"email": "banned@example.com", "password": "password123"}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_missing_fields(self):
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestRefreshView:
    endpoint = "auth-refresh"

    def test_refresh_success(self):
        user = UserFactory(email="refresh@example.com", handle="refreshuser")
        token_str, jti, expires_at = generate_refresh_token(user)
        from apps.users.models import RefreshToken

        RefreshToken.objects.create(
            user=user,
            token=token_str,
            jti=jti,
            expires_at=expires_at,
        )
        client = APIClient()
        client.cookies["refresh_token"] = token_str
        url = reverse(self.endpoint)
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.data

    def test_refresh_missing_token(self):
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_invalid_token(self):
        client = APIClient()
        client.cookies["refresh_token"] = "invalid.token.string"
        url = reverse(self.endpoint)
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_revoked_token(self):
        user = UserFactory(email="revoked@example.com", handle="revokeduser")
        token_str, jti, expires_at = generate_refresh_token(user)
        from apps.users.models import RefreshToken

        RefreshToken.objects.create(
            user=user,
            token=token_str,
            jti=jti,
            expires_at=expires_at,
            is_revoked=True,
        )
        client = APIClient()
        client.cookies["refresh_token"] = token_str
        url = reverse(self.endpoint)
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_with_stale_expired_access_token_header(self):
        """Regression: the refresh endpoint must not reject the request because
        the axios interceptor attaches an expired Bearer access token. An
        invalid access token is treated as anonymous, not an error."""
        user = UserFactory(email="stale@example.com", handle="staleuser")
        token_str, jti, expires_at = generate_refresh_token(user)
        from apps.users.models import RefreshToken

        RefreshToken.objects.create(user=user, token=token_str, jti=jti, expires_at=expires_at)

        stale_access = generate_access_token_with_offset(user, minutes=-30)  # already expired

        client = APIClient()
        client.cookies["refresh_token"] = token_str
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {stale_access}")
        url = reverse(self.endpoint)
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.data

    def test_refresh_response_has_no_refresh_token_in_body(self):
        """The HttpOnly cookie is the single refresh-token transport."""
        user = UserFactory(email="nobody@example.com", handle="nobodyuser")
        token_str, jti, expires_at = generate_refresh_token(user)
        from apps.users.models import RefreshToken

        RefreshToken.objects.create(user=user, token=token_str, jti=jti, expires_at=expires_at)
        client = APIClient()
        client.cookies["refresh_token"] = token_str
        url = reverse(self.endpoint)
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "refresh_token" not in response.data
        # rotation: a fresh cookie is set
        assert response.cookies.get("refresh_token") is not None
        assert response.cookies["refresh_token"]["path"] == "/api/v1/auth/"


def generate_access_token_with_offset(user, minutes: int) -> str:
    """Access token with an explicit offset — used to build expired tokens."""
    import jwt as pyjwt
    from datetime import datetime, timedelta, timezone as dt_timezone

    from apps.users.jwt_utils import JWT_ACCESS_SECRET, JWT_ALGORITHM

    now = datetime.now(dt_timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "handle": user.handle,
        "role": user.role,
        "iat": now + timedelta(minutes=minutes),
        "exp": now + timedelta(minutes=minutes),
    }
    return pyjwt.encode(payload, JWT_ACCESS_SECRET, algorithm=JWT_ALGORITHM)


@pytest.mark.django_db
class TestLogoutView:
    endpoint = "auth-logout"

    def test_logout_success(self):
        user = UserFactory(email="logout@example.com", handle="logoutuser")
        token_str, jti, expires_at = generate_refresh_token(user)
        from apps.users.models import RefreshToken

        RefreshToken.objects.create(
            user=user,
            token=token_str,
            jti=jti,
            expires_at=expires_at,
        )
        client = APIClient()
        client.cookies["refresh_token"] = token_str
        url = reverse(self.endpoint)
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["message"] == "Logged out"
        # token should be revoked
        from apps.users.models import RefreshToken as RT

        rt = RT.objects.get(jti=jti)
        assert rt.is_revoked is True
