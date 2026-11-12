from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.ratings.models import UserRating, RatingHistory, Achievement, UserAchievement
from apps.contests.models import Contest
from apps.submissions.models import Submission
from apps.education.models import Enrollment, LessonProgress


# Elo calculation constants
K_FACTOR = 32
INITIAL_RATING = 1000


def calculate_elo_change(rating_a, rating_b, score_a):
    """Calculate Elo rating change for player A."""
    expected_a = 1 / (1 + 10 ** ((rating_b - rating_a) / 400))
    change = round(K_FACTOR * (score_a - expected_a))
    return change


@receiver(post_save, sender=Contest)
def update_olympiad_ratings(sender, instance, **kwargs):
    """Update olympiad ratings when contest ends."""
    if not instance.is_rated or not instance.end_time or timezone.now() < instance.end_time:
        return

    # Get all participants with their final standings
    # This would typically be called after contest results are finalized
    pass


@receiver(post_save, sender=Submission)
def update_rating_on_submission(sender, instance, **kwargs):
    """Update rating when a submission gets a verdict."""
    if instance.verdict != "AC":
        return

    # Update global rating for accepted submissions
    user = instance.user
    problem = instance.problem

    # Calculate rating change based on problem difficulty
    difficulty_bonus = {
        "easy": 5,
        "medium": 10,
        "hard": 20,
        "expert": 40,
    }.get(problem.difficulty, 5)

    # Get or create global rating
    rating, created = UserRating.objects.get_or_create(
        user=user,
        rating_type="global",
        defaults={"rating_value": INITIAL_RATING, "max_rating": INITIAL_RATING},
    )

    old_rating = rating.rating_value
    rating.rating_value += difficulty_bonus
    if rating.rating_value > rating.max_rating:
        rating.max_rating = rating.rating_value
    rating.games_played += 1
    rating.wins += 1
    rating.save()

    # Create history record
    RatingHistory.objects.create(
        user=user,
        rating_type="global",
        old_rating=old_rating,
        new_rating=rating.rating_value,
        change=difficulty_bonus,
        reason="problem_solved",
        related_submission=instance,
    )

    # Check for achievements
    check_achievements(user)


@receiver(post_save, sender=LessonProgress)
def update_rating_on_lesson_complete(sender, instance, **kwargs):
    """Update course rating when lesson is completed."""
    if instance.status != "completed":
        return

    enrollment = instance.enrollment
    user = enrollment.student
    course = enrollment.course

    # Get or create course rating
    rating, created = UserRating.objects.get_or_create(
        user=user,
        rating_type="course",
        course=course,
        defaults={"rating_value": INITIAL_RATING, "max_rating": INITIAL_RATING},
    )

    # Award points for completing a lesson
    lesson_points = 10
    old_rating = rating.rating_value
    rating.rating_value += lesson_points
    if rating.rating_value > rating.max_rating:
        rating.max_rating = rating.rating_value
    rating.save()

    # Create history record
    RatingHistory.objects.create(
        user=user,
        rating_type="course",
        old_rating=old_rating,
        new_rating=rating.rating_value,
        change=lesson_points,
        reason="lesson_complete",
        related_lesson=instance.lesson,
    )

    # Check for achievements
    check_achievements(user)


def check_achievements(user):
    """Check and award achievements for a user."""
    # Get all active achievements
    achievements = Achievement.objects.filter(is_hidden=False)

    for achievement in achievements:
        # Check if already earned
        if UserAchievement.objects.filter(user=user, achievement=achievement).exists():
            continue

        # Check criteria
        if evaluate_achievement_criteria(user, achievement):
            UserAchievement.objects.create(user=user, achievement=achievement)
            # Award rating points for achievement
            award_achievement_rating(user, achievement)


def evaluate_achievement_criteria(user, achievement):
    """Evaluate if user meets achievement criteria."""
    criteria = achievement.criteria
    if not criteria:
        return False

    criterion_type = criteria.get("type")

    if criterion_type == "problems_solved":
        count = user.submissions.filter(verdict="AC").count()
        return count >= criteria.get("count", 1)

    if criterion_type == "streak":
        # Check consecutive days with submissions
        # Implementation depends on streak logic
        return False

    if criterion_type == "rating_milestone":
        rating = UserRating.objects.filter(user=user, rating_type="global").first()
        if rating:
            return rating.rating_value >= criteria.get("rating", 1200)

    if criterion_type == "course_complete":
        completed = user.enrollments.filter(status="completed").count()
        return completed >= criteria.get("count", 1)

    if criterion_type == "contest_win":
        wins = user.created_contests.filter(participants=user).count()  # Placeholder
        return wins >= criteria.get("count", 1)

    return False


def award_achievement_rating(user, achievement):
    """Award rating points for earning an achievement."""
    points = achievement.points
    if points <= 0:
        return

    rating, _ = UserRating.objects.get_or_create(
        user=user,
        rating_type="global",
        defaults={"rating_value": INITIAL_RATING, "max_rating": INITIAL_RATING},
    )

    old_rating = rating.rating_value
    rating.rating_value += points
    if rating.rating_value > rating.max_rating:
        rating.max_rating = rating.rating_value
    rating.save()

    RatingHistory.objects.create(
        user=user,
        rating_type="global",
        old_rating=old_rating,
        new_rating=rating.rating_value,
        change=points,
        reason=f"achievement_{achievement.code}",
    )


def generate_leaderboards():
    """Generate leaderboard snapshots (called periodically)."""
    from apps.ratings.models import Leaderboard, LeaderboardEntry, UserRating

    # Clear old inactive leaderboards
    Leaderboard.objects.filter(is_active=False).delete()

    # Generate global leaderboard
    generate_global_leaderboard()

    # Generate course leaderboards
    generate_course_leaderboards()

    # Generate school/class leaderboards
    generate_school_leaderboards()

    # Generate periodic leaderboards
    generate_periodic_leaderboards()


def generate_global_leaderboard():
    """Generate global top 100 leaderboard."""
    from apps.ratings.models import Leaderboard, LeaderboardEntry, UserRating

    ratings = UserRating.objects.filter(rating_type="global").order_by("-rating_value")[:100]

    leaderboard, _ = Leaderboard.objects.update_or_create(
        rating_type="global",
        name="Global Top 100",
        defaults={
            "rating_type": "global",
            "name": "Global Top 100",
            "is_active": True,
        },
    )

    # Clear old entries
    leaderboard.entries.all().delete()

    # Create new entries
    entries = []
    for rank, rating in enumerate(ratings, 1):
        entries.append(
            LeaderboardEntry(
                leaderboard=leaderboard,
                user=rating.user,
                rank=rank,
                rating_value=rating.rating_value,
                additional_data={
                    "max_rating": rating.max_rating,
                    "games_played": rating.games_played,
                },
            )
        )
    LeaderboardEntry.objects.bulk_create(entries)

    # Update snapshot
    leaderboard.snapshot_data = [
        {
            "rank": e.rank,
            "user_id": str(e.user.id),
            "handle": e.user.handle,
            "rating": e.rating_value,
            "avatar_url": e.user.avatar_url,
        }
        for e in entries
    ]
    leaderboard.save()


def generate_course_leaderboards():
    """Generate per-course leaderboards."""
    from apps.education.models import Course
    from apps.ratings.models import Leaderboard, LeaderboardEntry, UserRating

    courses = Course.objects.filter(is_published=True)

    for course in courses:
        ratings = UserRating.objects.filter(rating_type="course", course=course).order_by("-rating_value")[:50]

        if not ratings:
            continue

        leaderboard, _ = Leaderboard.objects.update_or_create(
            rating_type="course",
            course=course,
            defaults={
                "rating_type": "course",
                "name": f"{course.title} Leaderboard",
                "course": course,
                "is_active": True,
            },
        )

        leaderboard.entries.all().delete()

        entries = []
        for rank, rating in enumerate(ratings, 1):
            entries.append(
                LeaderboardEntry(
                    leaderboard=leaderboard,
                    user=rating.user,
                    rank=rank,
                    rating_value=rating.rating_value,
                    additional_data={
                        "progress": rating.course.enrollments.get(student=rating.user).progress
                        if rating.course.enrollments.filter(student=rating.user).exists()
                        else 0,
                    },
                )
            )
        LeaderboardEntry.objects.bulk_create(entries)

        leaderboard.snapshot_data = [
            {
                "rank": e.rank,
                "user_id": str(e.user.id),
                "handle": e.user.handle,
                "rating": e.rating_value,
                "avatar_url": e.user.avatar_url,
            }
            for e in entries
        ]
        leaderboard.save()


def generate_school_leaderboards():
    """Generate school and class leaderboards."""
    # This would require users to have school/class fields
    pass


def generate_periodic_leaderboards():
    """Generate weekly/monthly/seasonal leaderboards."""
    # Implementation for time-based leaderboards
    pass
