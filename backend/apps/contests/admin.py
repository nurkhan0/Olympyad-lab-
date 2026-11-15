from django.contrib import admin

from .models import Contest, ContestProblem, ContestRegistration


class ContestProblemInline(admin.TabularInline):
    """Problems of a contest, ordered by their label position."""

    model = ContestProblem
    extra = 1
    autocomplete_fields = ('problem',)
    ordering = ('order',)


class ContestRegistrationInline(admin.TabularInline):
    model = ContestRegistration
    extra = 0
    autocomplete_fields = ('user',)
    readonly_fields = ('registered_at',)
    show_change_link = True


@admin.register(Contest)
class ContestAdmin(admin.ModelAdmin):
    # end_time is derived from start_time + duration_minutes, so it is shown
    # read-only instead of being editable (it is editable=False on the model).
    list_display = ('title', 'contest_type', 'start_time', 'end_time', 'is_public',
                    'is_published', 'is_rated', 'participant_count', 'created_by')
    list_filter = ('contest_type', 'is_public', 'is_published', 'is_rated', 'start_time')
    search_fields = ('title', 'description')
    readonly_fields = ('end_time', 'created_at')
    autocomplete_fields = ('created_by',)
    inlines = [ContestProblemInline, ContestRegistrationInline]
    date_hierarchy = 'start_time'

    @admin.display(description='Participants')
    def participant_count(self, obj):
        return obj.registrations.count()


@admin.register(ContestProblem)
class ContestProblemAdmin(admin.ModelAdmin):
    list_display = ('contest', 'label', 'problem', 'order', 'points')
    list_filter = ('contest',)
    search_fields = ('contest__title', 'problem__title', 'problem__slug', 'label')
    autocomplete_fields = ('contest', 'problem')


@admin.register(ContestRegistration)
class ContestRegistrationAdmin(admin.ModelAdmin):
    list_display = ('contest', 'user', 'registered_at')
    list_filter = ('contest',)
    search_fields = ('contest__title', 'user__email', 'user__handle')
    autocomplete_fields = ('contest', 'user')
    readonly_fields = ('registered_at',)