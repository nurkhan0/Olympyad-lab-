from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count

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
from apps.education.serializers import (
    CategorySerializer,
    CourseListSerializer,
    CourseDetailSerializer,
    CourseCreateUpdateSerializer,
    ModuleSerializer,
    LessonSerializer,
    MaterialSerializer,
    EnrollmentSerializer,
    LessonProgressSerializer,
    EnrollCreateSerializer,
    ProblemCourseLinkSerializer,
)
from apps.education.permissions import (
    IsTeacherOrReadOnly,
    IsCourseContentManager,
    IsEnrolledOrTeacher,
    IsAuthenticatedOrReadOnly401,
)


def annotated_enrollments_qs():
    """Enrollments with the course-list annotations applied, so nested
    CourseListSerializer values come from the database instead of per-row
    property queries (N+1)."""
    return Enrollment.objects.select_related("course__teacher", "student").annotate(
        active_enrollments=Count(
            "course__enrollments",
            filter=Q(course__enrollments__status="active"),
            distinct=True,
        ),
        module_total=Count("course__modules", distinct=True),
        published_lesson_count=Count(
            "course__modules__lessons",
            filter=Q(course__modules__lessons__is_published=True),
            distinct=True,
        ),
    )


class NestedEducationMixin:
    """Resolve and validate the full nested parent chain from URL kwargs.

    Nested routers supply course_pk/module_pk/lesson_pk independently, so a
    client can pair a lesson id with a foreign module id. Every level here is
    checked against its parent; mismatches raise Http404.
    """

    def get_parent_chain(self):
        kwargs = self.kwargs
        course_pk = kwargs.get("course_pk")
        module_pk = kwargs.get("module_pk")
        lesson_pk = kwargs.get("lesson_pk")

        course = module = lesson = None
        if course_pk:
            course = get_object_or_404(Course, pk=course_pk)
        if module_pk:
            module = get_object_or_404(Module, pk=module_pk)
            if course_pk and module.course_id != course.pk:
                raise Http404
            course = course or module.course
        if lesson_pk:
            lesson = get_object_or_404(Lesson, pk=lesson_pk)
            if module_pk and lesson.module_id != module.pk:
                raise Http404
            module = module or lesson.module
            course = course or lesson.module.course

        if course is None and module is None and lesson is None:
            return None
        return {"course": course, "module": module, "lesson": lesson}

    def get_parent_course(self):
        chain = self.get_parent_chain()
        return chain["course"] if chain else None


class CategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for Category model (course directions)."""

    queryset = Category.objects.all().annotate(course_count=Count("courses"))
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description"]
    ordering_fields = ["title", "created_at"]
    ordering = ["title"]


class CourseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Course model.
    - List: All published courses (public), or all courses for teacher/admin
    - Create: Teachers and admins only
    - Retrieve: Published courses (public), or all for teacher/admin/enrolled students
    - Update/Delete: Course teacher or admin only
    """

    queryset = (
        Course.objects.select_related("teacher", "category")
        .prefetch_related("modules__lessons")
        .annotate(
            active_enrollments=Count(
                "enrollments", filter=Q(enrollments__status="active"), distinct=True
            ),
            module_total=Count("modules", distinct=True),
            published_lesson_count=Count(
                "modules__lessons",
                filter=Q(modules__lessons__is_published=True),
                distinct=True,
            ),
        )
    )
    permission_classes = [IsAuthenticatedOrReadOnly, IsTeacherOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "title", "enrollment_count"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return CourseListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return CourseCreateUpdateSerializer
        return CourseDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and user.role in ["teacher", "admin"]:
            if user.role == "admin":
                return self.queryset
            return self.queryset.filter(teacher=user)
        return self.queryset.filter(is_published=True)

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

    def create(self, request, *args, **kwargs):
        """Create a course and return the full detail payload.

        CourseCreateUpdateSerializer omits 'id'/'slug', which leaves clients
        unable to address the created course; respond with CourseDetailSerializer
        instead (additive change: extra fields).
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        detail = CourseDetailSerializer(serializer.instance, context=self.get_serializer_context())
        return Response(detail.data, status=status.HTTP_201_CREATED)

    def _annotated_enrollments(self):
        """Enrollment queryset with the course list annotations applied, so
        EnrollmentSerializer's nested CourseListSerializer has real values."""
        return annotated_enrollments_qs()

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def enroll(self, request, pk=None):
        """Enroll the current student in this course."""
        if request.user.role != "student":
            return Response(
                {"error": "Only students can enroll in courses"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        course = self.get_object()
        if not course.is_published:
            return Response(
                {"error": "Cannot enroll in unpublished course"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        enrollment, created = Enrollment.objects.get_or_create(
            student=request.user,
            course=course,
            defaults={"status": "active"},
        )

        annotated = self._annotated_enrollments().get(pk=enrollment.pk)

        if not created:
            if annotated.status == "dropped":
                annotated.status = "active"
                annotated.save(update_fields=["status"])
            return Response(
                {"message": "Already enrolled", "enrollment": EnrollmentSerializer(annotated).data},
                status=status.HTTP_200_OK,
            )

        return Response(
            EnrollmentSerializer(annotated).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def unenroll(self, request, pk=None):
        """Unenroll the current student from this course."""
        course = self.get_object()
        enrollment = Enrollment.objects.filter(student=request.user, course=course).first()

        if not enrollment:
            return Response(
                {"error": "Not enrolled in this course"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        enrollment.status = "dropped"
        enrollment.save(update_fields=["status"])

        return Response({"message": "Successfully unenrolled"})

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def my_progress(self, request, pk=None):
        """Get current student progress in this course."""
        course = self.get_object()
        enrollment = Enrollment.objects.filter(student=request.user, course=course).first()

        if not enrollment:
            return Response(
                {"error": "Not enrolled in this course"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        annotated = self._annotated_enrollments().get(pk=enrollment.pk)
        return Response(EnrollmentSerializer(annotated).data)

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[IsAuthenticated],
    )
    def analytics(self, request, pk=None):
        """Per-student submission analytics — course teacher/admin only.

        All metrics are derived from real Submission records.
        """
        course = self.get_object()
        user = request.user
        if not (getattr(user, "role", None) == "admin" or course.teacher_id == user.pk):
            return Response(
                {"error": "Only the course teacher or an administrator can view analytics"},
                status=status.HTTP_403_FORBIDDEN,
            )

        from apps.education.services import course_analytics

        return Response(course_analytics(course))


class ModuleViewSet(NestedEducationMixin, viewsets.ModelViewSet):
    """ViewSet for Module model."""

    queryset = Module.objects.select_related("course").annotate(
        annotated_lesson_count=Count("lessons", distinct=True)
    )
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticatedOrReadOnly401, IsCourseContentManager]

    def get_queryset(self):
        qs = self.queryset
        course_id = self.kwargs.get("course_pk")
        if course_id:
            qs = qs.filter(course_id=course_id)

        user = self.request.user
        role = getattr(user, "role", None)
        if user.is_authenticated and role == "admin":
            return qs
        if user.is_authenticated and role == "teacher":
            return qs.filter(Q(course__is_published=True) | Q(course__teacher=user))
        return qs.filter(course__is_published=True)

    def perform_create(self, serializer):
        chain = self.get_parent_chain()
        serializer.save(course=chain["course"])


class LessonViewSet(NestedEducationMixin, viewsets.ModelViewSet):
    """ViewSet for Lesson model."""

    queryset = (
        Lesson.objects.select_related("module__course")
        .prefetch_related("materials", "problem_links__problem")
        .annotate(problem_count=Count("problem_links", distinct=True))
    )
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticatedOrReadOnly401, IsCourseContentManager]

    def get_queryset(self):
        qs = self.queryset
        course_id = self.kwargs.get("course_pk")
        module_id = self.kwargs.get("module_pk")
        if module_id:
            qs = qs.filter(module_id=module_id)
        if course_id:
            qs = qs.filter(module__course_id=course_id)

        user = self.request.user
        role = getattr(user, "role", None)
        if user.is_authenticated and role == "admin":
            return qs
        if user.is_authenticated and role == "teacher":
            return qs.filter(
                Q(module__course__teacher=user)
                | (Q(module__course__is_published=True) & Q(is_published=True))
            )
        return qs.filter(module__course__is_published=True, is_published=True)

    def perform_create(self, serializer):
        chain = self.get_parent_chain()
        serializer.save(module=chain["module"])


class MaterialViewSet(NestedEducationMixin, viewsets.ModelViewSet):
    """ViewSet for Material model."""

    queryset = Material.objects.select_related("lesson__module__course")
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticatedOrReadOnly401, IsCourseContentManager]

    def get_queryset(self):
        qs = self.queryset
        course_id = self.kwargs.get("course_pk")
        module_id = self.kwargs.get("module_pk")
        lesson_id = self.kwargs.get("lesson_pk")
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        if module_id:
            qs = qs.filter(lesson__module_id=module_id)
        if course_id:
            qs = qs.filter(lesson__module__course_id=course_id)

        user = self.request.user
        role = getattr(user, "role", None)
        if user.is_authenticated and role == "admin":
            return qs
        if user.is_authenticated and role == "teacher":
            return qs.filter(
                Q(lesson__module__course__teacher=user)
                | (
                    Q(lesson__module__course__is_published=True)
                    & Q(lesson__is_published=True)
                )
            )
        return qs.filter(lesson__module__course__is_published=True, lesson__is_published=True)

    def perform_create(self, serializer):
        chain = self.get_parent_chain()
        serializer.save(lesson=chain["lesson"])


class EnrollmentViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Enrollment model (student view)."""

    queryset = annotated_enrollments_qs().prefetch_related("lesson_progress__lesson__module")
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)
        if role == "teacher":
            return self.queryset.filter(course__teacher=user)
        if role == "admin":
            return self.queryset
        return self.queryset.filter(student=user)

    @action(detail=False, methods=["get"], url_path="my-stats")
    def my_stats(self, request):
        """Aggregate learning stats for the current student.

        Derived from real Submission records of the requesting user.
        """
        from apps.education.services import student_analytics

        return Response(student_analytics(request.user))


class LessonProgressViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for LessonProgress model.

    Progress rows are created automatically by signals on enrollment/publish;
    manual row creation is not allowed. Students may start lessons and complete
    lessons that have no unsolved mandatory practice problems.
    """

    queryset = LessonProgress.objects.select_related("enrollment__course", "lesson__module")
    serializer_class = LessonProgressSerializer
    permission_classes = [IsAuthenticated, IsEnrolledOrTeacher]

    def get_queryset(self):
        qs = self.queryset
        enrollment_id = self.kwargs.get("enrollment_pk")
        if enrollment_id:
            qs = qs.filter(enrollment_id=enrollment_id)

        user = self.request.user
        role = getattr(user, "role", None)
        if role == "teacher":
            return qs.filter(enrollment__course__teacher=user)
        if role == "admin":
            return qs
        return qs.filter(enrollment__student=user)

    def _get_owned_progress(self, request, pk):
        """Fetch a progress row owned by the requesting student."""
        progress = self.get_object()
        if progress.enrollment.student_id != request.user.pk:
            return None
        return progress

    def get_object(self):
        """Use the base queryset (without student filtering) so that
        object-level permissions return 403 instead of 404 when a student
        tries to access another student's progress row."""
        pk = self.kwargs.get("pk")
        try:
            obj = self.queryset.get(pk=pk)
        except LessonProgress.DoesNotExist:
            raise Http404
        self.check_object_permissions(self.request, obj)
        return obj

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None, enrollment_pk=None):
        """Mark lesson as started."""
        progress = self._get_owned_progress(request, pk)
        if progress is None:
            return Response(
                {"error": "You can only manage your own lesson progress"},
                status=status.HTTP_403_FORBIDDEN,
            )
        progress.mark_started()
        return Response(LessonProgressSerializer(progress).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None, enrollment_pk=None):
        """Mark lesson as completed (manual completion).

        Lessons with mandatory practice problems can only be completed by
        solving all of them — handled by the judge integration.
        """
        from apps.problems.models import UserProblemStatus

        progress = self._get_owned_progress(request, pk)
        if progress is None:
            return Response(
                {"error": "You can only manage your own lesson progress"},
                status=status.HTTP_403_FORBIDDEN,
            )

        required_ids = set(
            progress.lesson.problem_links.filter(is_required=True).values_list(
                "problem_id", flat=True
            )
        )
        if required_ids:
            solved_ids = set(
                UserProblemStatus.objects.filter(
                    user=progress.enrollment.student,
                    problem_id__in=required_ids,
                    status="solved",
                ).values_list("problem_id", flat=True)
            )
            unsolved = required_ids - solved_ids
            if unsolved:
                return Response(
                    {
                        "error": "This lesson has mandatory practice problems that are not solved yet",
                        "unsolved_count": len(unsolved),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        progress.mark_completed()
        return Response(LessonProgressSerializer(progress).data)


class ProblemCourseLinkViewSet(NestedEducationMixin, viewsets.ModelViewSet):
    """ViewSet for ProblemCourseLink model."""

    queryset = ProblemCourseLink.objects.select_related("problem", "lesson__module__course")
    serializer_class = ProblemCourseLinkSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsCourseContentManager]

    def get_queryset(self):
        qs = self.queryset
        course_id = self.kwargs.get("course_pk")
        module_id = self.kwargs.get("module_pk")
        lesson_id = self.kwargs.get("lesson_pk")
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        if module_id:
            qs = qs.filter(lesson__module_id=module_id)
        if course_id:
            qs = qs.filter(lesson__module__course_id=course_id)

        user = self.request.user
        role = getattr(user, "role", None)
        if user.is_authenticated and role == "admin":
            return qs
        if user.is_authenticated and role == "teacher":
            return qs.filter(
                Q(lesson__module__course__teacher=user)
                | (Q(lesson__module__course__is_published=True) & Q(problem__status="published"))
            )
        return qs.filter(
            lesson__module__course__is_published=True,
            problem__status="published",
        )

    def perform_create(self, serializer):
        chain = self.get_parent_chain()
        serializer.save(lesson=chain["lesson"])
