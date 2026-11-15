from django.contrib import admin

from .models import (
    Achievement,
    Leaderboard,
    LeaderboardEntry,
    RatingHistory,
    UserAchievement,
    UserRating,
)


class LeaderboardEntryInline(admin.TabularInline):
    model = LeaderboardEntry
    extra = 0
    autocomplete_fields = ('user',)
    ordering = ('rank',)


@admin.register(UserRating)
class UserRatingAdmin(admin.ModelAdmin):
    list_display = ('user', 'rating_type', 'rating_value', 'max_rating',
                    'games_played', 'wins', 'losses', 'last_updated')
    list_filter = ('rating_type',)
    search_fields = ('user__email', 'user__handle')
    autocomplete_fields = ('user',)
    readonly_fields = ('last_updated',)


@admin.register(RatingHistory)
class RatingHistoryAdmin(admin.ModelAdmin):
    list_display = ('user', 'rating_type', 'old_rating', 'new_rating', 'change',
                    'reason', 'created_at')
    list_filter = ('rating_type', 'reason')
    search_fields = ('user__email', 'user__handle')
    autocomplete_fields = ('user', 'related_contest', 'related_submission')
    readonly_fields = ('created_at',)


@admin.register(Leaderboard)
class LeaderboardAdmin(admin.ModelAdmin):
    list_display = ('name', 'rating_type', 'school', 'class_name', 'is_active', 'generated_at')
    list_filter = ('rating_type', 'is_active')
    search_fields = ('name', 'school')
    readonly_fields = ('generated_at',)
    inlines = [LeaderboardEntryInline]


@admin.register(LeaderboardEntry)
class LeaderboardEntryAdmin(admin.ModelAdmin):
    list_display = ('leaderboard', 'rank', 'user', 'rating_value')
    list_filter = ('leaderboard',)
    search_fields = ('user__email', 'user__handle', 'leaderboard__name')
    autocomplete_fields = ('leaderboard', 'user')


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'achievement_type', 'points', 'is_hidden')
    list_filter = ('achievement_type', 'is_hidden')
    search_fields = ('name', 'code')
    prepopulated_fields = {'code': ('name',)}


@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ('user', 'achievement', 'earned_at', 'is_notified')
    list_filter = ('is_notified', 'achievement')
    search_fields = ('user__email', 'user__handle', 'achievement__name')
    autocomplete_fields = ('user', 'achievement')
    readonly_fields = ('earned_at',)