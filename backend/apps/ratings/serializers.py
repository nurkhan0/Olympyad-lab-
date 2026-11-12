from rest_framework import serializers
from django.contrib.auth import get_user_model

from apps.ratings.models import (
    UserRating,
    RatingHistory,
    Leaderboard,
    LeaderboardEntry,
    Achievement,
    UserAchievement,
)

User = get_user_model()


class UserRatingSerializer(serializers.ModelSerializer):
    user_handle = serializers.CharField(source="user.handle", read_only=True)
    user_avatar = serializers.URLField(source="user.avatar_url", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    olympiad_title = serializers.CharField(source="olympiad.title", read_only=True)

    class Meta:
        model = UserRating
        fields = [
            "id",
            "user",
            "user_handle",
            "user_avatar",
            "rating_type",
            "rating_value",
            "max_rating",
            "games_played",
            "wins",
            "losses",
            "draws",
            "course",
            "course_title",
            "olympiad",
            "olympiad_title",
            "school",
            "class_name",
            "period_start",
            "period_end",
            "last_updated",
        ]
        read_only_fields = ["id", "user", "last_updated"]


class RatingHistorySerializer(serializers.ModelSerializer):
    user_handle = serializers.CharField(source="user.handle", read_only=True)

    class Meta:
        model = RatingHistory
        fields = [
            "id",
            "user",
            "user_handle",
            "rating_type",
            "old_rating",
            "new_rating",
            "change",
            "reason",
            "related_contest",
            "related_submission",
            "related_lesson",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    user_handle = serializers.CharField(source="user.handle", read_only=True)
    user_avatar = serializers.URLField(source="user.avatar_url", read_only=True)

    class Meta:
        model = LeaderboardEntry
        fields = [
            "id",
            "user",
            "user_handle",
            "user_avatar",
            "rank",
            "rating_value",
            "additional_data",
        ]
        read_only_fields = ["id"]


class LeaderboardSerializer(serializers.ModelSerializer):
    entries = LeaderboardEntrySerializer(many=True, read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    olympiad_title = serializers.CharField(source="olympiad.title", read_only=True)

    class Meta:
        model = Leaderboard
        fields = [
            "id",
            "rating_type",
            "name",
            "course",
            "course_title",
            "olympiad",
            "olympiad_title",
            "school",
            "class_name",
            "period_start",
            "period_end",
            "entries",
            "snapshot_data",
            "generated_at",
            "is_active",
        ]
        read_only_fields = ["id", "generated_at"]


class LeaderboardListSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)
    olympiad_title = serializers.CharField(source="olympiad.title", read_only=True)
    entry_count = serializers.IntegerField(source="entries.count", read_only=True)

    class Meta:
        model = Leaderboard
        fields = [
            "id",
            "rating_type",
            "name",
            "course",
            "course_title",
            "olympiad",
            "olympiad_title",
            "school",
            "class_name",
            "period_start",
            "period_end",
            "entry_count",
            "generated_at",
            "is_active",
        ]


class AchievementSerializer(serializers.ModelSerializer):
    earned = serializers.SerializerMethodField()
    earned_at = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Achievement
        fields = [
            "id",
            "code",
            "name",
            "description",
            "achievement_type",
            "icon",
            "criteria",
            "is_hidden",
            "points",
            "earned",
            "earned_at",
            "progress",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_earned(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.user_achievements.filter(user=request.user).exists()
        return False

    def get_earned_at(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            ua = obj.user_achievements.filter(user=request.user).first()
            return ua.earned_at if ua else None
        return None

    def get_progress(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            ua = obj.user_achievements.filter(user=request.user).first()
            return ua.progress if ua else {}
        return {}


class UserAchievementSerializer(serializers.ModelSerializer):
    achievement = AchievementSerializer(read_only=True)

    class Meta:
        model = UserAchievement
        fields = [
            "id",
            "achievement",
            "earned_at",
            "progress",
            "is_notified",
        ]
        read_only_fields = ["id", "earned_at"]
