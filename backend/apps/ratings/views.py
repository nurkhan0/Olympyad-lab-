from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from apps.ratings.models import (
    UserRating,
    RatingHistory,
    Leaderboard,
    LeaderboardEntry,
    Achievement,
    UserAchievement,
)
from apps.ratings.serializers import (
    UserRatingSerializer,
    RatingHistorySerializer,
    LeaderboardSerializer,
    LeaderboardListSerializer,
    LeaderboardEntrySerializer,
    AchievementSerializer,
    UserAchievementSerializer,
)


class UserRatingViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for UserRating model."""

    queryset = UserRating.objects.select_related("user", "course", "olympiad")
    serializer_class = UserRatingSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["rating_type", "course", "olympiad", "school", "class_name"]
    ordering_fields = ["rating_value", "max_rating", "games_played", "last_updated"]
    ordering = ["-rating_value"]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and user.role in ["teacher", "admin"]:
            return self.queryset
        return self.queryset.filter(user=user) if user.is_authenticated else self.queryset.none()

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def my_ratings(self, request):
        """Get current user ratings across all types."""
        ratings = self.get_queryset().filter(user=request.user)
        serializer = self.get_serializer(ratings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def global_rank(self, request):
        """Get current user global rank."""
        rating = UserRating.objects.filter(user=request.user, rating_type="global").first()
        if not rating:
            return Response({"rank": None, "rating": 1000})

        higher = UserRating.objects.filter(rating_type="global", rating_value__gt=rating.rating_value).count()
        return Response({"rank": higher + 1, "rating": rating.rating_value, "max_rating": rating.max_rating})


class RatingHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for RatingHistory model."""

    queryset = RatingHistory.objects.select_related("user", "related_contest", "related_submission", "related_lesson")
    serializer_class = RatingHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["rating_type", "reason"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return self.queryset
        return self.queryset.filter(user=user)


class LeaderboardViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Leaderboard model."""

    queryset = Leaderboard.objects.select_related("course", "olympiad").prefetch_related("entries__user")
    serializer_class = LeaderboardSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["rating_type", "course", "olympiad", "school", "class_name", "is_active"]
    ordering_fields = ["name", "generated_at"]
    ordering = ["rating_type", "name"]

    def get_serializer_class(self):
        if self.action == "list":
            return LeaderboardListSerializer
        return LeaderboardSerializer

    def get_queryset(self):
        return self.queryset.filter(is_active=True)

    @action(detail=True, methods=["get"])
    def top(self, request, pk=None):
        """Get top N entries for a leaderboard."""
        leaderboard = self.get_object()
        limit = int(request.query_params.get("limit", 10))
        entries = leaderboard.entries.order_by("rank")[:limit]
        serializer = LeaderboardEntrySerializer(entries, many=True, context={"request": request})
        return Response(serializer.data)


class AchievementViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Achievement model."""

    queryset = Achievement.objects.all()
    serializer_class = AchievementSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["achievement_type", "is_hidden"]
    ordering_fields = ["achievement_type", "name", "points"]
    ordering = ["achievement_type", "name"]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and user.role == "admin":
            return self.queryset
        return self.queryset.filter(is_hidden=False)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def my_achievements(self, request):
        """Get current user achievements."""
        achievements = self.get_queryset()
        serializer = self.get_serializer(achievements, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def earned(self, request):
        """Get only earned achievements."""
        earned_codes = UserAchievement.objects.filter(user=request.user).values_list("achievement__code", flat=True)
        achievements = self.get_queryset().filter(code__in=earned_codes)
        serializer = self.get_serializer(achievements, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def unearned(self, request):
        """Get unearned achievements."""
        earned_codes = UserAchievement.objects.filter(user=request.user).values_list("achievement__code", flat=True)
        achievements = self.get_queryset().exclude(code__in=earned_codes)
        serializer = self.get_serializer(achievements, many=True, context={"request": request})
        return Response(serializer.data)


class UserAchievementViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for UserAchievement model."""

    queryset = UserAchievement.objects.select_related("user", "achievement")
    serializer_class = UserAchievementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return self.queryset
        return self.queryset.filter(user=user)
