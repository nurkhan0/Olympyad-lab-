from django.contrib import admin

from .models import Problem, ProblemTag, Tag, TestCase, UserProblemStatus


class TestCaseInline(admin.TabularInline):
    model = TestCase
    extra = 1


class ProblemTagInline(admin.TabularInline):
    model = ProblemTag
    extra = 1


@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'difficulty', 'status', 'solver_count', 'author')
    list_filter = ('difficulty', 'status')
    search_fields = ('title', 'slug')
    prepopulated_fields = {'slug': ('title',)}
    inlines = [TestCaseInline, ProblemTagInline]


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(UserProblemStatus)
class UserProblemStatusAdmin(admin.ModelAdmin):
    list_display = ('user', 'problem', 'status', 'solved_at')
    list_filter = ('status',)
