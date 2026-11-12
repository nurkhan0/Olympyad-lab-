from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import models as m


def register():
    from apps.submissions.models import Submission

    @receiver(post_save, sender=Submission)
    def on_save(sender, instance, **kwargs):
        if instance.status == 'done' and instance.verdict == 'AC':
            already = Submission.objects.filter(
                user=instance.user,
                problem=instance.problem,
                status='done',
                verdict='AC',
            ).exclude(pk=instance.pk).exists()
            if not already:
                instance.problem.__class__.objects.filter(pk=instance.problem_id).update(
                    solver_count=m.F('solver_count') + 1,
                )
