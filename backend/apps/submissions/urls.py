from django.urls import path

from .views import SubmissionDetailView, SubmissionListCreateView, TestRunView

urlpatterns = [
    path('submissions/test/', TestRunView.as_view(), name='submissions-test-run'),
    path('submissions/<int:pk>/', SubmissionDetailView.as_view(), name='submissions-detail'),
    path('submissions/', SubmissionListCreateView.as_view(), name='submissions-list-create'),
]
