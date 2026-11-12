import factory
from django.contrib.auth import get_user_model

from .models import (
    UserRating,
    RatingHistory,
    Leaderboard,
    LeaderboardEntry,
    Achievement,
    UserAchievement,
)

User = get_user_model()


class UserRatingFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = UserRating

    user = factory.SubFactory("apps.users.factories.UserFactory")
    rating_type = "global"
    rating_value = 1000
    max_rating = 1000
    games_played = 0
    wins = 0
    losses = 0
    draws = 0


class RatingHistoryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = RatingHistory

    user = factory.SubFactory("apps.users.factories.UserFactory")
    rating_type = "global"
    old_rating = 1000
    new_rating = 1100
    change = 100
    reason = "contest_win"


class LeaderboardFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Leaderboard

    rating_type = "global"
    name = "Global Leaderboard"
    snapshot_data = []
    is_active = True


class LeaderboardEntryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = LeaderboardEntry

    leaderboard = factory.SubFactory("apps.ratings.factories.LeaderboardFactory")
    user = factory.SubFactory("apps.users.factories.UserFactory")
    rank = 1
    rating_value = 1500
    additional_data = {}


class AchievementFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Achievement

    code = factory.Sequence(lambda n: f"achievement-{n}")
    name = factory.Sequence(lambda n: f"Achievement {n}")
    description = "A test achievement"
    achievement_type = "problems_solved"
    icon = ""
    criteria = {}
    is_hidden = False
    points = 0


class UserAchievementFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = UserAchievement

    user = factory.SubFactory("apps.users.factories.UserFactory")
    achievement = factory.SubFactory("apps.ratings.factories.AchievementFactory")
    progress = {}
    is_notified = False
