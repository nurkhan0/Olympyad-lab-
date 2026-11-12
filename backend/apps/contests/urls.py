from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ContestRegistrationView,
    ContestSubmissionListView,
    ContestViewSet,
)

router = DefaultRouter()
router.register(r'contests', ContestViewSet, basename='contest')

urlpatterns = [
    path('', include(router.urls)),
    path(
        'contests/<int:contest_id>/register/',
        ContestRegistrationView.as_view(),
        name='contest-register',
    ),
    path(
        'contests/<int:contest_id>/submissions/',
        ContestSubmissionListView.as_view(),
        name='contest-submissions',
    ),
]
