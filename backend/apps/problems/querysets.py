"""Reusable querysets for the public problem surfaces.

A problem with ``visibility='contest'`` is written for a single tournament: it
must not show up in the public problem list or be reachable by slug while the
contest it belongs to is still running (or has not started yet). Once every
contest that uses it has finished, it becomes ordinary public material.
"""

from django.utils import timezone

from .models import Problem


def hidden_contest_only_problem_ids():
    """IDs of contest-only problems still locked by a running/upcoming contest."""
    # Imported lazily: contests.models points back at this app by string, and a
    # module-level import here would make the two model modules load in order.
    from apps.contests.models import ContestProblem

    return (
        ContestProblem.objects
        .filter(contest__end_time__gt=timezone.now(), problem__visibility='contest')
        .values_list('problem_id', flat=True)
    )


def publicly_visible_problems():
    """Published problems that are not currently locked inside a live contest."""
    return (
        Problem.objects
        .filter(status='published')
        .exclude(pk__in=hidden_contest_only_problem_ids())
    )