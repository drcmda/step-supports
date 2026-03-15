#!/usr/bin/env python3
"""Run all platform tests: Python, npm, and browser WASM."""

import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.dirname(os.path.abspath(__file__))
NPM_PKG = os.path.join(ROOT, 'packages', 'negative-support')


def run(cmd, label, cwd=ROOT):
    print(f'\n{"=" * 60}')
    print(f'Running: {label}')
    print(f'{"=" * 60}\n')
    result = subprocess.run(cmd, cwd=cwd)
    if result.returncode != 0:
        print(f'\n✗ {label} FAILED (exit code {result.returncode})')
        return False
    return True


def main():
    all_pass = True

    # 1. Python baselines
    if not run([sys.executable, os.path.join(TESTS, 'test_python.py')], 'Python pipeline tests'):
        all_pass = False

    # 2. Build npm package
    if not run(['npm', 'run', 'build'], 'Build npm package', cwd=NPM_PKG):
        print('npm build failed — skipping npm tests')
        all_pass = False
    else:
        # 3. npm baselines
        if not run(['node', os.path.join(TESTS, 'test_npm.mjs')], 'npm package tests', cwd=NPM_PKG):
            all_pass = False

    # 4. Browser build check
    web_dir = os.path.join(ROOT, 'server', 'web')
    if os.path.exists(web_dir):
        if not run(['npm', 'run', 'build'], 'Browser build check', cwd=web_dir):
            all_pass = False

    print(f'\n{"=" * 60}')
    if all_pass:
        print('✓ All platform tests passed')
    else:
        print('✗ Some tests failed')
        sys.exit(1)


if __name__ == '__main__':
    main()
