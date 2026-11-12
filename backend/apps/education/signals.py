from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.education.models import Enrollment, Lesson, LessonProgress


@receiver(post_save, sender=Enrollment)
def create_lesson_progress(sender, instance, created, **kwargs):
    """Create LessonProgress records when a student enrolls in a course,
    then auto-complete lessons whose mandatory problems are already solved
    (e.g. the student solved them before enrolling)."""
    if created:
        lessons = Lesson.objects.filter(module__course=instance.course, is_published=True)
        LessonProgress.objects.bulk_create(
            [
                LessonProgress(enrollment=instance, lesson=lesson)
                for lesson in lessons
            ],
            ignore_conflicts=True,
        )
        from apps.education.services import sync_lesson_completion_for_enrollment

        sync_lesson_completion_for_enrollment(instance)


@receiver(post_save, sender=Lesson)
def sync_progress_on_lesson_save(sender, instance, **kwargs):
    """Ensure every active enrollment has a progress row for this lesson.

    Runs on create and on every save, so publishing a previously draft lesson
    also backfills rows. bulk_create with ignore_conflicts is idempotent.

    Also recalculates enrollment progress on every save so that unpublishing a
    lesson removes it from the denominator (completed rows of unpublished
    lessons are excluded by update_progress's lesson__is_published filter).
    """
    if instance.is_published:
        enrollments = Enrollment.objects.filter(
            course=instance.module.course, status="active"
        )
        LessonProgress.objects.bulk_create(
            [
                LessonProgress(enrollment=enrollment, lesson=instance)
                for enrollment in enrollments
            ],
            ignore_conflicts=True,
        )

    # Recalculate progress for all active enrollments so unpublish is reflected.
    enrollments = Enrollment.objects.filter(course=instance.module.course, status="active")
    for enrollment in enrollments:
        enrollment.update_progress()


@receiver(post_save, sender=LessonProgress)
def update_enrollment_on_lesson_complete(sender, instance, **kwargs):
    """Update enrollment progress when a lesson is completed.

    Single recalculation path: mark_completed() does not call
    enrollment.update_progress() itself to avoid double writes.
    """
    if instance.status == "completed":
        instance.enrollment.update_progress()
