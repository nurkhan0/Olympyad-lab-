from django.core.cache import cache
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.problems.models import Problem
from apps.users.authentication import BearerTokenAuthentication

from .models import Submission
from .runner import run_sample_tests
from .serializers import (
    SubmissionCreateSerializer,
    SubmissionDetailSerializer,
    SubmissionListSerializer,
    TestRunSerializer,
)

class SubmissionPagination(PageNumberPagination):
    page_size = 20


class SubmissionListCreateView(APIView):
    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Submission.objects.filter(user=request.user).select_related('problem')
        problem_id = request.query_params.get('problem_id')
        if problem_id:
            queryset = queryset.filter(problem_id=problem_id)
        language = request.query_params.get('language')
        if language:
            queryset = queryset.filter(language=language)
        paginator = SubmissionPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = SubmissionListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = SubmissionCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        submission = serializer.save(user=request.user, status='pending')
        output = SubmissionDetailSerializer(submission)
        return Response(output.data, status=status.HTTP_201_CREATED)


class SubmissionDetailView(RetrieveAPIView):
    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionDetailSerializer

    def get_queryset(self):
        return Submission.objects.select_related('problem', 'user')

    def get_object(self):
        submission = super().get_object()
        user = self.request.user
        if submission.user_id != user.pk and not user.is_staff:
            raise PermissionDenied('You do not have permission to view this submission.')
        return submission


class TestRunView(APIView):
    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        cache_key = f'submission_test_run:{request.user.pk}'
        if cache.get(cache_key):
            return Response(
                {'detail': 'Rate limit: one test run per 10 seconds.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        serializer = TestRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        problem = get_object_or_404(
            Problem,
            pk=serializer.validated_data['problem_id'],
            status='published',
        )
        results = run_sample_tests(
            problem=problem,
            code=serializer.validated_data['code'],
            language=serializer.validated_data['language'],
            timeout=5.0,
        )
        cache.set(cache_key, True, timeout=10)
        return Response({'results': results})
