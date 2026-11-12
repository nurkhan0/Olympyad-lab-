from django.urls import path

from apps.problems.views.public_views import (
    BookmarkProblemView,
    ProblemDetailView,
    ProblemListView,
)

urlpatterns = [
    path('problems/', ProblemListView.as_view(), name='problems-list'),
    path('problems/<slug:slug>/', ProblemDetailView.as_view(), name='problems-detail'),
    path('problems/<slug:slug>/bookmark/', BookmarkProblemView.as_view(), name='problems-bookmark'),
]
