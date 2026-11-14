from rest_framework import serializers

from .models import Problem, Tag, TestCase, UserProblemStatus


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ('id', 'name', 'slug')
        read_only_fields = fields


class TagListField(serializers.Field):
    def to_representation(self, value):
        return TagSerializer(value.all(), many=True).data

    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError('Expected a list of tag names.')
        return [str(item).strip() for item in data if str(item).strip()]


class AdminProblemListSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Problem
        fields = (
            'id', 'slug', 'title', 'difficulty', 'status', 'solver_count',
            'tags', 'created_at',
        )
        read_only_fields = fields


class AdminProblemDetailSerializer(AdminProblemListSerializer):
    tags = TagListField(required=False)

    class Meta(AdminProblemListSerializer.Meta):
        fields = AdminProblemListSerializer.Meta.fields + (
            'time_ms', 'memory_mb', 'statement', 'statement_html',
        )
        read_only_fields = (
            'id', 'slug', 'statement_html', 'solver_count', 'created_at', 'status',
        )

    def _set_tags(self, problem, tag_names):
        tags = []
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(name=name)
            tags.append(tag)
        problem.tags.set(tags)

    def create(self, validated_data):
        tag_names = validated_data.pop('tags', [])
        validated_data['author'] = self.context['request'].user
        problem = Problem.objects.create(**validated_data)
        if tag_names:
            self._set_tags(problem, tag_names)
        return problem

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tags', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tag_names is not None:
            self._set_tags(instance, tag_names)
        return instance


class ManageableProblemSerializer(serializers.ModelSerializer):
    """Problem row for teachers/admins picking problems for a contest.

    Unlike the public list this also exposes drafts the caller may use, and
    tells the client whether the row belongs to the caller.
    """

    tags = TagSerializer(many=True, read_only=True)
    is_author = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = (
            'id', 'slug', 'title', 'difficulty', 'status', 'visibility', 'solver_count',
            'tags', 'is_author', 'created_at',
        )
        read_only_fields = fields

    def get_is_author(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and obj.author_id == user.pk)


class ManageableProblemCreateSerializer(AdminProblemDetailSerializer):
    """Create a problem from the teacher/admin "manage problems" endpoint.

    Teachers always create drafts (tests are reviewed before publishing);
    admins may pass ``status`` to publish immediately.
    """

    status = serializers.ChoiceField(choices=Problem.STATUS_CHOICES, required=False)

    class Meta(AdminProblemDetailSerializer.Meta):
        read_only_fields = (
            'id', 'slug', 'statement_html', 'solver_count', 'created_at',
        )

    def validate(self, attrs):
        request = self.context.get('request')
        role = getattr(getattr(request, 'user', None), 'role', None)
        if role != 'admin':
            attrs['status'] = 'draft'
        return attrs

    def create(self, validated_data):
        validated_data.setdefault('status', 'draft')
        return super().create(validated_data)


class TestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = ('id', 'input', 'expected_output', 'is_sample', 'order', 'created_at')
        read_only_fields = ('id', 'created_at')


class SampleTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = ('input', 'expected_output')
        read_only_fields = fields


class PublicProblemListSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    user_status = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = ('id', 'slug', 'title', 'difficulty', 'tags', 'solver_count', 'user_status')
        read_only_fields = fields

    def get_user_status(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            ups = UserProblemStatus.objects.filter(user=request.user, problem=obj).first()
            return ups.status if ups else None
        return None


class PublicProblemDetailSerializer(PublicProblemListSerializer):
    sample_test_cases = serializers.SerializerMethodField()

    class Meta(PublicProblemListSerializer.Meta):
        fields = PublicProblemListSerializer.Meta.fields + (
            'id', 'statement_html', 'time_ms', 'memory_mb', 'sample_test_cases',
        )
        read_only_fields = fields

    def get_sample_test_cases(self, obj):
        qs = obj.test_cases.filter(is_sample=True).order_by('order')
        return SampleTestSerializer(qs, many=True).data
