import os
import subprocess
import tempfile
import time

from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
from celery.utils.log import get_task_logger
from django.conf import settings

from apps.submissions.runner import (
    build_judge_env,
    judge_limit_profile,
    run_judge_subprocess,
)

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
        # -Xmx caps the JVM heap: RLIMIT_AS/RLIMIT_NPROC are deliberately NOT
        # applied to java (the JVM reserves a large address space and spawns
        # many threads, so tight rlimits break it) — see judge_limit_profile().
        'run': ['java', '-Xmx{java_xmx}', '-cp', '{dir}', 'Main'],
    },
}

COMPILE_TIMEOUT_S = 15


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
    java_xmx = str(getattr(settings, 'JUDGE_JAVA_XMX', '256m'))

    with tempfile.TemporaryDirectory() as tmpdir:
        judge_env = build_judge_env(tmpdir)

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
            returncode, _out, _err, timed_out = run_judge_subprocess(
                compile_cmd,
                cwd=tmpdir,
                env=judge_env,
                wall_timeout_s=COMPILE_TIMEOUT_S,
                limits=judge_limit_profile(lang, 'compile', COMPILE_TIMEOUT_S),
            )
            if timed_out:
                # Preserved pre-hardening semantics: a hung compile is an
                # infrastructure failure (task retry), not a compile error.
                raise subprocess.TimeoutExpired(compile_cmd, COMPILE_TIMEOUT_S)
            if returncode != 0:
                return 'CE', 0, 0

        max_time_ms = 0
        max_memory_kb = 0

        for test_case in test_cases:
            run_cmd = [
                part.format(file=src_path, exe=exe_path, dir=tmpdir, java_xmx=java_xmx)
                for part in cfg['run']
            ]
            start = time.perf_counter()
            returncode, out_bytes, _err, timed_out = run_judge_subprocess(
                run_cmd,
                cwd=tmpdir,
                env=judge_env,
                wall_timeout_s=time_limit_s + 1,
                limits=judge_limit_profile(lang, 'run', time_limit_s + 1),
                stdin_text=test_case['input'],
            )
            if timed_out:
                return 'TLE', int(time_limit_s * 1000), max_memory_kb

            elapsed_ms = int((time.perf_counter() - start) * 1000)
            max_time_ms = max(max_time_ms, elapsed_ms)

            if elapsed_ms > time_limit_ms:
                return 'TLE', elapsed_ms, max_memory_kb

            if returncode != 0:
                return 'RE', elapsed_ms, max_memory_kb

            got = out_bytes.decode('utf-8').strip()
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
