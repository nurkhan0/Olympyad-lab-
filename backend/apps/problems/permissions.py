from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'admin'
        )


class IsTeacherOrAdmin(BasePermission):
    """Teachers and administrators may reach the endpoint.

    Object-level scoping (authorship) is enforced separately where needed.
    """

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in ('teacher', 'admin'))


class IsProblemAuthorOrAdmin(BasePermission):
    """Object-level: the problem author (teacher) or any administrator."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in ('teacher', 'admin'))

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        # Test cases carry no author of their own: authorisation is inherited
        # from the problem they belong to. Problems fall through unchanged.
        problem = getattr(obj, 'problem', obj)
        if user.role == 'admin':
            return True
        return problem.author_id == user.pk
