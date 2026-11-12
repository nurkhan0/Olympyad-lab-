"""Django management command to set up idempotent E2E test data.

Creates reproducible test data for Playwright E2E tests including:
- Test users (teachers, students, admin)
- Categories, courses, modules, lessons
- Materials (PDF, video, text, code)
- Problem-course links for practice problems
- Enrollments
- Contests (upcoming, active, completed) with problems and registrations
"""
import os
import tempfile
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone


def get_e2e_test_password() -> str:
    """Get E2E test password from environment or use default for test isolation."""
    return os.environ.get("E2E_TEST_PASSWORD", "testpass123")

from apps.contests.models import Contest, ContestProblem, ContestRegistration
from apps.education.models import (
    Category,
    Course,
    Enrollment,
    Lesson,
    Material,
    Module,
    ProblemCourseLink,
)
from apps.problems.models import Problem

User = get_user_model()


class Command(BaseCommand):
    """Set up reproducible E2E test data."""

    help = "Create idempotent E2E test data for Playwright tests"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete existing test data before creating (use with caution)",
        )

    def handle(self, *args, **options):
        self.stdout.write("Setting up E2E test data...")

        if options["clean"]:
            self.clean_existing_data()

        with transaction.atomic():
            self.create_test_users()
            self.create_category()
            self.create_course_and_content()
            self.create_materials()
            self.create_problem_course_links()
            self.create_enrollments()
            self.create_contests()

        self.stdout.write(self.style.SUCCESS("E2E test data setup complete!"))

    def clean_existing_data(self):
        """Clean existing test data (optional, for fresh start)."""
        self.stdout.write("Cleaning existing test data...")
        # We'll be idempotent instead of cleaning
        pass

    def create_test_users(self):
        """Create test users with deterministic passwords."""
        test_password = get_e2e_test_password()

        # Teacher 1
        self.teacher1, created = User.objects.get_or_create(
            email="teacher@test.com",
            defaults={
                "handle": "teacher1",
                "role": "teacher",
                "is_verified": True,
                "is_active": True,
            },
        )
        self.teacher1.set_password(test_password)
        self.teacher1.save()
        if created:
            self.stdout.write(f"Created teacher: {self.teacher1.email}")
        else:
            self.stdout.write(f"Updated teacher: {self.teacher1.email}")

        # Teacher 2
        self.teacher2, created = User.objects.get_or_create(
            email="teacher2@test.com",
            defaults={
                "handle": "teacher2",
                "role": "teacher",
                "is_verified": True,
                "is_active": True,
            },
        )
        self.teacher2.set_password(test_password)
        self.teacher2.save()
        if created:
            self.stdout.write(f"Created teacher: {self.teacher2.email}")
        else:
            self.stdout.write(f"Updated teacher: {self.teacher2.email}")

        # Student 1
        self.student1, created = User.objects.get_or_create(
            email="student@test.com",
            defaults={
                "handle": "student1",
                "role": "student",
                "is_verified": True,
                "is_active": True,
            },
        )
        self.student1.set_password(test_password)
        self.student1.save()
        if created:
            self.stdout.write(f"Created student: {self.student1.email}")
        else:
            self.stdout.write(f"Updated student: {self.student1.email}")

        # Student 2
        self.student2, created = User.objects.get_or_create(
            email="student2@test.com",
            defaults={
                "handle": "student2",
                "role": "student",
                "is_verified": True,
                "is_active": True,
            },
        )
        self.student2.set_password(test_password)
        self.student2.save()
        if created:
            self.stdout.write(f"Created student: {self.student2.email}")
        else:
            self.stdout.write(f"Updated student: {self.student2.email}")

        # Admin user
        self.admin, created = User.objects.get_or_create(
            email="admin@test.com",
            defaults={
                "handle": "admin",
                "role": "admin",
                "is_staff": True,
                "is_superuser": True,
                "is_verified": True,
                "is_active": True,
            },
        )
        self.admin.set_password(test_password)
        self.admin.save()
        if created:
            self.stdout.write(f"Created admin: {self.admin.email}")
        else:
            self.stdout.write(f"Updated admin: {self.admin.email}")

    def create_category(self):
        """Create the programming category."""
        self.category, created = Category.objects.get_or_create(
            slug="programming",
            defaults={
                "title": "Программирование",
                "description": "Курсы по программированию",
            },
        )
        if created:
            self.stdout.write(f"Created category: {self.category.title}")

    def create_course_and_content(self):
        """Create course, module, and lessons."""
        now = timezone.now()

        # Course
        self.course, created = Course.objects.get_or_create(
            slug="python-dlya-nachinayushchikh",
            defaults={
                "title": "Python для начинающих",
                "description": "Базовый курс Python для новичков. Переменные, типы данных, циклы, функции.",
                "category": self.category,
                "teacher": self.teacher1,
                "is_published": True,
                "start_at": now - timedelta(days=1),
                "end_at": now + timedelta(days=365),
            },
        )
        if created:
            self.stdout.write(f"Created course: {self.course.title}")

        # Module
        self.module, created = Module.objects.get_or_create(
            course=self.course,
            order=1,
            defaults={
                "title": "Модуль 1: Основы",
                "description": "Основы программирования на Python",
            },
        )
        if created:
            self.stdout.write(f"Created module: {self.module.title}")

        # Lessons
        self.lesson1, created = Lesson.objects.get_or_create(
            module=self.module,
            order=1,
            defaults={
                "title": "Урок 1: Переменные",
                "content": "В этом уроке мы изучим, что такое переменные и как их использовать в Python.",
                "content_html": "<p>В этом уроке мы изучим, что такое переменные и как их использовать в Python.</p>",
                "estimated_minutes": 15,
                "is_published": True,
            },
        )
        if created:
            self.stdout.write(f"Created lesson: {self.lesson1.title}")

        self.lesson2, created = Lesson.objects.get_or_create(
            module=self.module,
            order=2,
            defaults={
                "title": "Урок 2: Типы данных",
                "content": "Изучим основные типы данных в Python: целые числа, числа с плавающей точкой, строки, булевы значения.",
                "content_html": "<p>Изучим основные типы данных в Python: целые числа, числа с плавающей точкой, строки, булевы значения.</p>",
                "estimated_minutes": 20,
                "is_published": True,
            },
        )
        if created:
            self.stdout.write(f"Created lesson: {self.lesson2.title}")

        self.lesson3, created = Lesson.objects.get_or_create(
            module=self.module,
            order=3,
            defaults={
                "title": "Урок 3: Практика",
                "content": "Практический урок для закрепления знаний о переменных и типах данных.",
                "content_html": "<p>Практический урок для закрепления знаний о переменных и типах данных.</p>",
                "estimated_minutes": 30,
                "is_published": True,
            },
        )
        if created:
            self.stdout.write(f"Created lesson: {self.lesson3.title}")

    def create_materials(self):
        """Create learning materials for lessons."""
        # Create a small valid PDF fixture
        pdf_content = self._create_pdf_fixture()
        pdf_path = os.path.join(settings.MEDIA_ROOT, "test_fixtures", "sample.pdf")
        os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
        with open(pdf_path, "wb") as f:
            f.write(pdf_content)

        # Materials for lesson 1 (Variables)
        Material.objects.get_or_create(
            lesson=self.lesson1,
            order=1,
            defaults={
                "title": "Конспект: Переменные в Python",
                "material_type": "pdf",
                "url": "/media/test_fixtures/sample.pdf",
            },
        )

        Material.objects.get_or_create(
            lesson=self.lesson1,
            order=2,
            defaults={
                "title": "Видео: Введение в переменные",
                "material_type": "video",
                "url": "https://www.youtube.com/watch?v=rfscVS0vtbw",
            },
        )

        Material.objects.get_or_create(
            lesson=self.lesson1,
            order=3,
            defaults={
                "title": "Теория: Назначение переменных",
                "material_type": "text",
                "content": "Переменные в Python — это именованные области памяти, которые хранят значения. Присваивание происходит с помощью оператора =.",
            },
        )

        Material.objects.get_or_create(
            lesson=self.lesson1,
            order=4,
            defaults={
                "title": "Пример кода: Работа с переменными",
                "material_type": "code",
                "content": "name = 'Alice'\nage = 25\nheight = 1.75\nis_student = True\nprint(f'{name} is {age} years old')",
            },
        )

        # Materials for lesson 2 (Data Types)
        Material.objects.get_or_create(
            lesson=self.lesson2,
            order=1,
            defaults={
                "title": "Конспект: Типы данных",
                "material_type": "pdf",
                "url": "/media/test_fixtures/sample.pdf",
            },
        )

        Material.objects.get_or_create(
            lesson=self.lesson2,
            order=2,
            defaults={
                "title": "Видео: Типы данных в Python",
                "material_type": "video",
                "url": "https://www.youtube.com/watch?v=7YcW25PHnAA",
            },
        )

        # Materials for lesson 3 (Practice)
        Material.objects.get_or_create(
            lesson=self.lesson3,
            order=1,
            defaults={
                "title": "Практическое задание",
                "material_type": "text",
                "content": "Решите практические задачи для закрепления материала.",
            },
        )

        self.stdout.write("Created materials for lessons")

    def _create_pdf_fixture(self) -> bytes:
        """Create a minimal valid PDF file."""
        # Minimal valid PDF content
        return b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Test PDF for E2E) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000206 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
299
%%EOF
"""

    def create_problem_course_links(self):
        """Link problems to lessons for practice."""
        # Get existing problems
        hello_world = Problem.objects.get(slug="hello-world")
        variables_practice = Problem.objects.get(slug="variables-practice")
        problem_a = Problem.objects.get(slug="problem-a")
        problem_b = Problem.objects.get(slug="problem-b")

        # Lesson 1: Variables - required: hello-world, variables-practice
        ProblemCourseLink.objects.get_or_create(
            lesson=self.lesson1,
            problem=hello_world,
            defaults={"order": 1, "is_required": True},
        )
        ProblemCourseLink.objects.get_or_create(
            lesson=self.lesson1,
            problem=variables_practice,
            defaults={"order": 2, "is_required": True},
        )

        # Lesson 2: Data Types - required: problem-a
        ProblemCourseLink.objects.get_or_create(
            lesson=self.lesson2,
            problem=problem_a,
            defaults={"order": 1, "is_required": True},
        )

        # Lesson 3: Practice - required: problem-b, optional: hello-world
        ProblemCourseLink.objects.get_or_create(
            lesson=self.lesson3,
            problem=problem_b,
            defaults={"order": 1, "is_required": True},
        )
        ProblemCourseLink.objects.get_or_create(
            lesson=self.lesson3,
            problem=hello_world,
            defaults={"order": 2, "is_required": False},
        )

        self.stdout.write("Created problem-course links")

    def create_enrollments(self):
        """Enroll students in the course."""
        Enrollment.objects.get_or_create(
            student=self.student1,
            course=self.course,
            defaults={"status": "active"},
        )
        Enrollment.objects.get_or_create(
            student=self.student2,
            course=self.course,
            defaults={"status": "active"},
        )
        self.stdout.write("Created enrollments")

    def create_contests(self):
        """Create contests: upcoming, active, completed."""
        now = timezone.now()

        # Get problems for contests
        hello_world = Problem.objects.get(slug="hello-world")
        variables_practice = Problem.objects.get(slug="variables-practice")
        problem_a = Problem.objects.get(slug="problem-a")
        problem_b = Problem.objects.get(slug="problem-b")

        # 1. Upcoming contest (starts in 1 hour)
        self.upcoming_contest, created = Contest.objects.get_or_create(
            title="E2E Upcoming Contest",
            defaults={
                "description": "Upcoming contest for E2E testing",
                "rules": "Standard CF rules",
                "contest_type": "CF",
                "start_time": now + timedelta(hours=1),
                "duration_minutes": 120,
                "registration_start": now - timedelta(days=1),
                "registration_end": now + timedelta(minutes=30),
                "max_participants": 100,
                "is_public": True,
                "is_published": True,
                "is_rated": True,
                "created_by": self.teacher1,
            },
        )
        if created:
            self.stdout.write(f"Created contest: {self.upcoming_contest.title}")

        # Add problems to upcoming contest
        ContestProblem.objects.get_or_create(
            contest=self.upcoming_contest,
            problem=hello_world,
            defaults={"label": "A", "order": 1, "points": 100},
        )
        ContestProblem.objects.get_or_create(
            contest=self.upcoming_contest,
            problem=variables_practice,
            defaults={"label": "B", "order": 2, "points": 200},
        )

        # Register students for upcoming contest
        ContestRegistration.objects.get_or_create(
            contest=self.upcoming_contest,
            user=self.student1,
        )
        ContestRegistration.objects.get_or_create(
            contest=self.upcoming_contest,
            user=self.student2,
        )

        # 2. Active contest (started 10 minutes ago, runs for 2 hours)
        self.active_contest, created = Contest.objects.get_or_create(
            title="E2E Active Contest",
            defaults={
                "description": "Active contest for E2E testing",
                "rules": "Standard CF rules",
                "contest_type": "CF",
                "start_time": now - timedelta(minutes=10),
                "duration_minutes": 120,
                "registration_start": now - timedelta(days=1),
                "registration_end": now + timedelta(minutes=30),
                "max_participants": 100,
                "is_public": True,
                "is_published": True,
                "is_rated": True,
                "created_by": self.teacher1,
            },
        )
        if created:
            self.stdout.write(f"Created contest: {self.active_contest.title}")

        # Add problems to active contest
        ContestProblem.objects.get_or_create(
            contest=self.active_contest,
            problem=problem_a,
            defaults={"label": "A", "order": 1, "points": 100},
        )
        ContestProblem.objects.get_or_create(
            contest=self.active_contest,
            problem=problem_b,
            defaults={"label": "B", "order": 2, "points": 200},
        )

        # Register students for active contest
        ContestRegistration.objects.get_or_create(
            contest=self.active_contest,
            user=self.student1,
        )
        ContestRegistration.objects.get_or_create(
            contest=self.active_contest,
            user=self.student2,
        )

        # 3. Completed contest (ended 1 hour ago)
        self.completed_contest, created = Contest.objects.get_or_create(
            title="E2E Completed Contest",
            defaults={
                "description": "Completed contest for E2E testing",
                "rules": "Standard CF rules",
                "contest_type": "CF",
                "start_time": now - timedelta(hours=3),
                "duration_minutes": 120,
                "registration_start": now - timedelta(days=2),
                "registration_end": now - timedelta(hours=2),
                "max_participants": 100,
                "is_public": True,
                "is_published": True,
                "is_rated": True,
                "created_by": self.teacher1,
            },
        )
        if created:
            self.stdout.write(f"Created contest: {self.completed_contest.title}")

        # Add problems to completed contest
        ContestProblem.objects.get_or_create(
            contest=self.completed_contest,
            problem=hello_world,
            defaults={"label": "A", "order": 1, "points": 100},
        )
        ContestProblem.objects.get_or_create(
            contest=self.completed_contest,
            problem=problem_a,
            defaults={"label": "B", "order": 2, "points": 200},
        )

        # Register students for completed contest
        ContestRegistration.objects.get_or_create(
            contest=self.completed_contest,
            user=self.student1,
        )
        ContestRegistration.objects.get_or_create(
            contest=self.completed_contest,
            user=self.student2,
        )

        self.stdout.write("Created contests with problems and registrations")