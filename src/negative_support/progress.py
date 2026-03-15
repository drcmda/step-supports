"""Multi-step pipeline progress display with spinner and progress bar."""

from __future__ import annotations

import sys
import threading
import time

SPINNER_FRAMES = "\u280b\u2819\u2839\u2838\u283c\u2834\u2826\u2827\u2807\u280f"
BAR_WIDTH = 20


class ProgressDisplay:
    """Multi-step pipeline progress with spinner and progress bar.

    Each step is rendered on a single line. The active step updates
    in-place using carriage return (\\r). When a step completes, its line
    is finalised and the next step starts on a new line. This avoids
    fragile multi-line ANSI cursor movement.

    Falls back to simple line-by-line output when stdout is not a TTY.
    """

    def __init__(self, enabled: bool = True):
        self._tty = sys.stdout.isatty()
        self._enabled = enabled
        self._use_color = self._tty
        self._step_start: float | None = None
        self._step_name: str = ""
        self._progress: tuple[int, int] | None = None
        self._spinner_idx = 0
        self._spinner_thread: threading.Thread | None = None
        self._spinner_stop = threading.Event()
        self._lock = threading.Lock()
        self._line_open = False  # True if current line needs \r to overwrite

    # -- public API --

    def start_step(self, name: str) -> None:
        if not self._enabled:
            return
        with self._lock:
            self._step_name = name
            self._step_start = time.time()
            self._progress = None
            self._spinner_idx = 0
        self._start_spinner()

    def finish_step(self, detail: str = "") -> None:
        if not self._enabled:
            return
        self._stop_spinner()
        with self._lock:
            elapsed = time.time() - self._step_start if self._step_start else 0
            self._progress = None
            line = self._format_done(self._step_name, detail, elapsed)
            self._write_final(line)

    def fail_step(self, detail: str = "") -> None:
        if not self._enabled:
            return
        self._stop_spinner()
        with self._lock:
            elapsed = time.time() - self._step_start if self._step_start else 0
            sym = self._red("\u2717")
            detail_str = self._red(detail) if detail else ""
            time_str = self._dim(f"{elapsed:>5.1f}s")
            line = f"  {sym} {self._step_name:<20s}{detail_str:<27s}{time_str}"
            self._write_final(line)

    def update_progress(self, current: int, total: int) -> None:
        if not self._enabled:
            return
        with self._lock:
            self._progress = (current, total)

    # -- rendering --

    def _render_active(self) -> None:
        """Render the active step line in-place (called by spinner thread)."""
        with self._lock:
            elapsed = time.time() - self._step_start if self._step_start else 0
            frame = SPINNER_FRAMES[self._spinner_idx % len(SPINNER_FRAMES)]
            sym = self._cyan(frame)
            name_str = f"{self._step_name:<20s}"
            time_str = self._dim(f"{elapsed:>5.1f}s")

            if self._progress and self._progress[1] > 0:
                cur, tot = self._progress
                pct = cur / tot
                filled = int(pct * BAR_WIDTH)
                bar = self._cyan("\u2588" * filled) + self._dim("\u2591" * (BAR_WIDTH - filled))
                pct_str = f"{pct * 100:>3.0f}%"
                line = f"  {sym} {name_str}{bar} {pct_str}  {time_str}"
            else:
                line = f"  {sym} {name_str}{'':<27s}{time_str}"

            if self._tty:
                sys.stdout.write(f"\r\033[2K{line}")
                sys.stdout.flush()
                self._line_open = True

    def _write_final(self, line: str) -> None:
        """Write a completed step line (permanent, not overwritten)."""
        if self._tty and self._line_open:
            sys.stdout.write(f"\r\033[2K{line}\n")
        else:
            sys.stdout.write(f"{line}\n")
        sys.stdout.flush()
        self._line_open = False

    def _format_done(self, name: str, detail: str, elapsed: float) -> str:
        sym = self._green("\u2713")
        time_str = self._dim(f"{elapsed:>5.1f}s")
        detail_str = self._dim(detail) if detail else ""
        return f"  {sym} {name:<20s}{detail_str:<27s}{time_str}"

    # -- spinner thread --

    def _start_spinner(self) -> None:
        self._stop_spinner()
        self._spinner_stop.clear()
        self._spinner_thread = threading.Thread(target=self._spinner_loop, daemon=True)
        self._spinner_thread.start()

    def _stop_spinner(self) -> None:
        if self._spinner_thread and self._spinner_thread.is_alive():
            self._spinner_stop.set()
            self._spinner_thread.join(timeout=1)
            self._spinner_thread = None

    def _spinner_loop(self) -> None:
        while not self._spinner_stop.is_set():
            with self._lock:
                self._spinner_idx += 1
            self._render_active()
            self._spinner_stop.wait(0.1)

    # -- ANSI helpers --

    def _green(self, s: str) -> str:
        return f"\033[32m{s}\033[0m" if self._use_color else s

    def _red(self, s: str) -> str:
        return f"\033[31m{s}\033[0m" if self._use_color else s

    def _cyan(self, s: str) -> str:
        return f"\033[36m{s}\033[0m" if self._use_color else s

    def _dim(self, s: str) -> str:
        return f"\033[2m{s}\033[0m" if self._use_color else s
