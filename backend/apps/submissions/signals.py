from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.submissions.models import Submission


@receiver(post_save, sender=Submission)
def enqueue_judge_on_create(sender, instance, created, **kwargs):
    if created and instance.status == 'pending':
        from apps.submissions.tasks import judge_submission
        judge_submission.delay(instance.id)
