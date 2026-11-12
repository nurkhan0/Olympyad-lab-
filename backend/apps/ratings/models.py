import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


class RatingType(models.TextChoices):
    GLOBAL = "global", "Global Elo Rating"
    COURSE = "course", "Course Rating"
    OLYMPIAD = "olympiad", "Olympiad Rating"
    WEEKLY = "weekly", "Weekly Leaderboard"
    MONTHLY = "monthly", "Monthly Leaderboard"
    SEASONAL = "seasonal", "Seasonal Leaderboard"
    SCHOOL = "school", "School Leaderboard"
    CLASS = "class", "Class Leaderboard"


class UserRating(models.Model):
    """User rating for different rating types."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ratings",
    )
    rating_type = models.CharField(max_length=20, choices=RatingType.choices)
    rating_value = models.IntegerField(default=1000)  # Elo starts at 1000
    max_rating = models.IntegerField(default=1000)
    games_played = models.PositiveIntegerField(default=0)
    wins = models.PositiveIntegerField(default=0)
    losses = models.PositiveIntegerField(default=0)
    draws = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    # For course/olympiad specific ratings
    course = models.ForeignKey(
        "education.Course",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ratings",
    )
    olympiad = models.ForeignKey(
        "contests.Contest",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ratings",
    )

    # For school/class leaderboards
    school = models.CharField(max_length=200, blank=True, default="")
    class_name = models.CharField(max_length=100, blank=True, default="")

    # Time period for periodic leaderboards
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # The rating-type dimensions overlap (a course rating also carries
            # school='' / class_name='' / NULL course), so unconditional
            # unique_together tuples collide with each other. Each scope is
            # enforced only within its own rating type via conditional
            # constraints.
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(rating_type=RatingType.GLOBAL),
                name="uniq_global_rating_per_user",
            ),
            models.UniqueConstraint(
                fields=["user", "course"],
                condition=models.Q(rating_type=RatingType.COURSE),
                name="uniq_course_rating_per_user_course",
            ),
            models.UniqueConstraint(
                fields=["user", "olympiad"],
                condition=models.Q(rating_type=RatingType.OLYMPIAD),
                name="uniq_olympiad_rating_per_user_contest",
            ),
            models.UniqueConstraint(
                fields=["user", "school", "class_name"],
                condition=models.Q(rating_type__in=[RatingType.SCHOOL, RatingType.CLASS]),
                name="uniq_school_rating_per_user",
            ),
            models.UniqueConstraint(
                fields=["user", "period_start", "period_end"],
                condition=models.Q(
                    rating_type__in=[RatingType.WEEKLY, RatingType.MONTHLY, RatingType.SEASONAL]
                ),
                name="uniq_period_rating_per_user",
            ),
        ]
        indexes = [
            models.Index(fields=["rating_type", "-rating_value"]),
            models.Index(fields=["rating_type", "course", "-rating_value"]),
            models.Index(fields=["rating_type", "school", "class_name", "-rating_value"]),
            models.Index(fields=["rating_type", "period_start", "period_end", "-rating_value"]),
        ]

    def __str__(self):
        context = ""
        if self.course:
            context = f" ({self.course.title})"
        elif self.olympiad:
            context = f" ({self.olympiad.title})"
        elif self.school:
            context = f" ({self.school}"
            if self.class_name:
                context += f" - {self.class_name}"
            context += ")"
        return f"{self.user.handle} — {self.get_rating_type_display()}: {self.rating_value}{context}"


class RatingHistory(models.Model):
    """Track rating changes over time."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rating_history",
    )
    rating_type = models.CharField(max_length=20, choices=RatingType.choices)
    old_rating = models.IntegerField()
    new_rating = models.IntegerField()
    change = models.IntegerField()  # positive or negative
    reason = models.CharField(max_length=100)  # "contest_win", "lesson_complete", etc.
    related_contest = models.ForeignKey(
        "contests.Contest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rating_changes",
    )
    related_submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rating_changes",
    )
    related_lesson = models.ForeignKey(
        "education.Lesson",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rating_changes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "rating_type", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user.handle} — {self.rating_type}: {self.old_rating} → {self.new_rating} ({self.change:+d})"


class Leaderboard(models.Model):
    """Cached leaderboard snapshots for performance."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rating_type = models.CharField(max_length=20, choices=RatingType.choices)
    name = models.CharField(max_length=200)  # e.g., "Global Top 100", "School ABC - Class 10A"

    # Context fields
    course = models.ForeignKey(
        "education.Course",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    olympiad = models.ForeignKey(
        "contests.Contest",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    school = models.CharField(max_length=200, blank=True, default="")
    class_name = models.CharField(max_length=100, blank=True, default="")

    # Period for periodic leaderboards
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)

    # Cached data
    snapshot_data = models.JSONField(default=list)  # List of {rank, user_id, handle, rating, ...}
    generated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["rating_type", "name"]
        indexes = [
            models.Index(fields=["rating_type", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.rating_type})"


class LeaderboardEntry(models.Model):
    """Individual entry in a leaderboard."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    leaderboard = models.ForeignKey(Leaderboard, on_delete=models.CASCADE, related_name="entries")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="leaderboard_entries",
    )
    rank = models.PositiveIntegerField()
    rating_value = models.IntegerField()
    additional_data = models.JSONField(default=dict)  # For extra info like solved_count, etc.

    class Meta:
        ordering = ["rank"]
        unique_together = [("leaderboard", "user")]
        indexes = [
            models.Index(fields=["leaderboard", "rank"]),
        ]

    def __str__(self):
        return f"#{self.rank} {self.user.handle} — {self.rating_value}"


class Achievement(models.Model):
    """Achievements/badges users can earn."""

    ACHIEVEMENT_TYPES = [
        ("contest_win", "Contest Winner"),
        ("streak", "Streak"),
        ("problems_solved", "Problems Solved"),
        ("course_complete", "Course Completed"),
        ("rating_milestone", "Rating Milestone"),
        ("participation", "Participation"),
        ("special", "Special"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(unique=True, max_length=50)  # e.g., "first_win", "streak_7"
    name = models.CharField(max_length=100)
    description = models.TextField()
    achievement_type = models.CharField(max_length=20, choices=ACHIEVEMENT_TYPES)
    icon = models.CharField(max_length=50, blank=True, default="")  # Icon name or emoji
    criteria = models.JSONField(default=dict)  # JSON criteria for auto-awarding
    is_hidden = models.BooleanField(default=False)  # Hidden until earned
    points = models.PositiveIntegerField(default=0)  # Points for profile showcase
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["achievement_type", "name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class UserAchievement(models.Model):
    """User earned achievements."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="achievements",
    )
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name="user_achievements")
    earned_at = models.DateTimeField(auto_now_add=True)
    progress = models.JSONField(default=dict)  # Track progress towards achievement
    is_notified = models.BooleanField(default=False)

    class Meta:
        unique_together = [("user", "achievement")]
        ordering = ["-earned_at"]

    def __str__(self):
        return f"{self.user.handle} — {self.achievement.name}"
