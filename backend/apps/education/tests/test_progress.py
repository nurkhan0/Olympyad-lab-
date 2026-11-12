"""Stage 2 tests: enrollment, progress correctness, completion rules."""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.education.factories import (
    CourseFactory,
    EnrollmentFactory,
    LessonFactory,
    ModuleFactory,
    ProblemCourseLinkFactory,
    TeacherFactory,
    UserFactory,
)
from apps.education.models import Enrollment, LessonProgress
from apps.problems.factories import ProblemFactory, UserProblemStatusFactory


def auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestEnrollmentFlow:
    def test_student_can_enroll_in_published_course(self):
        student = UserFactory()
        course = CourseFactory(is_published=True)
        LessonFactory(module=ModuleFactory(course=course))
        client = auth_client(student)
        url = reverse("course-enroll", kwargs={"pk": str(course.id)})
        response = client.post(url)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == "active"
        assert response.data["course"]["total_lessons"] == 1

    def test_enrollment_creates_progress_rows_for_published_lessons_only(self):
        student = UserFactory()
        course = CourseFactory()
        module = ModuleFactory(course=course)
        LessonFactory(module=module, order=0)
        LessonFactory(module=module, order=1, is_published=False)
        client = auth_client(student)
        url = reverse("course-enroll", kwargs={"pk": str(course.id)})
        client.post(url)
        enrollment = Enrollment.objects.get(student=student, course=course)
        assert enrollment.lesson_progress.count() == 1

    def test_cannot_enroll_in_unpublished_course(self):
        student = UserFactory()
        course = CourseFactory(is_published=False)
        client = auth_client(student)
        url = reverse("course-enroll", kwargs={"pk": str(course.id)})
        response = client.post(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_teacher_cannot_enroll(self):
        teacher = TeacherFactory()
        course = CourseFactory()
        client = auth_client(teacher)
        url = reverse("course-enroll", kwargs={"pk": str(course.id)})
        response = client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reenroll_reactivates_dropped_enrollment(self):
        student = UserFactory()
        course = CourseFactory()
        EnrollmentFactory(student=student, course=course, status="dropped")
        client = auth_client(student)
        url = reverse("course-enroll", kwargs={"pk": str(course.id)})
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK
        enrollment = Enrollment.objects.get(student=student, course=course)
        assert enrollment.status == "active"


@pytest.mark.django_db
class TestProgressCorrectness:
    def test_progress_denominator_counts_published_lessons_only(self):
        course = CourseFactory()
        module = ModuleFactory(course=course)
        published = LessonFactory(module=module, order=0)
        LessonFactory(module=module, order=1, is_published=False)
        enrollment = EnrollmentFactory(course=course)

        progress = LessonProgress.objects.get(enrollment=enrollment, lesson=published)
        progress.mark_completed()

        enrollment.refresh_from_db()
        assert float(enrollment.progress) == 100.0
        assert enrollment.status == "completed"
        assert enrollment.completed_at is not None

    def test_unpublishing_completed_lesson_removes_it_from_denominator(self):
        course = CourseFactory()
        module = ModuleFactory(course=course)
        lesson1 = LessonFactory(module=module, order=0)
        lesson2 = LessonFactory(module=module, order=1)
        enrollment = EnrollmentFactory(course=course)

        LessonProgress.objects.get(enrollment=enrollment, lesson=lesson1).mark_completed()
        enrollment.refresh_from_db()
        assert float(enrollment.progress) == 50.0

        lesson2.is_published = False
        lesson2.save()
        enrollment.refresh_from_db()
        assert float(enrollment.progress) == 100.0

    def test_no_duplicate_completion_records(self):
        course = CourseFactory()
        lesson = LessonFactory(module=ModuleFactory(course=course))
        enrollment = EnrollmentFactory(course=course)
        progress = LessonProgress.objects.get(enrollment=enrollment, lesson=lesson)

        progress.mark_completed()
        progress.mark_completed()

        assert LessonProgress.objects.filter(enrollment=enrollment).count() == 1
        assert progress.status == "completed"


@pytest.mark.django_db
class TestManualCompletionRules:
    def _progress_url(self, enrollment):
        return reverse(
            "enrollment-progress-detail",
            kwargs={
                "enrollment_pk": str(enrollment.id),
                "pk": str(
                    LessonProgress.objects.get(
                        enrollment=enrollment, lesson=self.lesson
                    ).id
                ),
            },
        )

    def test_manual_complete_blocked_with_unsolved_required_problems(self):
        course = CourseFactory()
        self.lesson = LessonFactory(module=ModuleFactory(course=course))
        problem = ProblemFactory(status="published")
        ProblemCourseLinkFactory(lesson=self.lesson, problem=problem, is_required=True)
        enrollment = EnrollmentFactory(course=course)

        client = auth_client(enrollment.student)

        # genuinely wrong URL: non-existent progress pk → 404
        wrong_url = reverse(
            "enrollment-progress-complete",
            kwargs={
                "enrollment_pk": str(enrollment.id),
                "pk": "00000000-0000-0000-0000-000000000000",
            },
        )
        response = client.post(wrong_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # correct URL form: /enrollments/{id}/progress/{pk}/complete/
        url = reverse(
            "enrollment-progress-complete",
            kwargs={
                "enrollment_pk": str(enrollment.id),
                "pk": str(
                    LessonProgress.objects.get(enrollment=enrollment, lesson=self.lesson).id
                ),
            },
        )
        response = client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["unsolved_count"] == 1

    def test_manual_complete_allowed_after_solving_required_problems(self):
        course = CourseFactory()
        self.lesson = LessonFactory(module=ModuleFactory(course=course))
        problem = ProblemFactory(status="published")
        ProblemCourseLinkFactory(lesson=self.lesson, problem=problem, is_required=True)
        enrollment = EnrollmentFactory(course=course)
        UserProblemStatusFactory(
            user=enrollment.student, problem=problem, status="solved"
        )

        client = auth_client(enrollment.student)
        url = reverse(
            "enrollment-progress-complete",
            kwargs={
                "enrollment_pk": str(enrollment.id),
                "pk": str(
                    LessonProgress.objects.get(enrollment=enrollment, lesson=self.lesson).id
                ),
            },
        )
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "completed"

    def test_manual_complete_allowed_for_lesson_without_required_problems(self):
        course = CourseFactory()
        lesson = LessonFactory(module=ModuleFactory(course=course))
        problem = ProblemFactory(status="published")
        ProblemCourseLinkFactory(lesson=lesson, problem=problem, is_required=False)
        enrollment = EnrollmentFactory(course=course)

        client = auth_client(enrollment.student)
        url = reverse(
            "enrollment-progress-complete",
            kwargs={
                "enrollment_pk": str(enrollment.id),
                "pk": str(LessonProgress.objects.get(enrollment=enrollment, lesson=lesson).id),
            },
        )
        response = client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "completed"

    def test_student_cannot_complete_foreign_progress(self):
        course = CourseFactory()
        lesson = LessonFactory(module=ModuleFactory(course=course))
        other_enrollment = EnrollmentFactory(course=course)  # different student
        stranger = UserFactory()
        EnrollmentFactory(student=stranger, course=course)

        client = auth_client(stranger)
        url = reverse(
            "enrollment-progress-complete",
            kwargs={
                "enrollment_pk": str(other_enrollment.id),
                "pk": str(
                    LessonProgress.objects.get(
                        enrollment=other_enrollment, lesson=lesson
                    ).id
                ),
            },
        )
        response = client.post(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_list_foreign_enrollment_progress(self):
        course = CourseFactory()
        enrollment_a = EnrollmentFactory(course=course)
        stranger = UserFactory()
        enrollment_b = EnrollmentFactory(student=stranger, course=course)

        client = auth_client(stranger)
        url = reverse(
            "enrollment-progress-list",
            kwargs={"enrollment_pk": str(enrollment_a.id)},
        )
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    def test_progress_row_creation_not_allowed(self):
        enrollment = EnrollmentFactory()
        client = auth_client(enrollment.student)
        url = reverse(
            "enrollment-progress-list",
            kwargs={"enrollment_pk": str(enrollment.id)},
        )
        response = client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
class TestLessonPublishBackfill:
    def test_publishing_lesson_backfills_progress_rows(self):
        course = CourseFactory()
        module = ModuleFactory(course=course)
        lesson = LessonFactory(module=module, is_published=False)
        enrollment = EnrollmentFactory(course=course)

        assert enrollment.lesson_progress.count() == 0

        lesson.is_published = True
        lesson.save()

        assert enrollment.lesson_progress.count() == 1
