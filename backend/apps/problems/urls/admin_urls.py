from django.urls import path

from apps.problems.views.admin_views import (
    AdminDraftView,
    AdminProblemDetailView,
    AdminProblemListCreateView,
    AdminPublishView,
)
from apps.problems.views.tests_views import (
    TestCaseDetailView,
    TestCaseListCreateView,
    TestCaseUploadView,
)

urlpatterns = [
    path('admin/problems/', AdminProblemListCreateView.as_view(), name='admin-problems-list'),
    path('admin/problems/<slug:slug>/', AdminProblemDetailView.as_view(), name='admin-problems-detail'),
    path('admin/problems/<slug:slug>/publish/', AdminPublishView.as_view(), name='admin-problems-publish'),
    path('admin/problems/<slug:slug>/draft/', AdminDraftView.as_view(), name='admin-problems-draft'),
    path('admin/problems/<slug:slug>/tests/', TestCaseListCreateView.as_view(), name='admin-tests-list'),
    path('admin/problems/<slug:slug>/tests/upload/', TestCaseUploadView.as_view(), name='admin-tests-upload'),
    path('admin/problems/<slug:slug>/tests/<uuid:pk>/', TestCaseDetailView.as_view(), name='admin-tests-detail'),
]
