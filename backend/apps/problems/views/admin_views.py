from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.authentication import BearerTokenAuthentication

from ..models import Problem
from ..permissions import IsAdminUser
from ..serializers import AdminProblemDetailSerializer, AdminProblemListSerializer


class AdminProblemPagination(PageNumberPagination):
    page_size = 20


class AdminProblemListCreateView(ListCreateAPIView):
    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [IsAdminUser]
    queryset = Problem.objects.all().prefetch_related('tags')
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status', 'difficulty']
    search_fields = ['title']
    pagination_class = AdminProblemPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminProblemDetailSerializer
        return AdminProblemListSerializer


class AdminProblemDetailView(RetrieveUpdateDestroyAPIView):
    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [IsAdminUser]
    queryset = Problem.objects.all().prefetch_related('tags')
    lookup_field = 'slug'
    serializer_class = AdminProblemDetailSerializer


class AdminProblemStatusView(APIView):
    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [IsAdminUser]
    target_status = None

    def post(self, request, slug):
        problem = get_object_or_404(Problem, slug=slug)
        problem.status = self.target_status
        problem.save(update_fields=['status', 'updated_at'])
        return Response({'slug': problem.slug, 'status': problem.status})


class AdminPublishView(AdminProblemStatusView):
    target_status = 'published'


class AdminDraftView(AdminProblemStatusView):
    target_status = 'draft'
