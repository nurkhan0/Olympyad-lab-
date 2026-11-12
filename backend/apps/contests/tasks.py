import config  # noqa: F401
from celery import shared_task
from celery.utils.log import get_task_logger
logger = get_task_logger(__name__)

@shared_task(queue='contests')
def notify_contest_start(contest_id: int):
    from apps.contests.models import Contest
    try:
        contest = Contest.objects.get(pk=contest_id)
        logger.info(f"[contest] '{contest.title}' started — Phase 4 adds real notifications")
        return {'contest_id': contest_id, 'status': 'logged'}
    except Contest.DoesNotExist:
        return {'error': 'not_found'}
