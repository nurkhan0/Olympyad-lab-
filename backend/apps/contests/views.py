from django.core.cache import cache
from django.db.models import Count, Max, Min, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.problems.models import Problem
from apps.problems.serializers import PublicProblemListSerializer
from apps.submissions.models import Submission

from .models import Contest, ContestProblem, ContestRegistration
from .permissions import CanRegisterForContest, IsContestCreatorOrAdmin, IsTeacherOrAdmin
from .serializers import (
    ContestCreateUpdateSerializer,
    ContestDetailSerializer,
    ContestListSerializer,
    ContestProblemSerializer,
    ContestRegistrationSerializer,
    ContestStandingSerializer,
    ContestSubmissionSerializer,
)


class ContestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Contest model.

    - List: public contests (filtered by upcoming/active/completed via ?status=)
    - Create: teachers and admins only
    - Retrieve: published contests (public), all for teacher/admin
    - Update/Delete: contest creator or admin only
    - Publish/Unpublish: contest creator or admin only
    """

    queryset = Contest.objects.select_related('created_by').prefetch_related(
        'contest_problems__problem', 'registrations'
    )
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ContestCreateUpdateSerializer
        if self.action == 'retrieve':
            return ContestDetailSerializer
        return ContestListSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy',
                           'add_problem', 'remove_problem', 'publish', 'unpublish',
                           'registrations']:
            return [IsTeacherOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        role = getattr(user, 'role', None)

        # For detail-level actions with object-level permission checks
        # (publish, unpublish, add_problem, remove_problem, registrations, standings),
        # do not filter by visibility — let object-level permissions handle access control.
        # This ensures get_object() finds the contest so permission checks return 403
        # instead of 404 when a user tries to modify someone else's contest.
        if self.action in ['publish', 'unpublish', 'add_problem', 'remove_problem',
                           'registrations', 'standings']:
            return qs

        # For list and retrieve, apply visibility filtering
        if not (user.is_authenticated and role in ('teacher', 'admin')):
            qs = qs.filter(is_published=True, is_public=True)
        # Teachers see published contests + their own unpublished contests
        elif role == 'teacher':
            qs = qs.filter(
                Q(is_published=True, is_public=True) |
                Q(created_by_id=user.pk)
            )
        # Admins see all contests

        # Filter by status: upcoming, active, completed
        status_param = self.request.query_params.get('status')
        now = timezone.now()
        if status_param == 'upcoming':
            qs = qs.filter(start_time__gt=now)
        elif status_param == 'active':
            qs = qs.filter(start_time__lte=now)
        elif status_param == 'completed':
            pass  # filtered in list() since end_time is a property

        # Ordering
        ordering = self.request.query_params.get('ordering', '-start_time')
        qs = qs.order_by(ordering)

        return qs

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        status_param = request.query_params.get('status')
        now = timezone.now()

        # For 'completed', filter in Python since end_time is a property
        if status_param == 'completed':
            qs = [c for c in qs if c.end_time < now]
        elif status_param == 'active':
            qs = [c for c in qs if c.is_running]

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """Create a contest and return the full detail payload.

        ContestCreateUpdateSerializer has no 'id' field, so responding with it
        leaves clients unable to address the created contest. Respond with
        ContestDetailSerializer instead (additive change: extra fields).
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        detail = ContestDetailSerializer(serializer.instance, context=self.get_serializer_context())
        return Response(detail.data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == 'admin' or instance.created_by_id == user.pk:
            instance.delete()
        else:
            raise PermissionDenied('You do not have permission to delete this contest.')

    @action(detail=True, methods=['post'], permission_classes=[IsTeacherOrAdmin])
    def publish(self, request, pk=None):
        """Publish a contest (make it visible to students)."""
        contest = self.get_object()
        user = request.user
        if user.role != 'admin' and contest.created_by_id != user.pk:
            raise PermissionDenied('Only the contest creator or an admin can publish.')
        contest.is_published = True
        contest.save(update_fields=['is_published'])
        return Response({'status': 'published'})

    @action(detail=True, methods=['post'], permission_classes=[IsTeacherOrAdmin])
    def unpublish(self, request, pk=None):
        """Unpublish a contest (hide it from students)."""
        contest = self.get_object()
        user = request.user
        if user.role != 'admin' and contest.created_by_id != user.pk:
            raise PermissionDenied('Only the contest creator or an admin can unpublish.')
        contest.is_published = False
        contest.save(update_fields=['is_published'])
        return Response({'status': 'unpublished'})

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def problems(self, request, pk=None):
        """List problems in this contest."""
        contest = self.get_object()
        problems = contest.contest_problems.select_related('problem').all()
        serializer = ContestProblemSerializer(problems, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsTeacherOrAdmin])
    def add_problem(self, request, pk=None):
        """Add a problem to this contest."""
        contest = self.get_object()
        user = request.user
        if user.role != 'admin' and contest.created_by_id != user.pk:
            raise PermissionDenied('Only the contest creator or an admin can modify problems.')

        problem_id = request.data.get('problem')
        label = request.data.get('label')
        order = request.data.get('order')
        points = request.data.get('points', 0)

        try:
            problem = Problem.objects.get(pk=problem_id)
        except Problem.DoesNotExist:
            return Response({'error': 'Problem not found.'}, status=status.HTTP_404_NOT_FOUND)

        contest_problem, created = ContestProblem.objects.get_or_create(
            contest=contest,
            problem=problem,
            defaults={'label': label or problem.title[:5], 'order': order or 0, 'points': points},
        )
        if not created:
            return Response(
                {'error': 'Problem already in contest.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ContestProblemSerializer(contest_problem)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], permission_classes=[IsTeacherOrAdmin])
    def remove_problem(self, request, pk=None):
        """Remove a problem from this contest."""
        contest = self.get_object()
        user = request.user
        if user.role != 'admin' and contest.created_by_id != user.pk:
            raise PermissionDenied('Only the contest creator or an admin can modify problems.')

        problem_id = request.query_params.get('problem_id')
        if problem_id is None:
            problem_id = request.data.get('problem_id')
        try:
            cp = ContestProblem.objects.get(contest=contest, problem_id=problem_id)
            cp.delete()
            return Response({'status': 'removed'})
        except ContestProblem.DoesNotExist:
            return Response({'error': 'Problem not in contest.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def registrations(self, request, pk=None):
        """List registrations for this contest (teacher/admin only)."""
        contest = self.get_object()
        user = request.user
        if user.role != 'admin' and contest.created_by_id != user.pk:
            raise PermissionDenied('Only the contest creator or an admin can view registrations.')

        registrations = contest.registrations.select_related('user').all()
        data = [
            {
                'id': str(r.pk),
                'user_id': str(r.user.pk),
                'handle': r.user.handle,
                'registered_at': r.registered_at,
            }
            for r in registrations
        ]
        return Response(data)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def standings(self, request, pk=None):
        """Compute contest standings."""
        contest = self.get_object()
        standings = compute_standings(contest)
        serializer = ContestStandingSerializer(standings, many=True)
        return Response(serializer.data)


class ContestRegistrationView(APIView):
    """Register for or cancel registration in a contest."""

    permission_classes = [IsAuthenticated, CanRegisterForContest]

    def post(self, request, contest_id):
        """Register the current student for a contest."""
        contest = get_object_or_404(Contest, pk=contest_id)

        if not contest.is_published:
            return Response(
                {'error': 'This contest is not published.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ContestRegistrationSerializer(
            data={'contest': contest.pk, 'user': request.user.pk},
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        registration = serializer.save()
        return Response(
            {
                'id': str(registration.pk),
                'contest_id': str(contest.pk),
                'user_id': str(request.user.pk),
                'registered_at': registration.registered_at,
            },
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, contest_id):
        """Cancel registration for a contest."""
        contest = get_object_or_404(Contest, pk=contest_id)

        # Can only cancel before contest starts
        if contest.is_running:
            return Response(
                {'error': 'Cannot cancel registration after the contest has started.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        registration = ContestRegistration.objects.filter(
            contest=contest, user=request.user
        ).first()
        if not registration:
            return Response(
                {'error': 'Not registered for this contest.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        registration.delete()
        return Response({'status': 'cancelled'})


class ContestSubmissionListView(APIView):
    """List submissions for a contest (participants see their own, teachers see all)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, contest_id):
        contest = get_object_or_404(Contest, pk=contest_id)
        user = request.user
        role = getattr(user, 'role', None)

        qs = Submission.objects.filter(contest=contest).select_related('problem', 'user')

        # Students see only their own submissions
        if role == 'student':
            qs = qs.filter(user=user)
        # Teachers see submissions for their own contests
        elif role == 'teacher' and contest.created_by_id != user.pk:
            raise PermissionDenied('You do not have permission to view these submissions.')
        # Admins see all

        problem_id = request.query_params.get('problem_id')
        if problem_id:
            qs = qs.filter(problem_id=problem_id)

        user_id = request.query_params.get('user_id')
        if user_id and role in ('teacher', 'admin'):
            qs = qs.filter(user_id=user_id)

        # Pagination
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)
        data = [
            {
                'id': str(s.pk),
                'problem_id': str(s.problem_id),
                'problem_title': s.problem.title,
                'user_id': str(s.user_id),
                'user_handle': s.user.handle,
                'language': s.language,
                'status': s.status,
                'verdict': s.verdict,
                'time_ms': s.time_ms,
                'memory_kb': s.memory_kb,
                'created_at': s.created_at,
            }
            for s in page
        ]
        return paginator.get_paginated_response(data)


def compute_standings(contest):
    """Compute contest standings from real Submission records.

    Scoring rules (CF-style):
    - Each problem has points (from ContestProblem.points).
    - A problem is solved when the user has an AC verdict on it during the
      contest period (start_time <= created_at <= end_time).
    - Score = sum of points for solved problems.
    - Penalty = sum of (time of first AC for each solved problem) in minutes
      from contest start, plus penalty for failed attempts.
    - Failed attempts before the first AC add penalty (if configured).
    """
    from django.utils import timezone

    now = timezone.now()
    end_time = contest.end_time
    scoring_end = min(end_time, now) if contest.is_running else end_time

    # All submissions during the contest period
    submissions = Submission.objects.filter(
        contest=contest,
        status='done',
        created_at__gte=contest.start_time,
        created_at__lte=scoring_end,
    ).select_related('user', 'problem')

    # Build problem -> points mapping
    problem_points = {
        cp.problem_id: cp.points for cp in contest.contest_problems.all()
    }

    # Group by user
    user_data = {}
    for sub in submissions:
        uid = str(sub.user_id)
        if uid not in user_data:
            user_data[uid] = {
                'user_id': sub.user_id,
                'handle': sub.user.handle,
                'problems': {},
                'total_score': 0,
                'solved_count': 0,
                'penalty_time': 0,
            }

        problem_id = str(sub.problem_id)
        points = problem_points.get(sub.problem_id, 0)

        if problem_id not in user_data[uid]['problems']:
            user_data[uid]['problems'][problem_id] = {
                'problem_id': problem_id,
                'problem_title': sub.problem.title,
                'label': None,
                'points': points,
                'solved': False,
                'attempts': 0,
                'first_ac_time': None,
            }

        pdata = user_data[uid]['problems'][problem_id]

        if sub.verdict == 'AC':
            if not pdata['solved']:
                pdata['solved'] = True
                pdata['first_ac_time'] = sub.created_at
                user_data[uid]['total_score'] += points
                user_data[uid]['solved_count'] += 1
        else:
            pdata['attempts'] += 1

    # Compute penalty time
    contest_start = contest.start_time
    for uid, data in user_data.items():
        penalty = 0
        for pid, pdata in data['problems'].items():
            if pdata['solved'] and pdata['first_ac_time']:
                # Minutes from contest start to first AC
                delta = pdata['first_ac_time'] - contest_start
                penalty += int(delta.total_seconds() / 60)
                # Failed attempts penalty: 20 minutes per failed attempt (CF-style)
                penalty += pdata['attempts'] * 20
        data['penalty_time'] = penalty

    # Sort: by score desc, then penalty asc, then solved_count desc
    standings = sorted(
        user_data.values(),
        key=lambda d: (-d['total_score'], d['penalty_time'], -d['solved_count']),
    )

    # Assign ranks with tie handling
    result = []
    prev_score = None
    prev_penalty = None
    prev_solved = None
    rank = 0
    for i, data in enumerate(standings):
        if (data['total_score'], data['penalty_time'], data['solved_count']) != (
            prev_score, prev_penalty, prev_solved
        ):
            rank = i + 1
        result.append({
            'rank': rank,
            'user_id': data['user_id'],
            'handle': data['handle'],
            'total_score': data['total_score'],
            'solved_count': data['solved_count'],
            'penalty_time': data['penalty_time'],
            'problems': list(data['problems'].values()),
        })
        prev_score = data['total_score']
        prev_penalty = data['penalty_time']
        prev_solved = data['solved_count']

    return result

