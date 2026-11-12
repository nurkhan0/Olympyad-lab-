import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


def generate_unique_slug(model_class, title, instance_pk=None, default="item"):
    """Generate a unique slug for a model instance, appending a counter on collision."""
    from slugify import slugify

    base = slugify(title) or default
    slug = base
    counter = 1
    qs = model_class.objects.filter(slug=slug)
    if instance_pk:
        qs = qs.exclude(pk=instance_pk)
    while qs.exists():
        slug = f"{base}-{counter}"
        counter += 1
        qs = model_class.objects.filter(slug=slug).exclude(pk=instance_pk)
    return slug


class Category(models.Model):
    """Category/direction for courses."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(unique=True, max_length=250, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]
        indexes = [models.Index(fields=["slug"])]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = generate_unique_slug(Category, self.title, self.pk, default="category")
        super().save(*args, **kwargs)


class Course(models.Model):
    """Course model for educational content."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=250, blank=True)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courses",
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="taught_courses",
        limit_choices_to={"role": "teacher"},
    )
    is_published = models.BooleanField(default=False)
    start_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Когда курс открывается для записи (пусто — сразу)",
    )
    end_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Когда курс закрывается (пусто — без ограничения)",
    )
    thumbnail_url = models.URLField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_published", "teacher"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["category"]),
            models.Index(fields=["start_at", "end_at"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = generate_unique_slug(Course, self.title, self.pk, default="course")
        super().save(*args, **kwargs)

    @property
    def enrollment_count(self):
        return self.enrollments.filter(status="active").count()

    @property
    def module_count(self):
        return self.modules.count()

    @property
    def total_lessons(self):
        """Published lessons only — progress must be computed against what
        students can actually see and complete."""
        return Lesson.objects.filter(module__course=self, is_published=True).count()


class Module(models.Model):
    """Module within a course."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order"]
        unique_together = [("course", "order")]

    def __str__(self):
        return f"{self.course.title} — Module {self.order}: {self.title}"

    @property
    def lesson_count(self):
        return self.lessons.count()


class Lesson(models.Model):
    """Lesson within a module."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    content_html = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    estimated_minutes = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order"]
        unique_together = [("module", "order")]

    def __str__(self):
        return f"{self.module.course.title} — {self.module.title} — Lesson {self.order}: {self.title}"

    @property
    def material_count(self):
        return self.materials.count()


class Material(models.Model):
    """Learning material attached to a lesson."""

    MATERIAL_TYPES = [
        ("pdf", "PDF Document"),
        ("video", "Video Link"),
        ("link", "External Link"),
        ("text", "Text Content"),
        ("code", "Code Example"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="materials")
    title = models.CharField(max_length=200)
    material_type = models.CharField(max_length=10, choices=MATERIAL_TYPES)
    url = models.URLField(max_length=500, blank=True, default="")
    content = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order"]
        unique_together = [("lesson", "order")]

    def __str__(self):
        return f"{self.lesson.title} — {self.material_type}: {self.title}"


class Enrollment(models.Model):
    """Student enrollment in a course."""

    STATUS_CHOICES = [
        ("active", "Active"),
        ("completed", "Completed"),
        ("dropped", "Dropped"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")
    enrolled_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    progress = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    last_accessed = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("student", "course")]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["course", "status"]),
        ]

    def __str__(self):
        return f"{self.student.handle} — {self.course.title} ({self.status})"

    def update_progress(self):
        """Calculate and update progress based on completed published lessons.

        The denominator counts published lessons only, and completed progress
        rows of lessons that were later unpublished do not count either.
        """
        total_lessons = self.course.total_lessons
        if total_lessons == 0:
            self.progress = 0
        else:
            completed = self.lesson_progress.filter(
                status="completed", lesson__is_published=True
            ).count()
            self.progress = min(round((completed / total_lessons) * 100, 2), 100)

        if self.progress >= 100 and self.status == "active":
            self.status = "completed"
            self.completed_at = timezone.now()

        self.save(update_fields=["progress", "status", "completed_at"])


class LessonProgress(models.Model):
    """Track student progress on individual lessons."""

    STATUS_CHOICES = [
        ("not_started", "Not Started"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(
        Enrollment, on_delete=models.CASCADE, related_name="lesson_progress"
    )
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="not_started")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    time_spent_minutes = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("enrollment", "lesson")]

    def __str__(self):
        return f"{self.enrollment.student.handle} — {self.lesson.title} ({self.status})"

    def mark_started(self):
        if self.status == "not_started":
            self.status = "in_progress"
            self.started_at = timezone.now()
            self.save(update_fields=["status", "started_at"])

    def mark_completed(self):
        """Idempotently complete the lesson.

        Enrollment progress is recalculated by the post_save signal — never
        duplicated here — so no double writes and no duplicate completions.
        """
        if self.status != "completed":
            self.status = "completed"
            self.completed_at = timezone.now()
            self.save(update_fields=["status", "completed_at"])


class ProblemCourseLink(models.Model):
    """Link problems from contests/problems app to lessons."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    problem = models.ForeignKey(
        "problems.Problem", on_delete=models.CASCADE, related_name="course_links"
    )
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="problem_links")
    order = models.PositiveIntegerField(default=0)
    is_required = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order"]
        unique_together = [("lesson", "problem")]

    def __str__(self):
        return f"{self.lesson.title} — {self.problem.title}"
