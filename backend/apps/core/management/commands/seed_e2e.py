"""Idempotent E2E seed data.

Run: python manage.py seed_e2e
Safe to re-run: uses update_or_create everywhere and only adds missing rows,
so repeated suite runs never duplicate test data.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.contests.models import Contest, ContestProblem, ContestRegistration
from apps.education.models import (
    Category,
    Course,
    Lesson,
    Material,
    Module,
    ProblemCourseLink,
)
from apps.problems.models import Problem, TestCase
from apps.users.models import CustomUser

E2E_PASSWORD = 'testpass123'

USERS = [
    {'email': 'teacher@test.com', 'handle': 'e2e_teacher', 'role': 'teacher'},
    {'email': 'teacher2@test.com', 'handle': 'e2e_teacher2', 'role': 'teacher'},
    {'email': 'student@test.com', 'handle': 'e2e_student', 'role': 'student'},
    {'email': 'student2@test.com', 'handle': 'e2e_student2', 'role': 'student'},
    {'email': 'admin@test.com', 'handle': 'e2e_admin', 'role': 'admin', 'is_staff': True, 'is_superuser': True},
]

PROBLEMS = [
    {'title': 'Hello World', 'slug': 'hello-world', 'difficulty': 'easy', 'test_input': '', 'test_output': 'Hello, World!'},
    {'title': 'Variables Practice', 'slug': 'variables-practice', 'difficulty': 'easy', 'test_input': '', 'test_output': '42'},
    {'title': 'Problem A', 'slug': 'problem-a', 'difficulty': 'easy', 'test_input': '', 'test_output': 'Solution A'},
    {'title': 'Problem B', 'slug': 'problem-b', 'difficulty': 'medium', 'test_input': '', 'test_output': 'Solution B'},
]


class Command(BaseCommand):
    help = 'Seed idempotent E2E test data (users, problems, course, contest)'

    @transaction.atomic
    def handle(self, *args, **options):
        self._seed_users()
        teacher = CustomUser.objects.get(email='teacher@test.com')
        category = self._seed_categories()
        problems = self._seed_problems()
        course = self._seed_course(teacher, category, problems)
        self._seed_contest(teacher, problems)
        self.stdout.write(self.style.SUCCESS(f'E2E seed complete (course={course.slug})'))

    def _seed_users(self):
        for spec in USERS:
            user, created = CustomUser.objects.get_or_create(
                email=spec['email'],
                defaults={'handle': spec['handle'], 'role': spec['role']},
            )
            user.handle = spec['handle']
            user.role = spec['role']
            user.set_password(E2E_PASSWORD)
            user.is_active = True
            user.is_verified = True
            user.is_staff = spec.get('is_staff', False)
            user.is_superuser = spec.get('is_superuser', False)
            user.save()

    def _seed_categories(self):
        category, _ = Category.objects.get_or_create(
            title='programming', defaults={'description': 'Programming fundamentals'}
        )
        return category

    def _seed_problems(self):
        by_slug = {}
        for spec in PROBLEMS:
            problem, created = Problem.objects.get_or_create(
                slug=spec['slug'],
                defaults={
                    'title': spec['title'],
                    'difficulty': spec['difficulty'],
                    'statement': f'Solve {spec["title"]}. Output exactly the expected string.',
                    'status': 'published',
                },
            )
            if created or not problem.test_cases.exists():
                TestCase.objects.get_or_create(
                    problem=problem,
                    order=0,
                    defaults={
                        'input': spec['test_input'],
                        'expected_output': spec['test_output'],
                        'is_sample': True,
                    },
                )
            by_slug[spec['slug']] = problem
        return by_slug

    def _seed_course(self, teacher, category, problems):
        course, created = Course.objects.get_or_create(
            title='E2E Foundation Course',
            defaults={
                'teacher': teacher,
                'category': category,
                'description': 'Seed course for E2E: modules, lessons, materials, practice problems.',
                'is_published': True,
            },
        )
        module, _ = Module.objects.get_or_create(
            course=course, order=0, defaults={'title': 'Модуль 1: Основы'}
        )
        lesson, lesson_created = Lesson.objects.get_or_create(
            module=module, order=0,
            defaults={
                'title': 'Урок 1: Переменные',
                'content': '# Переменные в Python\n\nПеременные хранят данные.',
                'estimated_minutes': 30,
                'is_published': True,
            },
        )
        if lesson_created or not lesson.materials.exists():
            Material.objects.get_or_create(
                lesson=lesson, order=0,
                defaults={
                    'title': 'Видео: Переменные',
                    'material_type': 'video',
                    'url': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                },
            )
            Material.objects.get_or_create(
                lesson=lesson, order=1,
                defaults={
                    'title': 'Шпаргалка по переменным',
                    'material_type': 'link',
                    'url': 'https://example.com/cheatsheet.pdf',
                },
            )
        ProblemCourseLink.objects.get_or_create(
            lesson=lesson, problem=problems['hello-world'],
            defaults={'order': 0, 'is_required': True},
        )
        ProblemCourseLink.objects.get_or_create(
            lesson=lesson, problem=problems['variables-practice'],
            defaults={'order': 1, 'is_required': False},
        )
        return course

    def _seed_contest(self, teacher, problems):
        from django.utils import timezone

        contest, created = Contest.objects.get_or_create(
            title='E2E Sprint Olympiad',
            defaults={
                'description': 'Seed contest for E2E registration and standings flows.',
                'contest_type': 'CF',
                'start_time': timezone.now(),
                'duration_minutes': 180,
                'is_public': True,
                'is_published': True,
                'is_rated': False,
                'created_by': teacher,
            },
        )
        if created:
            ContestProblem.objects.create(
                contest=contest, problem=problems['problem-a'], label='A', order=0, points=100
            )
            ContestProblem.objects.create(
                contest=contest, problem=problems['problem-b'], label='B', order=1, points=200
            )
