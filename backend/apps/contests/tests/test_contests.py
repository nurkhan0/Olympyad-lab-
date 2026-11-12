import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta

from apps.users.factories import UserFactory, AdminUserFactory
from apps.problems.factories import ProblemFactory
from apps.submissions.factories import SubmissionFactory
from apps.contests.models import Contest, ContestRegistration, ContestProblem


def auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def make_contest(created_by, **kwargs):
    """Helper to create a contest with sensible defaults."""
    defaults = {
        'title': 'Test Contest',
        'description': 'A test contest',
        'contest_type': 'CF',
        'start_time': timezone.now() + timedelta(hours=1),
        'duration_minutes': 120,
        'is_public': True,
        'is_published': True,
        'is_rated': True,
        'created_by': created_by,
    }
    defaults.update(kwargs)
    return Contest.objects.create(**defaults)


@pytest.mark.django_db
class TestContestCreation:
    """Test contest creation permissions and validation."""

    list_url = "contest-list"

    def test_create_requires_auth(self):
        client = APIClient()
        url = reverse(self.list_url)
        data = {"title": "New Contest", "start_time": str(timezone.now() + timedelta(hours=1)), "duration_minutes": 60}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_student_denied(self):
        student = UserFactory(role="student")
        client = auth_client(student)
        url = reverse(self.list_url)
        data = {
            "title": "New Contest",
            "start_time": str(timezone.now() + timedelta(hours=1)),
            "duration_minutes": 60,
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_teacher_success(self):
        teacher = UserFactory(role="teacher")
        client = auth_client(teacher)
        url = reverse(self.list_url)
        start = timezone.now() + timedelta(hours=1)
        data = {
            "title": "Teacher Contest",
            "description": "Created by teacher",
            "start_time": start.isoformat(),
            "duration_minutes": 90,
            "is_published": False,
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "Teacher Contest"
        assert response.data["is_published"] is False

    def test_create_admin_success(self):
        admin = AdminUserFactory()
        client = auth_client(admin)
        url = reverse(self.list_url)
        start = timezone.now() + timedelta(hours=1)
        data = {
            "title": "Admin Contest",
            "start_time": start.isoformat(),
            "duration_minutes": 60,
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_registration_start_after_contest_start_rejected(self):
        teacher = UserFactory(role="teacher")
        client = auth_client(teacher)
        url = reverse(self.list_url)
        start = timezone.now() + timedelta(hours=2)
        reg_start = start + timedelta(hours=1)  # registration starts after contest
        data = {
            "title": "Bad Contest",
            "start_time": start.isoformat(),
            "duration_minutes": 60,
            "registration_start": reg_start.isoformat(),
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestContestList:
    """Test contest listing with status filters."""

    list_url = "contest-list"

    def test_list_requires_auth(self):
        client = APIClient()
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_only_shows_published_to_students(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        # Published contest
        make_contest(created_by=teacher, is_published=True, title="Published")
        # Unpublished contest
        make_contest(created_by=teacher, is_published=False, title="Unpublished")

        client = auth_client(student)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        titles = [c["title"] for c in response.data["results"]]
        assert "Published" in titles
        assert "Unpublished" not in titles

    def test_list_teacher_sees_own_unpublished(self):
        teacher = UserFactory(role="teacher")
        other_teacher = UserFactory(role="teacher")
        make_contest(created_by=teacher, is_published=False, title="My Unpublished")
        make_contest(created_by=other_teacher, is_published=False, title="Other Unpublished")

        client = auth_client(teacher)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        titles = [c["title"] for c in response.data["results"]]
        assert "My Unpublished" in titles
        assert "Other Unpublished" not in titles

    def test_list_upcoming_filter(self):
        teacher = UserFactory(role="teacher")
        make_contest(created_by=teacher, title="Upcoming", start_time=timezone.now() + timedelta(hours=1))
        make_contest(created_by=teacher, title="Running", start_time=timezone.now() - timedelta(minutes=30), duration_minutes=120)

        client = auth_client(teacher)
        url = reverse(self.list_url)
        response = client.get(url, {"status": "upcoming"})
        assert response.status_code == status.HTTP_200_OK
        titles = [c["title"] for c in response.data["results"]]
        assert "Upcoming" in titles
        assert "Running" not in titles


@pytest.mark.django_db
class TestContestDetail:
    """Test contest detail retrieval."""

    def test_detail_requires_auth(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher)
        client = APIClient()
        url = reverse("contest-detail", kwargs={"pk": contest.pk})
        response = client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_detail_student_can_view_published(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, is_published=True)
        client = auth_client(student)
        url = reverse("contest-detail", kwargs={"pk": contest.pk})
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == contest.title

    def test_detail_student_cannot_view_unpublished(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, is_published=False)
        client = auth_client(student)
        url = reverse("contest-detail", kwargs={"pk": contest.pk})
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_detail_teacher_can_view_own_unpublished(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, is_published=False)
        client = auth_client(teacher)
        url = reverse("contest-detail", kwargs={"pk": contest.pk})
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestContestPublishUnpublish:
    """Test publish/unpublish actions."""

    def test_publish_requires_teacher_or_admin(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, is_published=False)
        client = auth_client(student)
        url = reverse("contest-publish", kwargs={"pk": contest.pk})
        response = client.post(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_publish_teacher_own_contest(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, is_published=False)
        client = auth_client(teacher)
        url = reverse("contest-publish", kwargs={"pk": contest.pk})
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "published"
        contest.refresh_from_db()
        assert contest.is_published is True

    def test_publish_other_teacher_denied(self):
        teacher1 = UserFactory(role="teacher")
        teacher2 = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher1, is_published=False)
        client = auth_client(teacher2)
        url = reverse("contest-publish", kwargs={"pk": contest.pk})
        response = client.post(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unpublish(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, is_published=True)
        client = auth_client(teacher)
        url = reverse("contest-unpublish", kwargs={"pk": contest.pk})
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "unpublished"
        contest.refresh_from_db()
        assert contest.is_published is False

    def test_admin_can_publish_any_contest(self):
        admin = AdminUserFactory()
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, is_published=False)
        client = auth_client(admin)
        url = reverse("contest-publish", kwargs={"pk": contest.pk})
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestContestRegistration:
    """Test contest registration."""

    def register_url(self, contest_id):
        return reverse("contest-register", kwargs={"contest_id": contest_id})

    def test_register_requires_auth(self):
        client = APIClient()
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher)
        url = self.register_url(contest.pk)
        response = client.post(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_register_teacher_denied(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=UserFactory(role="teacher"))
        client = auth_client(teacher)
        url = self.register_url(contest.pk)
        response = client.post(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_register_student_success(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher)
        client = auth_client(student)
        url = self.register_url(contest.pk)
        response = client.post(url)
        assert response.status_code == status.HTTP_201_CREATED
        assert ContestRegistration.objects.filter(contest=contest, user=student).exists()

    def test_register_duplicate_prevented(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher)
        ContestRegistration.objects.create(contest=contest, user=student)
        client = auth_client(student)
        url = self.register_url(contest.pk)
        response = client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_unpublished_contest_denied(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, is_published=False)
        client = auth_client(student)
        url = self.register_url(contest.pk)
        response = client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_before_window_denied(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        future = timezone.now() + timedelta(days=1)
        contest = make_contest(
            created_by=teacher,
            registration_start=future + timedelta(hours=1),
            registration_end=future + timedelta(hours=2),
        )
        client = auth_client(student)
        url = self.register_url(contest.pk)
        response = client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_after_window_denied(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        past = timezone.now() - timedelta(days=1)
        contest = make_contest(
            created_by=teacher,
            registration_start=past - timedelta(hours=2),
            registration_end=past - timedelta(hours=1),
        )
        client = auth_client(student)
        url = self.register_url(contest.pk)
        response = client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_capacity_full(self):
        student1 = UserFactory(role="student")
        student2 = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, max_participants=1)
        ContestRegistration.objects.create(contest=contest, user=student1)
        client = auth_client(student2)
        url = self.register_url(contest.pk)
        response = client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cancel_registration(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher, start_time=timezone.now() + timedelta(hours=2))
        ContestRegistration.objects.create(contest=contest, user=student)
        client = auth_client(student)
        url = self.register_url(contest.pk)
        response = client.delete(url)
        assert response.status_code == status.HTTP_200_OK
        assert not ContestRegistration.objects.filter(contest=contest, user=student).exists()

    def test_cannot_cancel_during_contest(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        ContestRegistration.objects.create(contest=contest, user=student)
        client = auth_client(student)
        url = self.register_url(contest.pk)
        response = client.delete(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestContestSubmission:
    """Test contest-specific submissions."""

    def test_submission_to_contest_requires_registration(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)

        client = auth_client(student)
        url = reverse("submissions-list-create")
        data = {
            "problem": str(problem.id),
            "code": "print(1)",
            "language": "python",
            "contest_id": str(contest.pk),
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_submission_to_contest_problem_not_in_contest(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        ContestRegistration.objects.create(contest=contest, user=student)
        problem = ProblemFactory(status="published")  # not linked to contest

        client = auth_client(student)
        url = reverse("submissions-list-create")
        data = {
            "problem": str(problem.id),
            "code": "print(1)",
            "language": "python",
            "contest_id": str(contest.pk),
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_submission_to_contest_before_start(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() + timedelta(hours=1),
            duration_minutes=120,
        )
        ContestRegistration.objects.create(contest=contest, user=student)
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)

        client = auth_client(student)
        url = reverse("submissions-list-create")
        data = {
            "problem": str(problem.id),
            "code": "print(1)",
            "language": "python",
            "contest_id": str(contest.pk),
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_submission_to_contest_after_end(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(hours=3),
            duration_minutes=60,  # ended 2 hours ago
        )
        ContestRegistration.objects.create(contest=contest, user=student)
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)

        client = auth_client(student)
        url = reverse("submissions-list-create")
        data = {
            "problem": str(problem.id),
            "code": "print(1)",
            "language": "python",
            "contest_id": str(contest.pk),
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_contest_submission_stored_with_contest(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        ContestRegistration.objects.create(contest=contest, user=student)
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)

        client = auth_client(student)
        url = reverse("submissions-list-create")
        data = {
            "problem": str(problem.id),
            "code": "print(1)",
            "language": "python",
            "contest_id": str(contest.pk),
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        from apps.submissions.models import Submission
        sub = Submission.objects.get(pk=response.data["id"])
        assert sub.contest_id == contest.pk

    def test_practice_submission_not_associated_with_contest(self):
        student = UserFactory(role="student")
        problem = ProblemFactory(status="published")
        client = auth_client(student)
        url = reverse("submissions-list-create")
        data = {
            "problem": str(problem.id),
            "code": "print(1)",
            "language": "python",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        from apps.submissions.models import Submission
        sub = Submission.objects.get(pk=response.data["id"])
        assert sub.contest is None


@pytest.mark.django_db
class TestContestStandings:
    """Test contest standings computation."""

    def standings_url(self, contest_id):
        return reverse("contest-standings", kwargs={"pk": contest_id})

    def test_standings_empty(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        client = auth_client(teacher)
        url = self.standings_url(contest.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_standings_scoring(self):
        teacher = UserFactory(role="teacher")
        student1 = UserFactory(role="student", handle="alice")
        student2 = UserFactory(role="student", handle="bob")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        problem1 = ProblemFactory(status="published", title="Problem A")
        problem2 = ProblemFactory(status="published", title="Problem B")
        ContestProblem.objects.create(contest=contest, problem=problem1, label="A", order=1, points=100)
        ContestProblem.objects.create(contest=contest, problem=problem2, label="B", order=2, points=200)

        ContestRegistration.objects.create(contest=contest, user=student1)
        ContestRegistration.objects.create(contest=contest, user=student2)

        # alice solves both
        SubmissionFactory(user=student1, problem=problem1, contest=contest, verdict="AC", status="done")
        SubmissionFactory(user=student1, problem=problem2, contest=contest, verdict="AC", status="done")
        # bob solves only problem A
        SubmissionFactory(user=student2, problem=problem1, contest=contest, verdict="AC", status="done")

        client = auth_client(teacher)
        url = self.standings_url(contest.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        assert response.data[0]["handle"] == "alice"
        assert response.data[0]["total_score"] == 300
        assert response.data[0]["solved_count"] == 2
        assert response.data[1]["handle"] == "bob"
        assert response.data[1]["total_score"] == 100
        assert response.data[1]["solved_count"] == 1

    def test_standings_tie_handling(self):
        teacher = UserFactory(role="teacher")
        student1 = UserFactory(role="student", handle="alice")
        student2 = UserFactory(role="student", handle="bob")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        problem1 = ProblemFactory(status="published")
        problem2 = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem1, label="A", order=1, points=100)
        ContestProblem.objects.create(contest=contest, problem=problem2, label="B", order=2, points=100)

        ContestRegistration.objects.create(contest=contest, user=student1)
        ContestRegistration.objects.create(contest=contest, user=student2)

        # Both solve both problems with same score -> tie
        SubmissionFactory(user=student1, problem=problem1, contest=contest, verdict="AC", status="done")
        SubmissionFactory(user=student1, problem=problem2, contest=contest, verdict="AC", status="done")
        SubmissionFactory(user=student2, problem=problem1, contest=contest, verdict="AC", status="done")
        SubmissionFactory(user=student2, problem=problem2, contest=contest, verdict="AC", status="done")

        client = auth_client(teacher)
        url = self.standings_url(contest.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        # Both should have rank 1 (tied)
        assert response.data[0]["rank"] == 1
        assert response.data[1]["rank"] == 1

    def test_standings_practice_submissions_not_counted(self):
        teacher = UserFactory(role="teacher")
        student = UserFactory(role="student")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)
        ContestRegistration.objects.create(contest=contest, user=student)

        # Practice submission (no contest_id) should not count
        SubmissionFactory(user=student, problem=problem, verdict="AC", status="done")

        client = auth_client(teacher)
        url = self.standings_url(contest.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0  # no contest submissions


@pytest.mark.django_db
class TestContestProblemManagement:
    """Test adding/removing problems from contests."""

    def test_add_problem_requires_teacher_or_admin(self):
        student = UserFactory(role="student")
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher)
        problem = ProblemFactory(status="published")
        client = auth_client(student)
        url = reverse("contest-add-problem", kwargs={"pk": contest.pk})
        data = {"problem": str(problem.id), "label": "A", "order": 1, "points": 100}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_add_problem_success(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher)
        problem = ProblemFactory(status="published")
        client = auth_client(teacher)
        url = reverse("contest-add-problem", kwargs={"pk": contest.pk})
        data = {"problem": str(problem.id), "label": "A", "order": 1, "points": 100}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert ContestProblem.objects.filter(contest=contest, problem=problem).exists()

    def test_add_duplicate_problem_rejected(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher)
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)
        client = auth_client(teacher)
        url = reverse("contest-add-problem", kwargs={"pk": contest.pk})
        data = {"problem": str(problem.id), "label": "B", "order": 2, "points": 100}
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_remove_problem_success(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher)
        problem = ProblemFactory(status="published")
        cp = ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)
        client = auth_client(teacher)
        url = reverse("contest-remove-problem", kwargs={"pk": contest.pk})
        response = client.delete(url, {"problem_id": str(problem.id)})
        assert response.status_code == status.HTTP_200_OK
        assert not ContestProblem.objects.filter(pk=cp.pk).exists()

    def test_list_problems(self):
        teacher = UserFactory(role="teacher")
        contest = make_contest(created_by=teacher)
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)
        client = auth_client(teacher)
        url = reverse("contest-problems", kwargs={"pk": contest.pk})
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1


@pytest.mark.django_db
class TestContestSubmissionList:
    """Test listing contest submissions."""

    def list_url(self, contest_id):
        return reverse("contest-submissions", kwargs={"contest_id": contest_id})

    def test_student_sees_only_own_submissions(self):
        teacher = UserFactory(role="teacher")
        student1 = UserFactory(role="student")
        student2 = UserFactory(role="student")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)
        ContestRegistration.objects.create(contest=contest, user=student1)
        ContestRegistration.objects.create(contest=contest, user=student2)

        SubmissionFactory(user=student1, problem=problem, contest=contest)
        SubmissionFactory(user=student2, problem=problem, contest=contest)

        client = auth_client(student1)
        url = self.list_url(contest.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["user_handle"] == student1.handle

    def test_teacher_sees_all_submissions_for_own_contest(self):
        teacher = UserFactory(role="teacher")
        student = UserFactory(role="student")
        contest = make_contest(
            created_by=teacher,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)
        ContestRegistration.objects.create(contest=contest, user=student)
        SubmissionFactory(user=student, problem=problem, contest=contest)

        client = auth_client(teacher)
        url = self.list_url(contest.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1

    def test_teacher_cannot_see_other_contest_submissions(self):
        teacher1 = UserFactory(role="teacher")
        teacher2 = UserFactory(role="teacher")
        student = UserFactory(role="student")
        contest = make_contest(
            created_by=teacher1,
            start_time=timezone.now() - timedelta(minutes=10),
            duration_minutes=120,
        )
        problem = ProblemFactory(status="published")
        ContestProblem.objects.create(contest=contest, problem=problem, label="A", order=1, points=100)
        ContestRegistration.objects.create(contest=contest, user=student)
        SubmissionFactory(user=student, problem=problem, contest=contest)

        client = auth_client(teacher2)
        url = self.list_url(contest.pk)
        response = client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
