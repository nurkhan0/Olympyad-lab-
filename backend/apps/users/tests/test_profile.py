import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import UserFactory, AdminUserFactory


def auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestMeView:
    endpoint = "users-me"

    def test_me_get_success(self):
        user = UserFactory(email="me@example.com", handle="meuser", rating=1500)
        client = auth_client(user)
        url = reverse(self.endpoint)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(user.id)
        assert response.data["email"] == "me@example.com"
        assert response.data["handle"] == "meuser"
        assert response.data["rating"] == 1500

    def test_me_unauthenticated(self):
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_patch_update_avatar(self):
        user = UserFactory(email="mepatch@example.com", handle="mepatchuser")
        client = auth_client(user)
        url = reverse(self.endpoint)
        response = client.patch(url, {"avatar_url": "https://example.com/avatar.png"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["avatar_url"] == "https://example.com/avatar.png"
        user.refresh_from_db()
        assert user.avatar_url == "https://example.com/avatar.png"


@pytest.mark.django_db
class TestProfileView:
    def make_url(self, handle):
        return reverse("users-profile", kwargs={"handle": handle})

    def test_profile_get_success(self):
        user = UserFactory(email="profile@example.com", handle="profileuser", rating=2000, role="teacher")
        client = APIClient()
        url = self.make_url("profileuser")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["handle"] == "profileuser"
        assert response.data["rating"] == 2000
        assert response.data["role"] == "teacher"

    def test_profile_case_insensitive(self):
        user = UserFactory(email="ci@example.com", handle="CaseInsensitive")
        client = APIClient()
        url = self.make_url("caseinsensitive")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_profile_not_found(self):
        client = APIClient()
        url = self.make_url("nonexistent")
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_profile_banned_user_not_found(self):
        UserFactory(email="bannedprof@example.com", handle="bannedprof", is_banned=True)
        client = APIClient()
        url = self.make_url("bannedprof")
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_profile_public_fields_only(self):
        user = UserFactory(email="pub@example.com", handle="pubuser")
        client = APIClient()
        url = self.make_url("pubuser")
        response = client.get(url)
        # email should not be in public profile
        assert "email" not in response.data
        assert "id" not in response.data
