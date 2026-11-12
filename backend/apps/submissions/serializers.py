from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.contests.models import Contest, ContestProblem, ContestRegistration
from .models import Submission


class SubmissionCreateSerializer(serializers.ModelSerializer):
    contest_id = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = Submission
        fields = ('problem', 'code', 'language', 'contest_id')

    def validate(self, attrs):
        request = self.context['request']
        user = request.user
        problem = attrs['problem']
        contest_id = attrs.get('contest_id')

        # Duplicate check (same code within 1 second)
        one_second_ago = timezone.now() - timedelta(seconds=1)
        duplicate = Submission.objects.filter(
            user=user,
            problem=problem,
            code=attrs['code'],
            created_at__gte=one_second_ago,
        ).exists()
        if duplicate:
            raise serializers.ValidationError(
                'Duplicate submission: same code was submitted within the last second.',
            )

        if contest_id:
            try:
                contest = Contest.objects.get(pk=contest_id)
            except Contest.DoesNotExist:
                raise serializers.ValidationError(
                    {'contest_id': 'Contest not found.'}
                )

            # Contest must be published
            if not contest.is_published:
                raise serializers.ValidationError(
                    {'contest_id': 'This contest is not published.'}
                )

            # Contest must be running
            now = timezone.now()
            if not contest.is_running:
                if now < contest.start_time:
                    raise serializers.ValidationError(
                        {'contest_id': 'Contest has not started yet.'}
                    )
                else:
                    raise serializers.ValidationError(
                        {'contest_id': 'Contest has already ended.'}
                    )

            # User must be registered
            if not ContestRegistration.objects.filter(contest=contest, user=user).exists():
                raise serializers.ValidationError(
                    {'contest_id': 'You are not registered for this contest.'}
                )

            # Problem must belong to the contest
            if not ContestProblem.objects.filter(contest=contest, problem=problem).exists():
                raise serializers.ValidationError(
                    {'problem': 'This problem does not belong to the contest.'}
                )

            attrs['contest'] = contest

        return attrs

    def create(self, validated_data):
        validated_data.pop('contest_id', None)
        return super().create(validated_data)


class SubmissionListSerializer(serializers.ModelSerializer):
    problem_title = serializers.CharField(source='problem.title', read_only=True)
    problem_slug = serializers.CharField(source='problem.slug', read_only=True)

    class Meta:
        model = Submission
        fields = (
            'id', 'problem', 'problem_title', 'problem_slug', 'language', 'status', 'verdict',
            'time_ms', 'memory_kb', 'created_at',
        )
        read_only_fields = fields


class SubmissionDetailSerializer(serializers.ModelSerializer):
    problem_title = serializers.CharField(source='problem.title', read_only=True)
    problem_slug = serializers.CharField(source='problem.slug', read_only=True)

    class Meta:
        model = Submission
        fields = (
            'id', 'user', 'problem', 'problem_title', 'problem_slug', 'code', 'language',
            'status', 'verdict', 'time_ms', 'memory_kb', 'created_at',
        )
        read_only_fields = (
            'id', 'user', 'status', 'verdict', 'time_ms', 'memory_kb', 'created_at',
        )


class TestRunSerializer(serializers.Serializer):
    problem_id = serializers.UUIDField()
    code = serializers.CharField()
    language = serializers.ChoiceField(choices=['python', 'cpp', 'java'])
