from django.utils import timezone
from rest_framework import serializers

from apps.problems.serializers import PublicProblemListSerializer
from .models import Contest, ContestProblem, ContestRegistration


class ContestProblemSerializer(serializers.ModelSerializer):
    """Serializer for contest problems (teacher/admin management)."""

    problem_title = serializers.CharField(source='problem.title', read_only=True)
    problem_slug = serializers.CharField(source='problem.slug', read_only=True)
    problem_difficulty = serializers.CharField(source='problem.difficulty', read_only=True)

    class Meta:
        model = ContestProblem
        fields = (
            'id', 'problem', 'problem_title', 'problem_slug', 'problem_difficulty',
            'label', 'order', 'points',
        )


class ContestListSerializer(serializers.ModelSerializer):
    """Serializer for contest list views."""

    created_by_handle = serializers.CharField(source='created_by.handle', read_only=True)
    problem_count = serializers.IntegerField(read_only=True)
    participant_count = serializers.IntegerField(read_only=True)
    is_registration_open = serializers.BooleanField(read_only=True)
    is_running = serializers.BooleanField(read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    end_time = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Contest
        fields = (
            'id', 'title', 'description', 'contest_type',
            'start_time', 'duration_minutes', 'end_time',
            'registration_start', 'registration_end',
            'is_public', 'is_published', 'is_rated',
            'is_registration_open', 'is_running', 'is_upcoming',
            'problem_count', 'participant_count', 'max_participants',
            'created_by_handle', 'created_at',
        )
        read_only_fields = fields


class ContestDetailSerializer(serializers.ModelSerializer):
    """Serializer for contest detail, including problems."""

    created_by_handle = serializers.CharField(source='created_by.handle', read_only=True)
    problems = ContestProblemSerializer(source='contest_problems', many=True, read_only=True)
    problem_count = serializers.IntegerField(read_only=True)
    participant_count = serializers.IntegerField(read_only=True)
    is_registration_open = serializers.BooleanField(read_only=True)
    is_running = serializers.BooleanField(read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    end_time = serializers.DateTimeField(read_only=True)
    # Per-user registration state: students cannot read the full registrations
    # list (teacher/admin only), so the detail payload must answer "am I in?".
    is_registered = serializers.SerializerMethodField()

    class Meta:
        model = Contest
        fields = (
            'id', 'title', 'description', 'rules', 'contest_type',
            'start_time', 'duration_minutes', 'end_time',
            'registration_start', 'registration_end',
            'is_public', 'is_published', 'is_rated',
            'is_registration_open', 'is_running', 'is_upcoming',
            'is_registered',
            'problem_count', 'participant_count', 'max_participants',
            'problems', 'created_by_handle', 'created_at',
        )
        read_only_fields = fields

    def get_is_registered(self, obj) -> bool:
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            return False
        return obj.registrations.filter(user=user).exists()


class ContestCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating contests (teacher/admin only)."""

    class Meta:
        model = Contest
        fields = (
            'title', 'description', 'rules', 'contest_type',
            'start_time', 'duration_minutes',
            'registration_start', 'registration_end',
            'is_public', 'is_published', 'is_rated',
            'max_participants',
        )

    def validate(self, attrs):
        start_time = attrs.get('start_time')
        registration_start = attrs.get('registration_start')
        registration_end = attrs.get('registration_end')

        if registration_start and start_time and registration_start > start_time:
            raise serializers.ValidationError(
                {'registration_start': 'Registration start must be before contest start time.'}
            )

        if registration_end and registration_start and registration_end < registration_start:
            raise serializers.ValidationError(
                {'registration_end': 'Registration end must be after registration start.'}
            )

        if registration_end and start_time and registration_end > start_time:
            raise serializers.ValidationError(
                {'registration_end': 'Registration end must be before contest start time.'}
            )

        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class ContestRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for contest registration."""

    user_handle = serializers.CharField(source='user.handle', read_only=True)

    class Meta:
        model = ContestRegistration
        fields = ('id', 'contest', 'user', 'user_handle', 'registered_at')
        read_only_fields = ('id', 'registered_at')

    def validate(self, attrs):
        contest = attrs['contest']
        user = attrs['user']

        # Registration window validation
        now = timezone.now()
        if contest.registration_start and now < contest.registration_start:
            raise serializers.ValidationError('Registration has not opened yet.')
        if contest.registration_end and now > contest.registration_end:
            raise serializers.ValidationError('Registration has already closed.')

        # Capacity validation
        if contest.max_participants:
            current_count = contest.registrations.count()
            if current_count >= contest.max_participants:
                raise serializers.ValidationError('Contest has reached maximum capacity.')

        # Duplicate prevention
        if ContestRegistration.objects.filter(contest=contest, user=user).exists():
            raise serializers.ValidationError('You are already registered for this contest.')

        # Student eligibility
        if user.role not in ('student', 'teacher', 'admin'):
            raise serializers.ValidationError('Only registered users can participate in contests.')

        return attrs


class ContestSubmissionSerializer(serializers.Serializer):
    """Serializer for contest submissions."""

    problem_id = serializers.UUIDField()
    code = serializers.CharField()
    language = serializers.ChoiceField(choices=['python', 'cpp', 'java'])

    def validate_problem_id(self, value):
        from apps.problems.models import Problem
        try:
            problem = Problem.objects.get(pk=value)
        except Problem.DoesNotExist:
            raise serializers.ValidationError('Problem not found.')
        return value


class ContestStandingSerializer(serializers.Serializer):
    """Serializer for contest standings."""

    rank = serializers.IntegerField()
    user_id = serializers.UUIDField()
    handle = serializers.CharField()
    total_score = serializers.IntegerField()
    solved_count = serializers.IntegerField()
    penalty_time = serializers.IntegerField()
    problems = serializers.ListField()

