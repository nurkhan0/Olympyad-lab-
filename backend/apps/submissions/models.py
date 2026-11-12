from django.conf import settings
from django.db import models


class Submission(models.Model):
    LANGUAGE_CHOICES = [
        ('python', 'Python 3'),
        ('cpp', 'C++17'),
        ('java', 'Java 17'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('judging', 'Judging'),
        ('done', 'Done'),
        ('error', 'Error'),
    ]
    VERDICT_CHOICES = [
        ('AC', 'Accepted'),
        ('WA', 'Wrong Answer'),
        ('TLE', 'Time Limit Exceeded'),
        ('MLE', 'Memory Limit Exceeded'),
        ('RE', 'Runtime Error'),
        ('CE', 'Compilation Error'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submissions',
    )
    problem = models.ForeignKey('problems.Problem', on_delete=models.CASCADE)
    contest = models.ForeignKey(
        'contests.Contest',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='submissions',
        db_index=True,
        help_text='Contest this submission belongs to (null for practice submissions)',
    )
    code = models.TextField()
    language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    verdict = models.CharField(max_length=5, choices=VERDICT_CHOICES, null=True, blank=True)
    time_ms = models.IntegerField(null=True, blank=True)
    memory_kb = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'problem', 'created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'Submission #{self.pk} — {self.user_id} / {self.problem_id}'


class FailedSubmission(models.Model):
    submission = models.OneToOneField(
        Submission,
        on_delete=models.CASCADE,
        related_name='failed_record',
    )
    error_message = models.TextField()
    failed_at = models.DateTimeField(auto_now_add=True)
    retry_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-failed_at']

    def __str__(self):
        return f'Failed submission #{self.submission_id}'
