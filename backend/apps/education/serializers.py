from rest_framework import serializers
from django.contrib.auth import get_user_model

from apps.education.models import (
    Category,
    Course,
    Module,
    Lesson,
    Material,
    Enrollment,
    LessonProgress,
    ProblemCourseLink,
)

User = get_user_model()


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "title", "slug", "description", "created_at"]
        read_only_fields = ["id", "slug", "created_at"]


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = [
            "id",
            "title",
            "material_type",
            "url",
            "content",
            "order",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class LessonSerializer(serializers.ModelSerializer):
    materials = MaterialSerializer(many=True, read_only=True)
    problem_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "title",
            "content",
            "content_html",
            "order",
            "estimated_minutes",
            "is_published",
            "materials",
            "problem_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "content_html", "created_at", "updated_at"]


class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)
    lesson_count = serializers.IntegerField(read_only=True, source="annotated_lesson_count")

    class Meta:
        model = Module
        fields = [
            "id",
            "title",
            "description",
            "order",
            "lessons",
            "lesson_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CourseListSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.handle", read_only=True)
    category = CategorySerializer(read_only=True)
    # Backed by queryset annotations (see CourseViewSet.get_queryset) so list
    # responses do not run per-row property queries (N+1). When accessed
    # through a nested enrollment (where the Course isn't annotated), fall
    # back to the model property.
    enrollment_count = serializers.IntegerField(read_only=True, source="active_enrollments")
    module_count = serializers.IntegerField(read_only=True, source="module_total")
    total_lessons = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "category",
            "teacher_name",
            "is_published",
            "start_at",
            "end_at",
            "thumbnail_url",
            "enrollment_count",
            "module_count",
            "total_lessons",
            "created_at",
            "updated_at",
        ]

    def get_total_lessons(self, obj):
        annotated = getattr(obj, "published_lesson_count", None)
        if annotated is not None:
            return annotated
        return obj.total_lessons


class CourseDetailSerializer(serializers.ModelSerializer):
    teacher = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    modules = ModuleSerializer(many=True, read_only=True)
    enrollment_count = serializers.IntegerField(read_only=True)
    module_count = serializers.IntegerField(read_only=True)
    total_lessons = serializers.IntegerField(read_only=True)
    is_enrolled = serializers.SerializerMethodField()
    user_progress = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "category",
            "teacher",
            "is_published",
            "start_at",
            "end_at",
            "thumbnail_url",
            "modules",
            "enrollment_count",
            "module_count",
            "total_lessons",
            "is_enrolled",
            "user_progress",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]

    def get_teacher(self, obj):
        return {
            "id": obj.teacher.id,
            "handle": obj.teacher.handle,
            "avatar_url": obj.teacher.avatar_url,
        }

    def get_is_enrolled(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.enrollments.filter(student=request.user, status="active").exists()
        return False

    def get_user_progress(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            enrollment = obj.enrollments.filter(student=request.user, status="active").first()
            if enrollment:
                return {
                    "progress": enrollment.progress,
                    "status": enrollment.status,
                }
        return None


class CourseCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = [
            "title",
            "description",
            "category",
            "thumbnail_url",
            "is_published",
            "start_at",
            "end_at",
        ]

    def create(self, validated_data):
        validated_data["teacher"] = self.context["request"].user
        return super().create(validated_data)


class EnrollmentStudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "handle", "avatar_url"]
        read_only_fields = fields


class EnrollmentSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    student = EnrollmentStudentSerializer(read_only=True)
    lesson_progress = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "course",
            "student",
            "status",
            "enrolled_at",
            "completed_at",
            "progress",
            "last_accessed",
            "lesson_progress",
        ]
        read_only_fields = ["id", "enrolled_at", "completed_at", "progress", "last_accessed"]

    def get_lesson_progress(self, obj):
        progress = obj.lesson_progress.select_related("lesson__module").all()
        return LessonProgressSerializer(progress, many=True).data


class LessonProgressSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)
    lesson_order = serializers.IntegerField(source="lesson.order", read_only=True)
    module_title = serializers.CharField(source="lesson.module.title", read_only=True)
    module_order = serializers.IntegerField(source="lesson.module.order", read_only=True)

    class Meta:
        model = LessonProgress
        fields = [
            "id",
            "lesson",
            "lesson_title",
            "lesson_order",
            "module_title",
            "module_order",
            "status",
            "started_at",
            "completed_at",
            "time_spent_minutes",
        ]
        read_only_fields = ["id", "started_at", "completed_at"]


class EnrollCreateSerializer(serializers.Serializer):
    course_id = serializers.UUIDField()


class ProblemCourseLinkSerializer(serializers.ModelSerializer):
    problem_title = serializers.CharField(source="problem.title", read_only=True)
    problem_slug = serializers.CharField(source="problem.slug", read_only=True)
    problem_status = serializers.CharField(source="problem.status", read_only=True)
    problem_difficulty = serializers.CharField(source="problem.difficulty", read_only=True)

    class Meta:
        model = ProblemCourseLink
        fields = [
            "id",
            "problem",
            "problem_title",
            "problem_slug",
            "problem_status",
            "problem_difficulty",
            "order",
            "is_required",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
