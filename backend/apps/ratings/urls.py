from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.ratings.views import (
    UserRatingViewSet,
    RatingHistoryViewSet,
    LeaderboardViewSet,
    AchievementViewSet,
    UserAchievementViewSet,
)

router = DefaultRouter()
router.register(r"ratings", UserRatingViewSet, basename="rating")
router.register(r"rating-history", RatingHistoryViewSet, basename="rating-history")
router.register(r"leaderboards", LeaderboardViewSet, basename="leaderboard")
router.register(r"achievements", AchievementViewSet, basename="achievement")
router.register(r"my-achievements", UserAchievementViewSet, basename="user-achievement")

urlpatterns = [
    path("", include(router.urls)),
]
