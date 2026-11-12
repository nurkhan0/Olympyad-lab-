import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import ProblemFactory, TagFactory, UserProblemStatusFactory
from apps.users.factories import UserFactory, AdminUserFactory
from ..models import Problem


def auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestPublicProblemList:
    endpoint = "problems-list"

    def test_list_returns_only_published(self):
        ProblemFactory(status="published", title="Published One", slug="published-one")
        ProblemFactory(status="draft", title="Draft One", slug="draft-one")
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert len(results) == 1
        assert results[0]["title"] == "Published One"

    def test_list_pagination(self):
        for i in range(25):
            ProblemFactory(status="published", slug=f"problem-{i}")
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 25
        assert len(response.data["results"]) == 20
        assert response.data["next"] is not None

    def test_list_filter_by_difficulty(self):
        ProblemFactory(status="published", difficulty="easy", slug="easy-problem")
        ProblemFactory(status="published", difficulty="hard", slug="hard-problem")
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.get(url, {"difficulty": "hard"})
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert len(results) == 1
        assert results[0]["slug"] == "hard-problem"

    def test_list_filter_by_tag(self):
        tag = TagFactory(name="math", slug="math")
        p1 = ProblemFactory(status="published", slug="tagged-problem")
        p1.tags.add(tag)
        ProblemFactory(status="published", slug="untagged-problem")
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.get(url, {"tag": "math"})
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert len(results) == 1
        assert results[0]["slug"] == "tagged-problem"

    def test_list_search_by_title(self):
        ProblemFactory(status="published", title="Two Sum Problem", slug="two-sum")
        ProblemFactory(status="published", title="Reverse String", slug="reverse-string")
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.get(url, {"search": "two sum"})
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert len(results) == 1
        assert results[0]["title"] == "Two Sum Problem"

    def test_list_user_status_authenticated(self):
        user = UserFactory()
        problem = ProblemFactory(status="published")
        UserProblemStatusFactory(user=user, problem=problem, status="solved")
        client = auth_client(user)
        url = reverse(self.endpoint)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        result = response.data["results"][0]
        assert result["user_status"] == "solved"

    def test_list_user_status_anonymous(self):
        ProblemFactory(status="published")
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        result = response.data["results"][0]
        assert result["user_status"] is None

    def test_list_includes_tags(self):
        tag1 = TagFactory(name="array", slug="array")
        tag2 = TagFactory(name="easy", slug="easy")
        problem = ProblemFactory(status="published")
        problem.tags.add(tag1, tag2)
        client = APIClient()
        url = reverse(self.endpoint)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        result = response.data["results"][0]
        tag_names = [t["name"] for t in result["tags"]]
        assert "array" in tag_names
        assert "easy" in tag_names


@pytest.mark.django_db
class TestPublicProblemDetail:
    def make_url(self, slug):
        return reverse("problems-detail", kwargs={"slug": slug})

    def test_detail_returns_published_problem(self):
        problem = ProblemFactory(status="published")
        client = APIClient()
        url = self.make_url(problem.slug)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["slug"] == problem.slug
        assert response.data["title"] == problem.title
        assert "statement_html" in response.data
        assert "sample_test_cases" in response.data

    def test_detail_404_for_draft(self):
        ProblemFactory(status="draft", slug="draft-problem")
        client = APIClient()
        url = self.make_url("draft-problem")
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_detail_404_for_nonexistent(self):
        client = APIClient()
        url = self.make_url("does-not-exist")
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_detail_sample_test_cases(self):
        problem = ProblemFactory(status="published")
        from ..factories import TestCaseFactory

        TestCaseFactory(problem=problem, is_sample=True, order=0, input="1\n", expected_output="2\n")
        TestCaseFactory(problem=problem, is_sample=False, order=1, input="3\n", expected_output="4\n")
        client = APIClient()
        url = self.make_url(problem.slug)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        samples = response.data["sample_test_cases"]
        assert len(samples) == 1
        assert samples[0]["input"] == "1\n"


@pytest.mark.django_db
class TestBookmarkProblem:
    def make_url(self, slug):
        return reverse("problems-bookmark", kwargs={"slug": slug})

    def test_bookmark_toggle_add(self):
        user = UserFactory()
        problem = ProblemFactory(status="published")
        client = auth_client(user)
        url = self.make_url(problem.slug)
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["bookmarked"] is True

    def test_bookmark_toggle_remove(self):
        user = UserFactory()
        problem = ProblemFactory(status="published")
        UserProblemStatusFactory(user=user, problem=problem, status="todo")
        client = auth_client(user)
        url = self.make_url(problem.slug)
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["bookmarked"] is False

    def test_bookmark_requires_auth(self):
        problem = ProblemFactory(status="published")
        client = APIClient()
        url = self.make_url(problem.slug)
        response = client.post(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_bookmark_404_for_draft(self):
        user = UserFactory()
        ProblemFactory(status="draft", slug="draft-problem")
        client = auth_client(user)
        url = self.make_url("draft-problem")
        response = client.post(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestAdminProblemListCreate:
    list_endpoint = "admin-problems-list"

    def test_list_requires_admin(self):
        user = UserFactory()
        client = auth_client(user)
        url = reverse(self.list_endpoint)
        response = client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_returns_all_problems_for_admin(self):
        admin = AdminUserFactory()
        ProblemFactory(status="published", slug="pub-one")
        ProblemFactory(status="draft", slug="draft-one")
        client = auth_client(admin)
        url = reverse(self.list_endpoint)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

    def test_create_requires_admin(self):
        user = UserFactory()
        client = auth_client(user)
        url = reverse(self.list_endpoint)
        response = client.post(url, {"title": "New Problem"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_success(self):
        admin = AdminUserFactory()
        tag = TagFactory(name="math", slug="math")
        client = auth_client(admin)
        url = reverse(self.list_endpoint)
        data = {
            "title": "New Problem",
            "difficulty": "medium",
            "statement": "Solve this.",
            "time_ms": 2000,
            "memory_mb": 512,
            "tags": ["math"],
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "New Problem"
        assert response.data["slug"] == "new-problem"
        assert len(response.data["tags"]) == 1
        assert response.data["tags"][0]["name"] == "math"
        problem = Problem.objects.get(slug="new-problem")
        assert problem.author == admin

    def test_create_duplicate_slug(self):
        admin = AdminUserFactory()
        ProblemFactory(title="Existing", slug="existing")
        client = auth_client(admin)
        url = reverse(self.list_endpoint)
        response = client.post(url, {"title": "Existing"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestAdminProblemDetail:
    def make_url(self, slug):
        return reverse("admin-problems-detail", kwargs={"slug": slug})

    def test_retrieve_requires_admin(self):
        user = UserFactory()
        problem = ProblemFactory()
        client = auth_client(user)
        url = self.make_url(problem.slug)
        response = client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_retrieve_success(self):
        admin = AdminUserFactory()
        problem = ProblemFactory()
        client = auth_client(admin)
        url = self.make_url(problem.slug)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["slug"] == problem.slug

    def test_update_success(self):
        admin = AdminUserFactory()
        problem = ProblemFactory(title="Old Title", difficulty="easy")
        client = auth_client(admin)
        url = self.make_url(problem.slug)
        response = client.patch(
            url, {"title": "New Title", "difficulty": "hard"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == "New Title"
        assert response.data["difficulty"] == "hard"

    def test_delete_success(self):
        admin = AdminUserFactory()
        problem = ProblemFactory()
        client = auth_client(admin)
        url = self.make_url(problem.slug)
        response = client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        from ..models import Problem

        assert Problem.objects.filter(slug=problem.slug).exists() is False

    def test_update_readonly_fields_ignored(self):
        admin = AdminUserFactory()
        problem = ProblemFactory(slug="original-slug", solver_count=5)
        client = auth_client(admin)
        url = self.make_url(problem.slug)
        response = client.patch(
            url, {"slug": "changed-slug", "solver_count": 999}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        problem.refresh_from_db()
        assert problem.slug == "original-slug"
        assert problem.solver_count == 5


@pytest.mark.django_db
class TestAdminProblemStatus:
    def make_publish_url(self, slug):
        return reverse("admin-problems-publish", kwargs={"slug": slug})

    def make_draft_url(self, slug):
        return reverse("admin-problems-draft", kwargs={"slug": slug})

    def test_publish_requires_admin(self):
        user = UserFactory()
        problem = ProblemFactory(status="draft")
        client = auth_client(user)
        url = self.make_publish_url(problem.slug)
        response = client.post(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_publish_changes_status(self):
        admin = AdminUserFactory()
        problem = ProblemFactory(status="draft")
        client = auth_client(admin)
        url = self.make_publish_url(problem.slug)
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "published"
        problem.refresh_from_db()
        assert problem.status == "published"

    def test_draft_changes_status(self):
        admin = AdminUserFactory()
        problem = ProblemFactory(status="published")
        client = auth_client(admin)
        url = self.make_draft_url(problem.slug)
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "draft"
