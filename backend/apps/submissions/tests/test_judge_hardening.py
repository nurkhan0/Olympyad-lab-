"""Judge hardening tests.

Covers:
- the judge child environment contains no secrets (exactly PATH/HOME/LANG);
- hello-world submissions still judge to AC (Java; C++ where the local
  toolchain supports -std=c++17);
- an over-running submission judges to TLE.

Platform notes: rlimits and the process-group kill are POSIX-only features.
The whole code path runs on every OS, but enforcement of the POSIX-specific
bits (and the C++17 toolchain check) skip on non-POSIX hosts with an explicit
reason. Production runs the judge inside the Linux backend image, where no
skip applies.
"""
import os
import shutil
import subprocess
import tempfile

import pytest

from apps.problems.factories import ProblemFactory, TestCaseFactory
from apps.submissions.factories import SubmissionFactory
from apps.submissions.runner import execute_code
from apps.submissions.tasks import run_judge

SECRET_LEAK_PROBE = (
    "import os\n"
    "print(os.environ.get('SECRET_KEY'))\n"
    "print(len(os.environ))\n"
)

JAVA_HELLO = (
    "public class Main {\n"
    "    public static void main(String[] args) {\n"
    "        System.out.println(\"Hello, World!\");\n"
    "    }\n"
    "}\n"
)

CPP_HELLO = (
    "#include <iostream>\n"
    "int main() { std::cout << \"Hello, World!\" << std::endl; return 0; }\n"
)


def test_judge_env_has_no_secrets(monkeypatch):
    """User code must not see worker secrets; the env is exactly 3 keys.

    The worker process env DOES contain SECRET_KEY (faked here via monkeypatch
    so the assertion is meaningful even outside the repo's real .env): if the
    judge leaked the parent environment, the probe would print it.
    """
    monkeypatch.setenv('SECRET_KEY', 'fake-secret-0123456789abcdef')
    got, error = execute_code(SECRET_LEAK_PROBE, 'python', '', timeout=10)
    assert error is None, error
    secret_line, env_size_line = got.strip().splitlines()
    assert secret_line == 'None'  # SECRET_KEY absent from the judge env
    assert int(env_size_line) == 3  # exactly PATH, HOME, LANG


@pytest.mark.django_db
def test_java_hello_world_ac():
    if shutil.which('javac') is None or shutil.which('java') is None:
        pytest.skip('JDK (javac/java) not installed on this machine')
    problem = ProblemFactory(status='published', time_ms=5000)
    TestCaseFactory(problem=problem, input='', expected_output='Hello, World!')
    submission = SubmissionFactory(problem=problem, language='java', code=JAVA_HELLO)

    verdict, time_ms, _memory_kb = run_judge(submission)

    assert verdict == 'AC', f'expected AC, got {verdict}'
    assert time_ms > 0


@pytest.mark.django_db
def test_cpp_hello_world_ac():
    gpp = shutil.which('g++')
    if gpp is None:
        pytest.skip('g++ not installed on this machine')

    # The backend image (Debian slim) ships a modern g++ that handles the
    # repo's fixed compile flags; some local Windows toolchains predate C++17
    # entirely. Probe the real flags instead of guessing the version.
    probe_dir = tempfile.mkdtemp()
    probe_src = os.path.join(probe_dir, 'probe.cpp')
    with open(probe_src, 'w', encoding='utf-8') as handle:
        handle.write('int main() { return 0; }\n')
    probe = subprocess.run(
        ['g++', '-O2', '-std=c++17', '-o', os.path.join(probe_dir, 'probe'), probe_src],
        capture_output=True,
    )
    if probe.returncode != 0:
        reason = probe.stderr.decode('utf-8', errors='replace').strip().splitlines()
        pytest.skip(
            'local g++ cannot compile the repo flags (-std=c++17): '
            f'{reason[0] if reason else "unknown error"}; '
            'the C++ judge path is covered on Linux (backend image)'
        )

    problem = ProblemFactory(status='published', time_ms=5000)
    TestCaseFactory(problem=problem, input='', expected_output='Hello, World!')
    submission = SubmissionFactory(problem=problem, language='cpp', code=CPP_HELLO)

    verdict, time_ms, _memory_kb = run_judge(submission)

    assert verdict == 'AC', f'expected AC, got {verdict}'
    assert time_ms > 0


@pytest.mark.django_db
def test_python_infinite_loop_tle():
    problem = ProblemFactory(status='published', time_ms=300)
    TestCaseFactory(problem=problem, input='', expected_output='never printed')
    submission = SubmissionFactory(
        problem=problem,
        language='python',
        code='while True:\n    pass\n',
    )

    verdict, time_ms, _memory_kb = run_judge(submission)

    assert verdict == 'TLE', f'expected TLE, got {verdict}'
    # Pre-hardening semantics preserved: TLE is reported with the nominal limit.
    assert time_ms == 300
