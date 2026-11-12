import factory

from apps.education.models import (
    Category,
    Course,
    Enrollment,
    Lesson,
    Material,
    Module,
    ProblemCourseLink,
)
from apps.users.factories import UserFactory, AdminUserFactory


class TeacherFactory(UserFactory):
    role = "teacher"


class CategoryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Category

    title = factory.Sequence(lambda n: f"Category {n}")


class CourseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Course

    title = factory.Sequence(lambda n: f"Course {n}")
    description = "A course description"
    teacher = factory.SubFactory(TeacherFactory)
    category = factory.SubFactory(CategoryFactory)
    is_published = True


class ModuleFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Module

    course = factory.SubFactory(CourseFactory)
    title = factory.Sequence(lambda n: f"Module {n}")
    order = factory.Sequence(lambda n: n)


class LessonFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Lesson

    module = factory.SubFactory(ModuleFactory)
    title = factory.Sequence(lambda n: f"Lesson {n}")
    content = "Lesson content"
    order = factory.Sequence(lambda n: n)
    is_published = True


class MaterialFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Material

    lesson = factory.SubFactory(LessonFactory)
    title = factory.Sequence(lambda n: f"Material {n}")
    material_type = "text"
    content = "Material content"
    order = factory.Sequence(lambda n: n)


class EnrollmentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Enrollment

    student = factory.SubFactory(UserFactory)
    course = factory.SubFactory(CourseFactory)
    status = "active"


class ProblemCourseLinkFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ProblemCourseLink

    lesson = factory.SubFactory(LessonFactory)
    order = factory.Sequence(lambda n: n)
    is_required = True
