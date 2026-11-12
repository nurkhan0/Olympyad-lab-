import uuid

import mistune
from django.conf import settings
from django.db import models
from slugify import slugify


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Problem(models.Model):
    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
        ('expert', 'Expert'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, blank=True, max_length=250)
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='easy')
    statement = models.TextField()
    statement_html = models.TextField(blank=True)
    time_ms = models.PositiveIntegerField(default=1000)
    memory_mb = models.PositiveIntegerField(default=256)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='authored_problems',
    )
    tags = models.ManyToManyField(Tag, blank=True, through='ProblemTag')
    solver_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def _unique_slug(self, base: str) -> str:
        slug = base
        counter = 1
        while Problem.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f'{base}-{counter}'
            counter += 1
        return slug

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or 'problem'
            self.slug = self._unique_slug(base)
        self.statement_html = mistune.html(self.statement)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class ProblemTag(models.Model):
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('problem', 'tag')

    def __str__(self):
        return f'{self.problem.slug} — {self.tag.name}'


class TestCase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name='test_cases')
    input = models.TextField()
    expected_output = models.TextField()
    is_sample = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f'{self.problem.slug} — test #{self.order}'


class UserProblemStatus(models.Model):
    STATUS_CHOICES = [
        ('solved', 'Solved'),
        ('attempted', 'Attempted'),
        ('todo', 'Todo'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='todo')
    solved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'problem')

    def __str__(self):
        return f'{self.user_id} — {self.problem.slug} ({self.status})'
