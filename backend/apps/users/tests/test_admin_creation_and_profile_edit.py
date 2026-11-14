"""Tests for the create_admin management command and profile self-edit rules."""

import pytest
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.urls import reverse
from rest_framework import status

from apps.users.factories import UserFactory

User = get_user_model()


def _client(user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestCreateAdminCommand:
    def test_creates_admin_with_expected_fields(self):
        call_command(
            'create_admin',
            email='Danagull@Example.com',
            handle='Danagull',
            password='Str0ngPass!',
            school='ЖОББОМ',
            class_name='11 A',
        )

        user = User.objects.get(email='danagull@example.com')  # normalised to lowercase
        assert user.role == 'admin'
        assert user.is_staff is True
        assert user.is_superuser is True
        assert user.is_verified is True
        assert user.handle == 'Danagull'
        assert user.school == 'ЖОББОМ'
        assert user.class_name == '11 A'
        assert user.check_password('Str0ngPass!')

    def test_short_password_rejected(self):
        with pytest.raises(CommandError):
            call_command(
                'create_admin',
                email='a@b.com',
                handle='abc',
                password='short',
            )
        assert not User.objects.filter(email='a@b.com').exists()

    def test_taken_handle_rejected(self):
        UserFactory(handle='taken')
        with pytest.raises(CommandError):
            call_command(
                'create_admin',
                email='new@example.com',
                handle='taken',
                password='Str0ngPass!',
            )
        assert not User.objects.filter(email='new@example.com').exists()

    def test_existing_user_promoted_not_duplicated(self):
        user = UserFactory(role='student', email='promote@example.com', handle='student1')
        call_command(
            'create_admin',
            email='promote@example.com',
            handle='Whatever',
            password='Str0ngPass!',
        )
        user.refresh_from_db()
        assert user.role == 'admin'
        assert user.is_staff is True
        assert user.is_superuser is True
        # Handle follows the requested value when it is free.
        assert user.handle == 'Whatever'
        assert User.objects.filter(email='promote@example.com').count() == 1

    def test_rerun_is_idempotent(self):
        call_command(
            'create_admin',
            email='idem@example.com',
            handle='Idem',
            password='Str0ngPass!',
        )
        call_command(
            'create_admin',
            email='idem@example.com',
            handle='Idem',
            password='AnotherPass1!',
        )
        user = User.objects.get(email='idem@example.com')
        assert User.objects.filter(email='idem@example.com').count() == 1
        assert user.check_password('AnotherPass1!')  # password rotated on re-run


@pytest.mark.django_db
class TestProfileSelfEdit:
    def test_user_can_edit_handle_school_and_class(self):
        user = UserFactory(role='student', handle='oldhandle')
        response = _client(user).patch(
            reverse('users-me'),
            {
                'handle': 'newhandle',
                'school': 'ЖОББОМ',
                'class_name': '11 A',
                'avatar_url': 'https://example.com/a.png',
            },
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.handle == 'newhandle'
        assert user.school == 'ЖОББОМ'
        assert user.class_name == '11 A'
        assert user.avatar_url == 'https://example.com/a.png'

    def test_email_cannot_be_changed_through_profile_patch(self):
        user = UserFactory(role='student', email='keep@example.com')
        response = _client(user).patch(
            reverse('users-me'),
            {'email': 'attacker@evil.com', 'handle': 'keep'},
            format='json',
        )
        # Ignored, not applied: the field is not part of the update serializer.
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.email == 'keep@example.com'

    def test_role_cannot_be_self_assigned(self):
        user = UserFactory(role='student')
        response = _client(user).patch(
            reverse('users-me'),
            {'role': 'admin', 'is_staff': True, 'is_superuser': True},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.role == 'student'
        assert user.is_staff is False
        assert user.is_superuser is False

    def test_duplicate_handle_rejected(self):
        UserFactory(handle='taken')
        user = UserFactory(role='student', handle='mine')
        response = _client(user).patch(
            reverse('users-me'),
            {'handle': 'taken'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_handle_rejected(self):
        user = UserFactory(role='student', handle='mine')
        response = _client(user).patch(
            reverse('users-me'),
            {'handle': 'has space'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_me_response_includes_profile_fields(self):
        user = UserFactory(role='admin', school='ЖОББОМ', class_name='11 A')
        response = _client(user).get(reverse('users-me'))
        assert response.status_code == status.HTTP_200_OK
        assert response.data['school'] == 'ЖОББОМ'
        assert response.data['class_name'] == '11 A'
        assert 'email' in response.data

    def test_anonymous_cannot_edit_profile(self):
        from rest_framework.test import APIClient

        response = APIClient().patch(
            reverse('users-me'),
            {'handle': 'anon'},
            format='json',
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED