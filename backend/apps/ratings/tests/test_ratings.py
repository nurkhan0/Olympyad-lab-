import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    UserRatingFactory,
    RatingHistoryFactory,
    LeaderboardFactory,
    LeaderboardEntryFactory,
    AchievementFactory,
    UserAchievementFactory,
)
from apps.users.factories import UserFactory, AdminUserFactory


def auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def results(response):
    """Return paginated results or raw data depending on response shape."""
    if isinstance(response.data, dict) and "results" in response.data:
        return response.data["results"]
    return response.data


@pytest.mark.django_db
class TestUserRatingViewSet:
    list_url = "rating-list"

    def test_list_requires_auth(self):
        # IsAuthenticatedOrReadOnly: unauthenticated GET returns 200 with empty results
        client = APIClient()
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(results(response)) == 0

    def test_list_returns_only_user_ratings(self):
        user1 = UserFactory()
        user2 = UserFactory()
        UserRatingFactory(user=user1, rating_type="global", rating_value=1500)
        UserRatingFactory(user=user1, rating_type="weekly", rating_value=1200)
        UserRatingFactory(user=user2, rating_type="global", rating_value=2000)
        client = auth_client(user1)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        ratings = results(response)
        assert len(ratings) == 2
        assert all(str(r["user"]) == str(user1.id) for r in ratings)

    def test_list_filter_by_rating_type(self):
        user = UserFactory()
        UserRatingFactory(user=user, rating_type="global", rating_value=1500)
        UserRatingFactory(user=user, rating_type="weekly", rating_value=1200)
        client = auth_client(user)
        url = reverse(self.list_url)
        response = client.get(url, {"rating_type": "weekly"})
        assert response.status_code == status.HTTP_200_OK
        ratings = results(response)
        assert len(ratings) == 1
        assert ratings[0]["rating_type"] == "weekly"

    def test_my_ratings(self):
        user = UserFactory()
        UserRatingFactory(user=user, rating_type="global", rating_value=1500)
        UserRatingFactory(user=user, rating_type="weekly", rating_value=1200)
        other_user = UserFactory()
        UserRatingFactory(user=other_user, rating_type="global", rating_value=2000)
        client = auth_client(user)
        url = reverse("rating-my-ratings")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_global_rank(self):
        user = UserFactory()
        UserRatingFactory(user=user, rating_type="global", rating_value=1500)
        UserRatingFactory(
            user=UserFactory(), rating_type="global", rating_value=2000
        )
        UserRatingFactory(
            user=UserFactory(), rating_type="global", rating_value=1800
        )
        client = auth_client(user)
        url = reverse("rating-global-rank")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["rank"] == 3
        assert response.data["rating"] == 1500

    def test_global_rank_no_rating(self):
        user = UserFactory()
        client = auth_client(user)
        url = reverse("rating-global-rank")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["rank"] is None
        assert response.data["rating"] == 1000

    def test_admin_can_see_all_ratings(self):
        user = UserFactory()
        admin = AdminUserFactory()
        UserRatingFactory(user=user, rating_type="global", rating_value=1500)
        UserRatingFactory(user=UserFactory(), rating_type="global", rating_value=2000)
        client = auth_client(admin)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        ratings = results(response)
        assert len(ratings) == 2


@pytest.mark.django_db
class TestRatingHistoryViewSet:
    list_url = "rating-history-list"

    def test_list_requires_auth(self):
        client = APIClient()
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_returns_only_user_history(self):
        user1 = UserFactory()
        user2 = UserFactory()
        RatingHistoryFactory(user=user1, reason="contest_win")
        RatingHistoryFactory(user=user1, reason="lesson_complete")
        RatingHistoryFactory(user=user2, reason="contest_win")
        client = auth_client(user1)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        history = results(response)
        assert len(history) == 2
        assert all(str(h["user"]) == str(user1.id) for h in history)

    def test_admin_can_see_all_history(self):
        user = UserFactory()
        admin = AdminUserFactory()
        RatingHistoryFactory(user=user, reason="contest_win")
        RatingHistoryFactory(user=UserFactory(), reason="contest_win")
        client = auth_client(admin)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        history = results(response)
        assert len(history) == 2


@pytest.mark.django_db
class TestLeaderboardViewSet:
    list_url = "leaderboard-list"

    def test_list_returns_active_leaderboards(self):
        LeaderboardFactory(name="Active Board", is_active=True)
        LeaderboardFactory(name="Inactive Board", is_active=False)
        client = APIClient()
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        boards = results(response)
        assert len(boards) == 1
        assert boards[0]["name"] == "Active Board"

    def test_top_entries(self):
        leaderboard = LeaderboardFactory(name="Top Board")
        user1 = UserFactory()
        user2 = UserFactory()
        LeaderboardEntryFactory(leaderboard=leaderboard, user=user1, rank=1, rating_value=2000)
        LeaderboardEntryFactory(leaderboard=leaderboard, user=user2, rank=2, rating_value=1500)
        client = APIClient()
        url = reverse("leaderboard-top", kwargs={"pk": leaderboard.id})
        response = client.get(url, {"limit": 1})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["rank"] == 1

    def test_top_entries_404_for_nonexistent(self):
        client = APIClient()
        url = reverse("leaderboard-top", kwargs={"pk": "00000000-0000-0000-0000-000000000000"})
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestAchievementViewSet:
    list_url = "achievement-list"

    def test_list_excludes_hidden_for_non_admin(self):
        user = UserFactory()
        AchievementFactory(name="Visible", is_hidden=False)
        AchievementFactory(name="Hidden", is_hidden=True)
        client = auth_client(user)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        achs = results(response)
        assert len(achs) == 1
        assert achs[0]["name"] == "Visible"

    def test_list_includes_hidden_for_admin(self):
        admin = AdminUserFactory()
        AchievementFactory(name="Visible", is_hidden=False)
        AchievementFactory(name="Hidden", is_hidden=True)
        client = auth_client(admin)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        achs = results(response)
        assert len(achs) == 2

    def test_my_achievements_returns_all_achievements(self):
        user = UserFactory()
        AchievementFactory(name="Ach1", is_hidden=False)
        AchievementFactory(name="Ach2", is_hidden=False)
        client = auth_client(user)
        url = reverse("achievement-my-achievements")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_earned_returns_only_earned(self):
        user = UserFactory()
        ach1 = AchievementFactory(name="Earned", is_hidden=False)
        ach2 = AchievementFactory(name="Unearned", is_hidden=False)
        UserAchievementFactory(user=user, achievement=ach1)
        client = auth_client(user)
        url = reverse("achievement-earned")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["code"] == ach1.code

    def test_unearned_returns_only_unearned(self):
        user = UserFactory()
        ach1 = AchievementFactory(name="Earned", is_hidden=False)
        ach2 = AchievementFactory(name="Unearned", is_hidden=False)
        UserAchievementFactory(user=user, achievement=ach1)
        client = auth_client(user)
        url = reverse("achievement-unearned")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["code"] == ach2.code


@pytest.mark.django_db
class TestUserAchievementViewSet:
    list_url = "user-achievement-list"

    def test_list_requires_auth(self):
        client = APIClient()
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_returns_only_user_achievements(self):
        user1 = UserFactory()
        user2 = UserFactory()
        ach = AchievementFactory(name="Test Ach")
        UserAchievementFactory(user=user1, achievement=ach)
        UserAchievementFactory(user=user2, achievement=ach)
        client = auth_client(user1)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        user_achievements = results(response)
        assert len(user_achievements) == 1
        assert user_achievements[0]["achievement"]["name"] == ach.name

    def test_admin_can_see_all_user_achievements(self):
        user = UserFactory()
        admin = AdminUserFactory()
        ach = AchievementFactory(name="Test Ach")
        UserAchievementFactory(user=user, achievement=ach)
        UserAchievementFactory(user=UserFactory(), achievement=ach)
        client = auth_client(admin)
        url = reverse(self.list_url)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        user_achievements = results(response)
        assert len(user_achievements) == 2
