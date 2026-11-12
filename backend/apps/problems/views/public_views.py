from django.shortcuts import get_object_or_404
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.authentication import BearerTokenAuthentication

from ..filters import ProblemFilter
from ..models import Problem, UserProblemStatus
from ..serializers import PublicProblemDetailSerializer, PublicProblemListSerializer


class PublicProblemPagination(PageNumberPagination):
    page_size = 20


class ProblemListView(ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = [BearerTokenAuthentication]
    queryset = Problem.objects.filter(status='published').prefetch_related('tags').distinct()
    serializer_class = PublicProblemListSerializer
    filterset_class = ProblemFilter
    pagination_class = PublicProblemPagination

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class ProblemDetailView(RetrieveAPIView):
    permission_classes = [AllowAny]
    authentication_classes = [BearerTokenAuthentication]
    lookup_field = 'slug'
    queryset = Problem.objects.filter(status='published').prefetch_related('tags', 'test_cases')
    serializer_class = PublicProblemDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class BookmarkProblemView(APIView):
    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        problem = get_object_or_404(Problem, slug=slug, status='published')
        ups, created = UserProblemStatus.objects.get_or_create(
            user=request.user,
            problem=problem,
            defaults={'status': 'todo'},
        )
        if not created and ups.status == 'todo':
            ups.delete()
            return Response({'bookmarked': False})
        if not created:
            ups.status = 'todo'
            ups.save()
        return Response({'bookmarked': True})
