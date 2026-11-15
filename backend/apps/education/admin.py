from django.contrib import admin

from .models import (
    Category,
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    Material,
    Module,
    ProblemCourseLink,
)


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 1
    ordering = ('order',)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug')
    prepopulated_fields = {'slug': ('title',)}
    search_fields = ('title',)


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'category', 'teacher', 'is_published', 'start_at', 'end_at')
    list_filter = ('is_published', 'category')
    search_fields = ('title', 'slug')
    prepopulated_fields = {'slug': ('title',)}
    autocomplete_fields = ('category', 'teacher')
    inlines = [ModuleInline]
    list_select_related = ('category', 'teacher')


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order')
    list_filter = ('course',)
    search_fields = ('title', 'course__title')
    autocomplete_fields = ('course',)


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'order')
    list_filter = ('module__course',)
    search_fields = ('title', 'module__title')
    autocomplete_fields = ('module',)


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('title', 'lesson', 'material_type', 'order')
    list_filter = ('material_type',)
    search_fields = ('title', 'lesson__title')
    autocomplete_fields = ('lesson',)


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'status', 'progress', 'enrolled_at', 'completed_at')
    list_filter = ('status', 'course')
    search_fields = ('student__email', 'student__handle', 'course__title')
    autocomplete_fields = ('student', 'course')
    readonly_fields = ('enrolled_at',)


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ('enrollment', 'lesson', 'status', 'time_spent_minutes', 'completed_at')
    list_filter = ('status',)
    search_fields = ('enrollment__student__email', 'lesson__title')
    autocomplete_fields = ('enrollment', 'lesson')


@admin.register(ProblemCourseLink)
class ProblemCourseLinkAdmin(admin.ModelAdmin):
    list_display = ('problem', 'lesson', 'order', 'is_required')
    list_filter = ('is_required',)
    search_fields = ('problem__title', 'lesson__title')
    autocomplete_fields = ('problem', 'lesson')