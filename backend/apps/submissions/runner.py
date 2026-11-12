import os
import subprocess
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple


def _run_python(code: str, stdin: str, timeout: float) -> Tuple[str, Optional[str]]:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as tmp:
        tmp.write(code)
        path = tmp.name

    try:
        result = subprocess.run(
            ['python3', path],
            input=stdin.encode(),
            capture_output=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            err = result.stderr.decode().strip() or f'Exit code {result.returncode}'
            return '', err
        return result.stdout.decode(), None
    except subprocess.TimeoutExpired:
        return '', 'Time Limit Exceeded'
    finally:
        os.unlink(path)


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
