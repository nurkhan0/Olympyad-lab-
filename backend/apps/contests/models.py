from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Contest(models.Model):
    TYPES = [('CF', 'Codeforces'), ('ICPC', 'ICPC'), ('IOI', 'IOI')]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    rules = models.TextField(blank=True, help_text='Contest rules and scoring description')
    contest_type = models.CharField(max_length=10, choices=TYPES, default='CF')
    start_time = models.DateTimeField(db_index=True)
    duration_minutes = models.IntegerField()
    registration_start = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text='When registration opens (null = open immediately)',
    )
    registration_end = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text='When registration closes (null = until contest start)',
    )
    max_participants = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Maximum number of participants (null = unlimited)',
    )
    is_public = models.BooleanField(default=True, db_index=True)
    is_published = models.BooleanField(default=False, db_index=True)
    is_rated = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name='created_contests',
    )
    problems = models.ManyToManyField('problems.Problem', through='ContestProblem', blank=True)
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, through='ContestRegistration', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def end_time(self):
        return self.start_time + timedelta(minutes=self.duration_minutes)

    @property
    def is_running(self):
        return self.start_time <= timezone.now() <= self.end_time

    @property
    def is_upcoming(self):
        return timezone.now() < self.start_time

    @property
    def is_registration_open(self):
        now = timezone.now()
        if self.registration_start and now < self.registration_start:
            return False
        if self.registration_end and now > self.registration_end:
            return False
        return True

    @property
    def participant_count(self):
        return self.registrations.count()

    class Meta:
        indexes = [
            models.Index(fields=['is_public', 'start_time']),
            models.Index(fields=['is_published', 'start_time']),
            models.Index(fields=['registration_start', 'registration_end']),
        ]


class ContestProblem(models.Model):
    contest = models.ForeignKey(Contest, on_delete=models.CASCADE, related_name='contest_problems')
    problem = models.ForeignKey('problems.Problem', on_delete=models.CASCADE)
    label = models.CharField(max_length=5)
    order = models.PositiveIntegerField()
    points = models.IntegerField(default=0)

    class Meta:
        unique_together = [('contest', 'label'), ('contest', 'order')]
        ordering = ['order']


class ContestRegistration(models.Model):
    contest = models.ForeignKey(Contest, on_delete=models.CASCADE, related_name='registrations')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('contest', 'user')]
