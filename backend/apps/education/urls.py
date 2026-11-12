from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers

from apps.education.views import (
    CategoryViewSet,
    CourseViewSet,
    ModuleViewSet,
    LessonViewSet,
    MaterialViewSet,
    EnrollmentViewSet,
    LessonProgressViewSet,
    ProblemCourseLinkViewSet,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"courses", CourseViewSet, basename="course")
router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")

# Nested routes for courses
courses_router = routers.NestedSimpleRouter(router, r"courses", lookup="course")
courses_router.register(r"modules", ModuleViewSet, basename="course-modules")

# Nested routes for modules
modules_router = routers.NestedSimpleRouter(courses_router, r"modules", lookup="module")
modules_router.register(r"lessons", LessonViewSet, basename="module-lessons")

# Nested routes for lessons
lessons_router = routers.NestedSimpleRouter(modules_router, r"lessons", lookup="lesson")
lessons_router.register(r"materials", MaterialViewSet, basename="lesson-materials")
lessons_router.register(r"problems", ProblemCourseLinkViewSet, basename="lesson-problems")

# Nested routes for enrollments
enrollments_router = routers.NestedSimpleRouter(router, r"enrollments", lookup="enrollment")
enrollments_router.register(r"progress", LessonProgressViewSet, basename="enrollment-progress")

urlpatterns = [
    path("", include(router.urls)),
    path("", include(courses_router.urls)),
    path("", include(modules_router.urls)),
    path("", include(lessons_router.urls)),
    path("", include(enrollments_router.urls)),
]
