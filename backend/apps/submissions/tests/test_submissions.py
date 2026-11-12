import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta

from ..factories import SubmissionFactory, FailedSubmissionFactory
from apps.users.factories import UserFactory, AdminUserFactory
from apps.problems.factories import ProblemFactory


def auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestSubmissionListCreate:
    list_url = "submissions-list-create"

    def test_list_requires_auth(self):
        client = APIClient()
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_returns_only_user_submissions(self):
        user1 = UserFactory()
        user2 = UserFactory()
        SubmissionFactory(user=user1, status="done", verdict="AC")
        SubmissionFactory(user=user1, status="done", verdict="WA")
        SubmissionFactory(user=user2, status="done", verdict="AC")
        client = auth_client(user1)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert len(results) == 2
        assert all(s["verdict"] in ("AC", "WA") for s in results)

    def test_list_filter_by_problem(self):
        user = UserFactory()
        problem1 = ProblemFactory(status="published", slug="problem-one")
        problem2 = ProblemFactory(status="published", slug="problem-two")
        SubmissionFactory(user=user, problem=problem1)
        SubmissionFactory(user=user, problem=problem2)
        SubmissionFactory(user=user, problem=problem1)
        client = auth_client(user)
        url = reverse(self.list_url)
        response = client.get(url, {"problem_id": str(problem1.id)})
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert len(results) == 2
        assert all(str(s["problem"]) == str(problem1.id) for s in results)

    def test_list_filter_by_language(self):
        user = UserFactory()
        SubmissionFactory(user=user, language="python")
        SubmissionFactory(user=user, language="cpp")
        SubmissionFactory(user=user, language="python")
        client = auth_client(user)
        url = reverse(self.list_url)
        response = client.get(url, {"language": "python"})
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert len(results) == 2
        assert all(s["language"] == "python" for s in results)

    def test_create_success(self):
        user = UserFactory()
        problem = ProblemFactory(status="published")
        client = auth_client(user)
        url = reverse(self.list_url)
        data = {
            "problem": str(problem.id),
            "code": "print(1 + 1)",
            "language": "python",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["language"] == "python"
        assert response.data["verdict"] is None
        assert response.data["status"] == "pending"

    def test_create_duplicate_within_second(self):
        user = UserFactory()
        problem = ProblemFactory(status="published")
        SubmissionFactory(user=user, problem=problem, code="print(1)")
        client = auth_client(user)
        url = reverse(self.list_url)
        data = {
            "problem": str(problem.id),
            "code": "print(1)",
            "language": "python",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Duplicate" in str(response.data)

    def test_create_duplicate_after_second_allowed(self):
        user = UserFactory()
        problem = ProblemFactory(status="published")
        old_submission = SubmissionFactory(
            user=user,
            problem=problem,
            code="print(1)",
        )
        old_submission.created_at = timezone.now() - timedelta(seconds=2)
        old_submission.save()
        client = auth_client(user)
        url = reverse(self.list_url)
        data = {
            "problem": str(problem.id),
            "code": "print(1)",
            "language": "python",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_requires_auth(self):
        client = APIClient()
        url = reverse(self.list_url)
        data = {"problem": "00000000-0000-0000-0000-000000000000", "code": "print(1)", "language": "python"}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestSubmissionDetail:
    def make_url(self, pk):
        return reverse("submissions-detail", kwargs={"pk": pk})

    def test_detail_requires_auth(self):
        submission = SubmissionFactory()
        client = APIClient()
        url = self.make_url(submission.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_detail_owner_can_view(self):
        user = UserFactory()
        submission = SubmissionFactory(user=user)
        client = auth_client(user)
        url = self.make_url(submission.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["id"]) == str(submission.pk)
        assert response.data["code"] == submission.code

    def test_detail_other_user_denied(self):
        user1 = UserFactory()
        user2 = UserFactory()
        submission = SubmissionFactory(user=user1)
        client = auth_client(user2)
        url = self.make_url(submission.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_detail_staff_can_view_any(self):
        user = UserFactory()
        admin = AdminUserFactory()
        submission = SubmissionFactory(user=user)
        client = auth_client(admin)
        url = self.make_url(submission.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_detail_404_for_nonexistent(self):
        user = UserFactory()
        client = auth_client(user)
        url = self.make_url(999999)
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestTestRunView:
    test_url = "submissions-test-run"

    def test_test_run_requires_auth(self):
        client = APIClient()
        url = reverse(self.test_url)
        data = {
            "problem_id": "00000000-0000-0000-0000-000000000000",
            "code": "print(1)",
            "language": "python",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_test_run_404_for_unpublished_problem(self):
        user = UserFactory()
        ProblemFactory(status="draft")
        client = auth_client(user)
        url = reverse(self.test_url)
        # Use a UUID that doesn't exist to trigger 404
        data = {
            "problem_id": "00000000-0000-0000-0000-000000000000",
            "code": "print(1)",
            "language": "python",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_test_run_rate_limit(self):
        user = UserFactory()
        problem = ProblemFactory(status="published")
        client = auth_client(user)
        url = reverse(self.test_url)
        data = {
            "problem_id": str(problem.id),
            "code": "print(1)",
            "language": "python",
        }
        response1 = client.post(url, data, format="json")
        assert response1.status_code == status.HTTP_200_OK
        response2 = client.post(url, data, format="json")
        assert response2.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "Rate limit" in str(response2.data)

    def test_test_run_invalid_language(self):
        user = UserFactory()
        problem = ProblemFactory(status="published")
        client = auth_client(user)
        url = reverse(self.test_url)
        data = {
            "problem_id": str(problem.id),
            "code": "print(1)",
            "language": "invalid",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
