import io
import zipfile
from os.path import splitext

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.authentication import BearerTokenAuthentication

from ..models import Problem, TestCase
from ..permissions import IsAdminUser
from ..serializers import TestCaseSerializer

MAX_UPLOAD_SIZE = 10 * 1024 * 1024


class ProblemTestCaseMixin:
    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [IsAdminUser]

    def get_problem(self):
        return get_object_or_404(Problem, slug=self.kwargs['slug'])


class TestCaseListCreateView(ProblemTestCaseMixin, ListCreateAPIView):
    serializer_class = TestCaseSerializer

    def get_queryset(self):
        return self.get_problem().test_cases.all()

    def perform_create(self, serializer):
        serializer.save(problem=self.get_problem())


class TestCaseDetailView(ProblemTestCaseMixin, RetrieveUpdateDestroyAPIView):
    serializer_class = TestCaseSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        return TestCase.objects.filter(problem__slug=self.kwargs['slug'])


class TestCaseUploadView(ProblemTestCaseMixin, APIView):
    def post(self, request, slug):
        if 'file' not in request.FILES:
            return Response({'detail': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        uploaded = request.FILES['file']

        if uploaded.size > MAX_UPLOAD_SIZE:
            return Response(
                {'detail': 'File exceeds maximum size of 10MB'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not uploaded.name.lower().endswith('.zip'):
            return Response({'detail': 'File must be .zip'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            zf = zipfile.ZipFile(io.BytesIO(uploaded.read()))
        except zipfile.BadZipFile:
            return Response({'detail': 'Invalid ZIP file'}, status=status.HTTP_400_BAD_REQUEST)

        pairs = {}
        with zf:
            for name in zf.namelist():
                if name.endswith('/'):
                    continue
                stem, ext = splitext(name)
                ext = ext.lower()
                if ext == '.in':
                    pairs.setdefault(stem, {})['in'] = zf.read(name).decode()
                elif ext == '.out':
                    pairs.setdefault(stem, {})['out'] = zf.read(name).decode()

        problem = self.get_problem()
        test_cases = []
        errors = []

        for idx, (stem, pair) in enumerate(pairs.items()):
            if 'in' in pair and 'out' in pair:
                test_cases.append(
                    TestCase(
                        problem=problem,
                        input=pair['in'],
                        expected_output=pair['out'],
                        is_sample=stem.startswith('sample_'),
                        order=idx,
                    ),
                )
            else:
                errors.append(stem)

        if not test_cases:
            return Response(
                {'detail': 'No valid .in/.out pairs found'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        TestCase.objects.bulk_create(test_cases)
        samples = sum(1 for tc in test_cases if tc.is_sample)

        return Response({
            'created': len(test_cases),
            'samples': samples,
            'errors': errors,
        })
