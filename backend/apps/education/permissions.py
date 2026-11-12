from rest_framework import permissions
from rest_framework import exceptions

from apps.education.models import Course, Lesson, Module


def resolve_course(obj):
    """Walk any nested education object up to its Course."""
    if isinstance(obj, Course):
        return obj
    if hasattr(obj, "course"):
        return obj.course
    if hasattr(obj, "module"):
        return obj.module.course
    if hasattr(obj, "lesson"):
        return obj.lesson.module.course
    return None


def resolve_course_from_kwargs(view):
    """Resolve the parent Course targeted by nested router URL kwargs.

    Returns None when the URL does not point at a course subtree.
    """
    kwargs = getattr(view, "kwargs", None) or {}
    course_pk = kwargs.get("course_pk")
    if course_pk:
        return Course.objects.filter(pk=course_pk).first()

    module_pk = kwargs.get("module_pk")
    if module_pk:
        module = Module.objects.select_related("course").filter(pk=module_pk).first()
        return module.course if module else None

    lesson_pk = kwargs.get("lesson_pk")
    if lesson_pk:
        lesson = Lesson.objects.select_related("module__course").filter(pk=lesson_pk).first()
        return lesson.module.course if lesson else None

    return None


def is_course_manager(user, course):
    """True when user is an admin or the course's own teacher."""
    if not user.is_authenticated:
        return False
    if course is None:
        return False
    return getattr(user, "role", None) == "admin" or course.teacher_id == user.id


class IsTeacherOrReadOnly(permissions.BasePermission):
    """
    Allow teachers to create/edit their own courses.
    Students can only view published courses.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and request.user.role in ["teacher", "admin"]

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return obj.is_published or request.user == obj.teacher or request.user.role == "admin"
        return request.user == obj.teacher or request.user.role == "admin"


class IsCourseContentManager(permissions.BasePermission):
    """Write access to nested course content only for the course's teacher or an admin.

    The parent course is resolved from the URL kwargs, so creation against a
    foreign course is rejected before the serializer even runs. Read access is
    enforced by queryset visibility in the ViewSets.
    """

    message = "Only the course teacher or an administrator can manage course content."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if not user.is_authenticated or getattr(user, "role", None) not in ("teacher", "admin"):
            return False
        getter = getattr(view, "get_parent_course", None)
        course = getter() if getter else resolve_course_from_kwargs(view)
        return is_course_manager(user, course)

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_course_manager(request.user, resolve_course(obj))


class IsEnrolledOrTeacher(permissions.BasePermission):
    """Allow enrolled students and course teacher to view lesson progress."""

    def has_object_permission(self, request, view, obj):
        enrollment = obj.enrollment if hasattr(obj, "enrollment") else obj
        course = enrollment.course
        return (
            request.user == course.teacher
            or request.user.role == "admin"
            or enrollment.student == request.user
        )


class IsAuthenticatedOrReadOnly401(permissions.BasePermission):
    """
    Allow read-only access to unauthenticated users, but require
    authentication for write operations.

    Unlike DRF's IsAuthenticatedOrReadOnly (which returns 403 Forbidden for
    unauthenticated writes), this raises 401 Unauthorized so clients can
    distinguish "not logged in" from "not allowed".
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        if not request.user.is_authenticated:
            raise exceptions.NotAuthenticated()
        return True
