"""Stage 1 tests: course content ownership, nested chain validation, visibility."""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.education.factories import (
    CourseFactory,
    LessonFactory,
    MaterialFactory,
    ModuleFactory,
    TeacherFactory,
    UserFactory,
)


def auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestModuleOwnership:
    def test_teacher_can_create_module_in_own_course(self):
        teacher = TeacherFactory()
        course = CourseFactory(teacher=teacher)
        client = auth_client(teacher)
        url = reverse("course-modules-list", kwargs={"course_pk": str(course.id)})
        response = client.post(url, {"title": "Module 1", "order": 0}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "Module 1"

    def test_teacher_cannot_create_module_in_foreign_course(self):
        owner = TeacherFactory()
        stranger = TeacherFactory()
        course = CourseFactory(teacher=owner)
        client = auth_client(stranger)
        url = reverse("course-modules-list", kwargs={"course_pk": str(course.id)})
        response = client.post(url, {"title": "Hijacked", "order": 0}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create_module(self):
        student = UserFactory()
        course = CourseFactory()
        client = auth_client(student)
        url = reverse("course-modules-list", kwargs={"course_pk": str(course.id)})
        response = client.post(url, {"title": "Nope"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_cannot_create_module(self):
        course = CourseFactory()
        client = APIClient()
        url = reverse("course-modules-list", kwargs={"course_pk": str(course.id)})
        response = client.post(url, {"title": "Nope"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_teacher_cannot_update_foreign_module(self):
        owner = TeacherFactory()
        stranger = TeacherFactory()
        course = CourseFactory(teacher=owner)
        module = ModuleFactory(course=course)
        client = auth_client(stranger)
        url = reverse(
            "course-modules-detail",
            kwargs={"course_pk": str(course.id), "pk": str(module.id)},
        )
        response = client.patch(url, {"title": "Hijacked"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestLessonChainValidation:
    def test_teacher_can_create_lesson_in_own_module(self):
        teacher = TeacherFactory()
        course = CourseFactory(teacher=teacher)
        module = ModuleFactory(course=course)
        client = auth_client(teacher)
        url = reverse(
            "module-lessons-list",
            kwargs={"course_pk": str(course.id), "module_pk": str(module.id)},
        )
        response = client.post(url, {"title": "Lesson 1", "order": 0}, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_lesson_with_foreign_module_id_is_404(self):
        """A lesson id paired with a foreign course/module must not resolve."""
        teacher = TeacherFactory()
        course_a = CourseFactory(teacher=teacher)
        module_a = ModuleFactory(course=course_a)
        lesson = LessonFactory(module=module_a)

        course_b = CourseFactory()
        module_b = ModuleFactory(course=course_b)

        client = auth_client(teacher)
        url = reverse(
            "module-lessons-detail",
            kwargs={
                "course_pk": str(course_b.id),
                "module_pk": str(module_b.id),
                "pk": str(lesson.id),
            },
        )
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_stranger_cannot_create_lesson_in_foreign_module(self):
        owner = TeacherFactory()
        stranger = TeacherFactory()
        course = CourseFactory(teacher=owner)
        module = ModuleFactory(course=course)
        client = auth_client(stranger)
        url = reverse(
            "module-lessons-list",
            kwargs={"course_pk": str(course.id), "module_pk": str(module.id)},
        )
        response = client.post(url, {"title": "Hijacked"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestMaterialOwnership:
    def test_stranger_cannot_create_material_in_foreign_lesson(self):
        owner = TeacherFactory()
        stranger = TeacherFactory()
        course = CourseFactory(teacher=owner)
        module = ModuleFactory(course=course)
        lesson = LessonFactory(module=module)
        client = auth_client(stranger)
        url = reverse(
            "lesson-materials-list",
            kwargs={
                "course_pk": str(course.id),
                "module_pk": str(module.id),
                "lesson_pk": str(lesson.id),
            },
        )
        response = client.post(url, {"title": "Hijacked", "material_type": "text"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_owner_can_create_material(self):
        teacher = TeacherFactory()
        course = CourseFactory(teacher=teacher)
        module = ModuleFactory(course=course)
        lesson = LessonFactory(module=module)
        client = auth_client(teacher)
        url = reverse(
            "lesson-materials-list",
            kwargs={
                "course_pk": str(course.id),
                "module_pk": str(module.id),
                "lesson_pk": str(lesson.id),
            },
        )
        response = client.post(
            url, {"title": "Read me", "material_type": "text", "content": "hi"}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestNestedVisibility:
    def test_anonymous_cannot_read_unpublished_course_modules(self):
        course = CourseFactory(is_published=False)
        ModuleFactory(course=course)
        client = APIClient()
        url = reverse("course-modules-list", kwargs={"course_pk": str(course.id)})
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    def test_anonymous_can_read_published_course_modules(self):
        course = CourseFactory(is_published=True)
        ModuleFactory(course=course)
        client = APIClient()
        url = reverse("course-modules-list", kwargs={"course_pk": str(course.id)})
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1

    def test_student_cannot_read_lesson_of_unpublished_course(self):
        course = CourseFactory(is_published=False)
        module = ModuleFactory(course=course)
        lesson = LessonFactory(module=module)
        client = auth_client(UserFactory())
        url = reverse(
            "module-lessons-detail",
            kwargs={
                "course_pk": str(course.id),
                "module_pk": str(module.id),
                "pk": str(lesson.id),
            },
        )
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_student_cannot_read_unpublished_lesson_of_published_course(self):
        course = CourseFactory(is_published=True)
        module = ModuleFactory(course=course)
        lesson = LessonFactory(module=module, is_published=False)
        client = auth_client(UserFactory())
        url = reverse(
            "module-lessons-detail",
            kwargs={
                "course_pk": str(course.id),
                "module_pk": str(module.id),
                "pk": str(lesson.id),
            },
        )
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_course_teacher_reads_unpublished_content(self):
        teacher = TeacherFactory()
        course = CourseFactory(teacher=teacher, is_published=False)
        module = ModuleFactory(course=course)
        lesson = LessonFactory(module=module, is_published=False)
        client = auth_client(teacher)
        url = reverse(
            "module-lessons-detail",
            kwargs={
                "course_pk": str(course.id),
                "module_pk": str(module.id),
                "pk": str(lesson.id),
            },
        )
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_anonymous_cannot_read_material_of_unpublished_lesson(self):
        course = CourseFactory(is_published=True)
        module = ModuleFactory(course=course)
        lesson = LessonFactory(module=module, is_published=False)
        MaterialFactory(lesson=lesson)
        client = APIClient()
        url = reverse(
            "lesson-materials-list",
            kwargs={
                "course_pk": str(course.id),
                "module_pk": str(module.id),
                "lesson_pk": str(lesson.id),
            },
        )
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []
