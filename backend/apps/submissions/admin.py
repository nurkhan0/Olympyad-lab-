from django.contrib import admin

from .models import FailedSubmission, Submission
from .tasks import judge_submission


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'problem', 'language', 'status', 'verdict', 'time_ms', 'created_at',
    )
    list_filter = ('status', 'verdict', 'language')
    search_fields = ('user__email', 'user__handle', 'problem__title', 'problem__slug')
    readonly_fields = ('created_at',)
    actions = ['re_judge_selected']

    @admin.action(description='Re-judge selected')
    def re_judge_selected(self, request, queryset):
        for submission in queryset:
            submission.status = 'pending'
            submission.verdict = None
            submission.time_ms = None
            submission.memory_kb = None
            submission.save(
                update_fields=['status', 'verdict', 'time_ms', 'memory_kb'],
            )
            judge_submission.delay(submission.id)


@admin.register(FailedSubmission)
class FailedSubmissionAdmin(admin.ModelAdmin):
    list_display = ('submission', 'retry_count', 'failed_at')
    list_filter = ('failed_at',)
    readonly_fields = ('failed_at',)
