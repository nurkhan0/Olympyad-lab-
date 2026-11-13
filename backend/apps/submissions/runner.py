import math
import os
import signal
import subprocess
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings

IS_POSIX = os.name == 'posix'
if IS_POSIX:
    import resource


# ---------------------------------------------------------------------------
# Judge subprocess hardening
#
# NOTE: this REDUCES the risk of executing user code (no secrets in the child
# environment, POSIX rlimits, whole-process-group kill on timeout) but it is
# NOT real isolation: user code still runs as the worker's OS user, with that
# user's filesystem permissions and unrestricted network access. Treat this as
# defense in depth; a true sandbox (namespaces/seccomp/gVisor/firejail) is
# required for hostile tenants.
# ---------------------------------------------------------------------------


def build_judge_env(home_dir: str) -> Dict[str, str]:
    """Minimal environment for compile/run subprocesses.

    Exactly three keys — PATH (inherited from the worker), HOME=<tmpdir> and
    LANG=C.UTF-8 — so worker secrets (SECRET_KEY, JWT_*, POSTGRES_*, REDIS_URL)
    never reach user code.
    """
    return {
        'PATH': os.environ.get('PATH', '/usr/local/bin:/usr/bin:/bin'),
        'HOME': home_dir,
        'LANG': 'C.UTF-8',
    }


# Rlimit defaults; every value is overridable via Django settings (see
# judge_limit_profile for the setting names and the reasoning).
JUDGE_RLIMIT_FSIZE_BYTES_DEFAULT = 64 * 1024 * 1024  # 64 MiB of file output
JUDGE_RLIMIT_NPROC_DEFAULT = 256  # processes/threads a child may create
JUDGE_RLIMIT_AS_BYTES_DEFAULT = 1024 * 1024 * 1024  # 1 GiB address space
JUDGE_RLIMIT_CPU_MARGIN_S_DEFAULT = 2.0  # CPU limit sits ABOVE the wall timeout
JUDGE_JAVA_XMX_DEFAULT = '128m'  # JVM heap cap (RLIMIT_AS is skipped for java)


def judge_limit_profile(
    language: str,
    phase: str,
    wall_timeout_s: float,
) -> Dict[str, Optional[int]]:
    """RLimit values for one compile/run step (applied on POSIX only).

    Configurable via Django settings; the constants above are the defaults:

    - JUDGE_RLIMIT_FSIZE_BYTES (64 MiB): max size of files the child may write.
    - JUDGE_RLIMIT_NPROC (256): skipped for java (the JVM spawns many threads)
      and for the compile phase (compilers are trusted toolchains).
    - JUDGE_RLIMIT_AS_BYTES (1 GiB): skipped for java — the JVM reserves a large
      address space and breaks under a tight RLIMIT_AS; its heap is capped with
      -Xmx in the run command instead.
    - JUDGE_RLIMIT_CPU_MARGIN_S (2.0): RLIMIT_CPU = wall timeout + margin. The
      margin keeps the kernel-side kill ABOVE the judge's own wall timeout so
      an over-running program is still reported as TLE (a SIGXCPU/SIGKILL death
      would otherwise be indistinguishable from a runtime error → RE).
    - JUDGE_JAVA_XMX ('128m'): JVM heap passed as -Xmx in the java run command.
    """
    fsize = int(getattr(settings, 'JUDGE_RLIMIT_FSIZE_BYTES', JUDGE_RLIMIT_FSIZE_BYTES_DEFAULT))
    margin = float(getattr(settings, 'JUDGE_RLIMIT_CPU_MARGIN_S', JUDGE_RLIMIT_CPU_MARGIN_S_DEFAULT))
    cpu = max(math.ceil(wall_timeout_s + margin), 2)
    profile: Dict[str, Optional[int]] = {
        'fsize_bytes': fsize,
        'cpu_seconds': cpu,
        'nproc': None,
        'as_bytes': None,
    }
    if phase == 'run' and language != 'java':
        profile['nproc'] = int(getattr(settings, 'JUDGE_RLIMIT_NPROC', JUDGE_RLIMIT_NPROC_DEFAULT))
        profile['as_bytes'] = int(getattr(settings, 'JUDGE_RLIMIT_AS_BYTES', JUDGE_RLIMIT_AS_BYTES_DEFAULT))
    return profile


def _make_rlimit_preexec(profile: Dict[str, Optional[int]]):
    """Build a preexec_fn applying rlimits in the forked child (POSIX only).

    Must stay dependency-free: it runs between fork() and exec(), where heap
    allocations, locks and Django objects are unsafe to touch.
    """
    def _apply_rlimits():
        fsize = profile['fsize_bytes']
        cpu = profile['cpu_seconds']
        nproc = profile['nproc']
        as_bytes = profile['as_bytes']
        if fsize:
            resource.setrlimit(resource.RLIMIT_FSIZE, (fsize, fsize))
        if nproc:
            resource.setrlimit(resource.RLIMIT_NPROC, (nproc, nproc))
        if as_bytes:
            resource.setrlimit(resource.RLIMIT_AS, (as_bytes, as_bytes))
        if cpu:
            # SIGXCPU at the soft limit, SIGKILL shortly after (hard = soft + 1).
            resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    return _apply_rlimits


def _kill_judge_process_tree(proc: subprocess.Popen) -> None:
    """Kill the judge child and its descendants after a timeout."""
    if IS_POSIX:
        # start_new_session=True made the child a session/group leader, so one
        # killpg() reaps the whole tree (fork bombs, leaked JVM threads, ...).
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
    else:
        proc.kill()


def run_judge_subprocess(
    cmd: List[str],
    *,
    cwd: str,
    env: Dict[str, str],
    wall_timeout_s: float,
    limits: Optional[Dict[str, Optional[int]]] = None,
    stdin_text: Optional[str] = None,
) -> Tuple[int, bytes, bytes, bool]:
    """Run one judge step (compile or run) in a hardened subprocess.

    Returns (returncode, stdout, stderr, timed_out). I/O stays bytes so every
    call site decodes exactly as it did before the hardening. On timeout the
    whole process group is killed (POSIX) and timed_out=True is returned
    instead of raising, so the verdict mapping stays in the judge code.

    NOTE: risk reduction, NOT isolation (see the block comment above).
    """
    popen_kwargs: Dict[str, Any] = {
        'cwd': cwd,
        'env': env,
        'stdin': subprocess.PIPE,
        'stdout': subprocess.PIPE,
        'stderr': subprocess.PIPE,
    }
    if IS_POSIX:
        popen_kwargs['start_new_session'] = True
        if limits is not None:
            popen_kwargs['preexec_fn'] = _make_rlimit_preexec(limits)

    proc = subprocess.Popen(cmd, **popen_kwargs)
    stdin = stdin_text.encode('utf-8') if stdin_text is not None else None
    try:
        out, err = proc.communicate(input=stdin, timeout=wall_timeout_s)
        return proc.returncode, out, err, False
    except subprocess.TimeoutExpired:
        _kill_judge_process_tree(proc)
        try:
            proc.communicate(timeout=5)
        except Exception:
            pass
        return proc.returncode, b'', b'', True


def _run_python(code: str, stdin: str, timeout: float) -> Tuple[str, Optional[str]]:
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, 'solution.py')
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write(code)

        returncode, out, err, timed_out = run_judge_subprocess(
            ['python3', path],
            cwd=tmpdir,
            env=build_judge_env(tmpdir),
            wall_timeout_s=timeout,
            limits=judge_limit_profile('python', 'run', timeout),
            stdin_text=stdin,
        )
        if timed_out:
            return '', 'Time Limit Exceeded'
        if returncode != 0:
            err_text = err.decode('utf-8').strip()
            return '', err_text or f'Exit code {returncode}'
        return out.decode('utf-8'), None


def _run_stub(language: str) -> Tuple[str, Optional[str]]:
    return '', f'Test run for {language} is not available yet (Phase 4 sandbox).'


def execute_code(code: str, language: str, stdin: str, timeout: float) -> Tuple[str, Optional[str]]:
    if language == 'python':
        return _run_python(code, stdin, timeout)
    return _run_stub(language)


def run_sample_tests(problem, code: str, language: str, timeout: float = 5.0) -> List[Dict[str, Any]]:
    samples = problem.test_cases.filter(is_sample=True).order_by('order', 'created_at')
    results: List[Dict[str, Any]] = []
    started = time.monotonic()

    for test_case in samples:
        remaining = timeout - (time.monotonic() - started)
        if remaining <= 0:
            results.append({
                'input': test_case.input,
                'expected': test_case.expected_output,
                'got': '',
                'passed': False,
            })
            break

        got, error = execute_code(code, language, test_case.input, timeout=remaining)
        expected = test_case.expected_output
        passed = error is None and got.rstrip('\n') == expected.rstrip('\n')

        results.append({
            'input': test_case.input,
            'expected': expected,
            'got': error if error else got,
            'passed': passed,
        })

    return results
