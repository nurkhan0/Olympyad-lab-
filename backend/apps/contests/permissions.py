from rest_framework.permissions import BasePermission


class IsTeacherOrAdmin(BasePermission):
    """Only teachers and administrators."""

    def has_permission(self, request, view):
        user = request.user
        return user.is_authenticated and user.role in ('teacher', 'admin')


class IsContestCreatorOrAdmin(BasePermission):
    """Only the contest creator or an administrator."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.role == 'admin':
            return True
        return getattr(obj, 'created_by_id', None) == user.pk


class CanRegisterForContest(BasePermission):
    """Students can register for contests during the registration window."""

    def has_permission(self, request, view):
        user = request.user
        return user.is_authenticated and user.role == 'student'

