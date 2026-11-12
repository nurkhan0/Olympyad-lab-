from django.urls import path

from apps.users.views.auth_views import LoginView, LogoutView, RefreshView, RegisterView
from apps.users.views.profile_views import MeView, ProfileView

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('users/me/', MeView.as_view(), name='users-me'),
    path('users/<str:handle>/', ProfileView.as_view(), name='users-profile'),
]
