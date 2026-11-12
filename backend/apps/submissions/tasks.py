import os
import subprocess
import tempfile
import time

from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

LANG_CONFIG = {
    'python': {
        'ext': '.py',
        'compile': None,
        'run': ['python3', '{file}'],
    },
    'cpp': {
        'ext': '.cpp',
        'compile': ['g++', '-O2', '-std=c++17', '-o', '{exe}', '{file}'],
        'run': ['{exe}'],
    },
    'java': {
        'ext': '.java',
        'compile': ['javac', '{file}'],
        'run': ['java', '-cp', '{dir}', 'Main'],
    },
}


def _get_test_cases(problem) -> list[dict[str, str]]:
    return [
        {'input': tc.input, 'expected_output': tc.expected_output}
        for tc in problem.test_cases.order_by('order', 'created_at')
    ]


def run_judge(sub) -> tuple[str, int, int]:
    """Run all test cases. Returns (verdict, time_ms, memory_kb)."""
    problem = sub.problem
    lang = sub.language
    cfg = LANG_CONFIG[lang]
    test_cases = _get_test_cases(problem)

    if not test_cases:
        return 'AC', 0, 0

    time_limit_ms = problem.time_ms
    time_limit_s = time_limit_ms / 1000.0

    with tempfile.TemporaryDirectory() as tmpdir:
        if lang == 'java':
            src_path = os.path.join(tmpdir, 'Main' + cfg['ext'])
        else:
            src_path = os.path.join(tmpdir, 'solution' + cfg['ext'])

        with open(src_path, 'w', encoding='utf-8') as handle:
            handle.write(sub.code)

        exe_path = os.path.join(tmpdir, 'solution')

        if cfg['compile']:
            compile_cmd = [
                part.format(file=src_path, exe=exe_path, dir=tmpdir)
                for part in cfg['compile']
            ]
            result = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode != 0:
                return 'CE', 0, 0

        max_time_ms = 0
        max_memory_kb = 0

        for test_case in test_cases:
            run_cmd = [
                part.format(file=src_path, exe=exe_path, dir=tmpdir)
                for part in cfg['run']
            ]
            start = time.perf_counter()
            try:
                proc = subprocess.run(
                    run_cmd,
                    input=test_case['input'],
                    capture_output=True,
                    text=True,
                    timeout=time_limit_s + 1,
                )
            except subprocess.TimeoutExpired:
                return 'TLE', int(time_limit_s * 1000), max_memory_kb

            elapsed_ms = int((time.perf_counter() - start) * 1000)
            max_time_ms = max(max_time_ms, elapsed_ms)

            if elapsed_ms > time_limit_ms:
                return 'TLE', elapsed_ms, max_memory_kb

            if proc.returncode != 0:
                return 'RE', elapsed_ms, max_memory_kb

            got = proc.stdout.strip()
            expected = test_case['expected_output'].strip()
            if got != expected:
                return 'WA', elapsed_ms, max_memory_kb

        return 'AC', max_time_ms, max_memory_kb


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    queue='judge',
    name='apps.submissions.judge_submission',
    acks_late=True,
    soft_time_limit=120,
    time_limit=180,
)
def judge_submission(self, submission_id: int):
    from apps.submissions.models import FailedSubmission, Submission

    try:
        sub = Submission.objects.select_related('problem').get(id=submission_id)
    except Submission.DoesNotExist:
        logger.error('Submission %s not found', submission_id)
        return

    sub.status = 'judging'
    sub.save(update_fields=['status'])

    from apps.submissions.broadcast import broadcast_submission_status

    broadcast_submission_status(sub)

    try:
        verdict, time_ms, memory_kb = run_judge(sub)
        sub.verdict = verdict
        sub.status = 'done'
        sub.time_ms = time_ms
        sub.memory_kb = memory_kb
        sub.save(update_fields=['status', 'verdict', 'time_ms', 'memory_kb'])
        broadcast_submission_status(sub)
        logger.info('[judge] #%s → %s (%sms)', submission_id, verdict, time_ms)

        if verdict == 'AC':
            # Final persisted verdict is the source of truth: sync unique
            # problem-solved status and course lesson progress. Idempotent.
            from apps.education.services import handle_accepted_submission

            try:
                handle_accepted_submission(sub)
            except Exception:
                logger.exception(
                    '[judge] education progress sync failed for submission %s',
                    submission_id,
                )
    except Exception as exc:
        logger.warning('Judge error on submission %s: %s', submission_id, exc)
        try:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries * 5) from exc
        except MaxRetriesExceededError:
            sub.status = 'error'
            sub.verdict = None
            sub.save(update_fields=['status', 'verdict', 'time_ms', 'memory_kb'])
            broadcast_submission_status(sub)
            FailedSubmission.objects.update_or_create(
                submission=sub,
                defaults={
                    'error_message': str(exc),
                    'retry_count': self.request.retries,
                },
            )
            logger.error('[judge] #%s dead-lettered after max retries', submission_id)
