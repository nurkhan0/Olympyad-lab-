import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.factories import AdminUserFactory, UserFactory

from ..factories import ProblemFactory
from ..models import Problem, TestCase


def auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def create_payload(**overrides) -> dict:
    payload = {
        'title': 'Sum of two numbers',
        'difficulty': 'easy',
        'statement': 'Read two integers and print their sum.',
        'time_ms': 1000,
        'memory_mb': 256,
        'tags': ['math'],
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
class TestManageableProblemList:
    endpoint = 'problems-manage'

    def test_list_requires_teacher_or_admin(self):
        student = UserFactory(role='student')
        response = auth_client(student).get(reverse(self.endpoint))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_requires_authentication(self):
        response = APIClient().get(reverse(self.endpoint))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_teacher_sees_published_and_own_drafts(self):
        teacher = UserFactory(role='teacher')
        other_teacher = UserFactory(role='teacher')
        published = ProblemFactory(status='published', slug='published-one')
        ProblemFactory(status='draft', slug='other-draft', author=other_teacher)
        own_draft = ProblemFactory(status='draft', slug='own-draft', author=teacher)

        response = auth_client(teacher).get(reverse(self.endpoint))

        assert response.status_code == status.HTTP_200_OK
        slugs = {row['slug'] for row in response.data['results']}
        assert slugs == {published.slug, own_draft.slug}

    def test_admin_sees_every_problem_including_drafts(self):
        admin = AdminUserFactory()
        other_teacher = UserFactory(role='teacher')
        ProblemFactory(status='draft', slug='other-draft', author=other_teacher)
        ProblemFactory(status='published', slug='published-one')

        response = auth_client(admin).get(reverse(self.endpoint))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2

    def test_list_reports_is_author(self):
        teacher = UserFactory(role='teacher')
        ProblemFactory(status='draft', slug='own-draft', author=teacher)
        ProblemFactory(status='published', slug='foreign-published')

        response = auth_client(teacher).get(reverse(self.endpoint))
        flags = {row['slug']: row['is_author'] for row in response.data['results']}

        assert flags == {'own-draft': True, 'foreign-published': False}

    def test_list_search_by_title(self):
        teacher = UserFactory(role='teacher')
        ProblemFactory(status='published', slug='target', title='Two Sum')
        ProblemFactory(status='published', slug='other', title='Binary Search')

        response = auth_client(teacher).get(reverse(self.endpoint), {'search': 'two sum'})

        assert response.status_code == status.HTTP_200_OK
        assert [row['slug'] for row in response.data['results']] == ['target']

    def test_list_filter_by_status(self):
        teacher = UserFactory(role='teacher')
        ProblemFactory(status='draft', slug='own-draft', author=teacher)
        ProblemFactory(status='published', slug='published-one')

        response = auth_client(teacher).get(reverse(self.endpoint), {'status': 'draft'})

        assert [row['slug'] for row in response.data['results']] == ['own-draft']


@pytest.mark.django_db
class TestManageableProblemCreate:
    endpoint = 'problems-manage'

    def test_create_requires_teacher_or_admin(self):
        student = UserFactory(role='student')
        response = auth_client(student).post(reverse(self.endpoint), create_payload(), format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_creates_draft_owned_by_teacher(self):
        teacher = UserFactory(role='teacher')

        response = auth_client(teacher).post(reverse(self.endpoint), create_payload(), format='json')

        assert response.status_code == status.HTTP_201_CREATED
        problem = Problem.objects.get(pk=response.data['id'])
        assert problem.status == 'draft'
        assert problem.author_id == teacher.pk
        assert problem.slug == 'sum-of-two-numbers'
        assert [tag.name for tag in problem.tags.all()] == ['math']

    def test_teacher_cannot_publish_on_create(self):
        teacher = UserFactory(role='teacher')

        response = auth_client(teacher).post(
            reverse(self.endpoint),
            create_payload(status='published'),
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'draft'
        assert Problem.objects.get(pk=response.data['id']).status == 'draft'

    def test_admin_may_create_published(self):
        admin = AdminUserFactory()

        response = auth_client(admin).post(
            reverse(self.endpoint),
            create_payload(status='published'),
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'published'
        assert Problem.objects.get(pk=response.data['id']).author_id == admin.pk

    def test_create_requires_statement(self):
        teacher = UserFactory(role='teacher')

        response = auth_client(teacher).post(
            reverse(self.endpoint),
            create_payload(statement=''),
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'statement' in response.data

    def test_create_rejects_unknown_difficulty(self):
        teacher = UserFactory(role='teacher')

        response = auth_client(teacher).post(
            reverse(self.endpoint),
            create_payload(difficulty='impossible'),
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'difficulty' in response.data

    def test_created_problem_is_listable_for_teacher(self):
        teacher = UserFactory(role='teacher')
        created = auth_client(teacher).post(reverse(self.endpoint), create_payload(), format='json')

        response = auth_client(teacher).get(reverse(self.endpoint))

        assert created.status_code == status.HTTP_201_CREATED
        assert [row['slug'] for row in response.data['results']] == [created.data['slug']]


@pytest.mark.django_db
class TestProblemTestCasePermissions:
    """Teachers manage tests for problems they authored; admins for any."""

    def _url(self, slug: str) -> str:
        return reverse('admin-tests-list', kwargs={'slug': slug})

    def test_teacher_can_list_tests_for_own_problem(self):
        teacher = UserFactory(role='teacher')
        problem = ProblemFactory(status='draft', slug='own-draft', author=teacher)

        response = auth_client(teacher).get(self._url(problem.slug))

        assert response.status_code == status.HTTP_200_OK

    def test_teacher_cannot_list_tests_for_foreign_problem(self):
        teacher = UserFactory(role='teacher')
        problem = ProblemFactory(status='draft', slug='foreign-draft',
                                 author=UserFactory(role='teacher'))

        response = auth_client(teacher).get(self._url(problem.slug))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_can_create_test_for_own_problem(self):
        teacher = UserFactory(role='teacher')
        problem = ProblemFactory(status='draft', slug='own-draft', author=teacher)

        response = auth_client(teacher).post(
            self._url(problem.slug),
            {'input': '1 2\n', 'expected_output': '3\n', 'is_sample': True, 'order': 0},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert problem.test_cases.count() == 1

    def test_teacher_cannot_create_test_for_foreign_problem(self):
        teacher = UserFactory(role='teacher')
        problem = ProblemFactory(status='draft', slug='foreign-draft',
                                 author=UserFactory(role='teacher'))

        response = auth_client(teacher).post(
            self._url(problem.slug),
            {'input': '1 2\n', 'expected_output': '3\n', 'is_sample': False, 'order': 0},
            format='json',
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert problem.test_cases.count() == 0

    def test_admin_can_manage_tests_for_any_problem(self):
        admin = AdminUserFactory()
        problem = ProblemFactory(status='published', slug='foreign-published',
                                 author=UserFactory(role='teacher'))

        response = auth_client(admin).post(
            self._url(problem.slug),
            {'input': '1 2\n', 'expected_output': '3\n', 'is_sample': False, 'order': 0},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert problem.test_cases.count() == 1

    def test_student_cannot_manage_tests(self):
        student = UserFactory(role='student')
        problem = ProblemFactory(status='published', slug='published-one')

        response = auth_client(student).get(self._url(problem.slug))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_teacher_can_delete_test_case_of_own_problem(self):
        teacher = UserFactory(role='teacher')
        problem = ProblemFactory(status='draft', slug='own-draft', author=teacher)
        test_case = problem.test_cases.create(
            input='1 2\n', expected_output='3\n', is_sample=False, order=0,
        )

        url = reverse('admin-tests-detail', kwargs={'slug': problem.slug, 'pk': test_case.pk})
        response = auth_client(teacher).delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not TestCase.objects.filter(pk=test_case.pk).exists()