#!/usr/bin/env python3
"""Backwards-compatibility wrapper.

This file re-exports everything from the ``negative_support`` package so
that existing scripts that ``import step_supports`` keep working.

For new code, use::

    from negative_support.cli import compute_supports, load_step, ...
"""

from negative_support.cli import (  # noqa: F401
    compute_supports,
    compute_supports_mesh,
    find_overhang_faces,
    load_mesh,
    load_step,
    main,
)
from negative_support.progress import ProgressDisplay  # noqa: F401

if __name__ == "__main__":
    main()
