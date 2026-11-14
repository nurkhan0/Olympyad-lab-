from django.urls import path

from apps.problems.views.manage_views import ManageableProblemListCreateView
from apps.problems.views.public_views import (
    BookmarkProblemView,
    ProblemDetailView,
    ProblemListView,
)

urlpatterns = [
    path('problems/', ProblemListView.as_view(), name='problems-list'),
    # Must precede problems/<slug>/ so "manage" is not swallowed by the slug
    # converter. Access is teacher/admin only (enforced by the view).
    path('problems/manage/', ManageableProblemListCreateView.as_view(), name='problems-manage'),
    path('problems/<slug:slug>/', ProblemDetailView.as_view(), name='problems-detail'),
    path('problems/<slug:slug>/bookmark/', BookmarkProblemView.as_view(), name='problems-bookmark'),
]
