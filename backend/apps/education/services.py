"""Education business logic.

Single source of truth for:
- lesson completion rules (mandatory practice problems),
- judge → LMS integration (Accepted verdict handling),
- submission-derived analytics.

All metrics are derived from real Submission / UserProblemStatus records;
no cached counters are used so the numbers cannot drift.
"""
from collections import defaultdict

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.education.models import (
    Enrollment,
    Lesson,
    LessonProgress,
    ProblemCourseLink,
)


def _solved_problem_ids(user, problem_ids=None):
    """Set of problem ids the user has solved (unique problems, not submissions)."""
    from apps.problems.models import UserProblemStatus

    qs = UserProblemStatus.objects.filter(user=user, status="solved")
    if problem_ids is not None:
        qs = qs.filter(problem_id__in=problem_ids)
    return set(qs.values_list("problem_id", flat=True))


def sync_lesson_completion_for_enrollment(enrollment, lesson_ids=None):
    """Auto-complete lessons whose mandatory practice problems are all solved.

    Idempotent: lessons already completed are never re-completed, lessons
    without mandatory problems are never auto-completed here (students may
    complete them manually). Returns the ids of newly completed progress rows.
    """
    lessons = list(
        Lesson.objects.filter(module__course=enrollment.course, is_published=True)
        .prefetch_related("problem_links")
    )
    if lesson_ids is not None:
        wanted = set(lesson_ids)
        lessons = [lesson for lesson in lessons if lesson.pk in wanted]

    required_by_lesson = {
        lesson.pk: {
            link.problem_id for link in lesson.problem_links.all() if link.is_required
        }
        for lesson in lessons
    }
    all_required = set()
    for required in required_by_lesson.values():
        all_required |= required

    solved = _solved_problem_ids(enrollment.student, all_required or None)

    completed = []
    for lesson in lessons:
        required = required_by_lesson[lesson.pk]
        if not required or not required <= solved:
            continue
        progress, _ = LessonProgress.objects.get_or_create(
            enrollment=enrollment, lesson=lesson
        )
        if progress.status != "completed":
            progress.mark_completed()
            completed.append(str(progress.pk))
    return completed


def handle_accepted_submission(submission):
    """Judge → education integration for an Accepted verdict.

    Called once per final verdict from the judge task (source of truth:
    persisted Submission record). Idempotent:
    - marks UserProblemStatus solved at most once per (user, problem),
    - counts unique solved problems, never Accepted submissions,
    - never duplicates completion records (mark_completed guards).

    Contest submissions are skipped here: olympiad results live in the
    contests app standings and must not touch course progress.
    """
    if getattr(submission, "contest_id", None):
        return {"status": "skipped_contest_submission"}

    with transaction.atomic():
        from apps.problems.models import UserProblemStatus

        status_row, created = UserProblemStatus.objects.get_or_create(
            user=submission.user,
            problem=submission.problem,
            defaults={"status": "solved", "solved_at": timezone.now()},
        )
        if not created and status_row.status != "solved":
            status_row.status = "solved"
            status_row.solved_at = timezone.now()
            status_row.save(update_fields=["status", "solved_at"])

        linked_lessons = list(
            Lesson.objects.filter(
                problem_links__problem_id=submission.problem_id, is_published=True
            ).select_related("module")
        )
        if not linked_lessons:
            return {"status": "no_linked_lessons"}

        lesson_ids_by_course = defaultdict(list)
        for lesson in linked_lessons:
            lesson_ids_by_course[lesson.module.course_id].append(lesson.pk)

        enrollments = Enrollment.objects.filter(
            student=submission.user,
            course_id__in=lesson_ids_by_course.keys(),
            status="active",
        )

        completed = []
        for enrollment in enrollments:
            course_lesson_ids = lesson_ids_by_course[enrollment.course_id]
            # Touch progress: an Accepted submission means the student worked here.
            for lesson_id in course_lesson_ids:
                progress, _ = LessonProgress.objects.get_or_create(
                    enrollment=enrollment, lesson_id=lesson_id
                )
                if progress.status == "not_started":
                    progress.mark_started()
            completed.extend(
                sync_lesson_completion_for_enrollment(enrollment, course_lesson_ids)
            )

        return {"status": "ok", "completed_lessons": completed}


def student_analytics(user):
    """Aggregate learning stats for one student, from real Submission records.

    Definitions:
    - attempts: every Submission record created by the user;
    - accepted: submissions whose final persisted verdict is AC;
    - accuracy: accepted / attempts;
    - solved_problems: number of unique problems with an AC verdict.
    """
    from apps.submissions.models import Submission

    agg = Submission.objects.filter(user=user).aggregate(
        total=Count("id"),
        accepted=Count("id", filter=Q(status="done", verdict="AC")),
    )
    total = agg["total"] or 0
    accepted = agg["accepted"] or 0

    solved = (
        Submission.objects.filter(user=user, status="done", verdict="AC")
        .values("problem_id")
        .distinct()
        .count()
    )
    active_courses = Enrollment.objects.filter(student=user, status="active").count()
    lessons_completed = LessonProgress.objects.filter(
        enrollment__student=user, status="completed"
    ).count()

    return {
        "total_submissions": total,
        "accepted_submissions": accepted,
        "accuracy": round(accepted / total * 100, 2) if total else 0.0,
        "solved_problems": solved,
        "active_courses": active_courses,
        "lessons_completed": lessons_completed,
    }


def course_analytics(course):
    """Per-student analytics for a course, for teachers/admins.

    All numbers come from real Submission records of enrolled students on
    problems linked to this course's lessons.
    """
    from apps.submissions.models import Submission

    problem_ids = set(
        ProblemCourseLink.objects.filter(
            lesson__module__course=course, lesson__is_published=True
        ).values_list("problem_id", flat=True)
    )
    lessons_total = Lesson.objects.filter(
        module__course=course, is_published=True
    ).count()

    rows = []
    enrollments = course.enrollments.filter(status="active").select_related("student")
    for enrollment in enrollments:
        student = enrollment.student
        agg = Submission.objects.filter(
            user=student, problem_id__in=problem_ids
        ).aggregate(
            attempts=Count("id"),
            accepted=Count("id", filter=Q(status="done", verdict="AC")),
        )
        attempts = agg["attempts"] or 0
        accepted = agg["accepted"] or 0
        solved = (
            Submission.objects.filter(
                user=student, problem_id__in=problem_ids, status="done", verdict="AC"
            )
            .values("problem_id")
            .distinct()
            .count()
        )
        rows.append(
            {
                "student": {
                    "id": str(student.pk),
                    "handle": student.handle,
                    "avatar_url": student.avatar_url,
                },
                "progress": float(enrollment.progress),
                "lessons_completed": enrollment.lesson_progress.filter(
                    status="completed", lesson__is_published=True
                ).count(),
                "lessons_total": lessons_total,
                "attempts": attempts,
                "accepted_submissions": accepted,
                "accuracy": round(accepted / attempts * 100, 2) if attempts else 0.0,
                "solved_problems": solved,
            }
        )

    return {
        "course_id": str(course.pk),
        "course_title": course.title,
        "problem_count": len(problem_ids),
        "students": rows,
    }
