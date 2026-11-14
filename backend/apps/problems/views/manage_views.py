from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from rest_framework.generics import ListCreateAPIView
from rest_framework.pagination import PageNumberPagination

from apps.users.authentication import BearerTokenAuthentication

from ..models import Problem
from ..permissions import IsTeacherOrAdmin
from ..serializers import (
    ManageableProblemCreateSerializer,
    ManageableProblemSerializer,
)


class ManageableProblemPagination(PageNumberPagination):
    page_size = 20


class ManageableProblemListCreateView(ListCreateAPIView):
    """List/create problems a teacher or admin may use in a contest.

    GET returns every published problem plus the caller's own drafts, so a
    teacher can pick a problem instead of pasting a raw UUID. Admins see all
    problems, including other authors' drafts.

    POST creates a problem authored by the caller. Teachers always get a draft;
    admins may publish immediately via ``status``.
    """

    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status', 'difficulty']
    search_fields = ['title', 'slug']
    pagination_class = ManageableProblemPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ManageableProblemCreateSerializer
        return ManageableProblemSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Problem.objects.all().prefetch_related('tags')
        if user.role != 'admin':
            qs = qs.filter(Q(status='published') | Q(author=user))
        return qs.distinct().order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context