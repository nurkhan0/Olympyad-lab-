import factory
from django.contrib.auth import get_user_model

from .models import Problem, Tag, TestCase, UserProblemStatus

User = get_user_model()


class TagFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Tag

    name = factory.Sequence(lambda n: f"tag-{n}")
    slug = factory.Sequence(lambda n: f"tag-{n}")


class ProblemFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Problem

    title = factory.Sequence(lambda n: f"Problem {n}")
    slug = factory.Sequence(lambda n: f"problem-{n}")
    difficulty = "easy"
    statement = "Write a solution."
    status = "published"
    time_ms = 1000
    memory_mb = 256
    solver_count = 0

    @factory.post_generation
    def tags(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for tag in extracted:
                self.tags.add(tag)


class TestCaseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = TestCase

    input = "1\n2\n"
    expected_output = "3\n"
    is_sample = False
    order = 0

    class Params:
        sample = factory.Trait(
            is_sample=True,
        )


class UserProblemStatusFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = UserProblemStatus

    status = "todo"
    solved_at = None
