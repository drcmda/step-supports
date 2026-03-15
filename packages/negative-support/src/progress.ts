/**
 * Terminal progress display with spinner and step tracking.
 * Mirrors the Python ProgressDisplay from progress.py.
 */

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export class ProgressDisplay {
  private enabled: boolean;
  private isTTY: boolean;
  private frameIdx = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentStep = '';
  private currentDetail = '';

  constructor(enabled = true) {
    this.enabled = enabled;
    this.isTTY = !!process.stdout.isTTY;
  }

  startStep(name: string, detail = ''): void {
    if (!this.enabled) return;

    // Finish previous step if any
    if (this.currentStep) this.finishLine('✓', GREEN);

    this.currentStep = name;
    this.currentDetail = detail;
    this.frameIdx = 0;

    if (this.isTTY) {
      this.renderSpinner();
      this.timer = setInterval(() => this.renderSpinner(), 80);
    } else {
      const d = detail ? ` ${DIM}${detail}${RESET}` : '';
      process.stdout.write(`  ${CYAN}…${RESET} ${name}${d}\n`);
    }
  }

  finishStep(detail = ''): void {
    if (!this.enabled) return;
    if (detail) this.currentDetail = detail;
    this.finishLine('✓', GREEN);
    this.currentStep = '';
  }

  failStep(detail = ''): void {
    if (!this.enabled) return;
    if (detail) this.currentDetail = detail;
    this.finishLine('✗', RED);
    this.currentStep = '';
  }

  private renderSpinner(): void {
    const frame = FRAMES[this.frameIdx % FRAMES.length];
    this.frameIdx++;
    const d = this.currentDetail ? ` ${DIM}${this.currentDetail}${RESET}` : '';
    process.stdout.write(`\r  ${CYAN}${frame}${RESET} ${this.currentStep}${d}  `);
  }

  private finishLine(icon: string, color: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const d = this.currentDetail ? ` ${DIM}${this.currentDetail}${RESET}` : '';
    if (this.isTTY) {
      process.stdout.write(`\r  ${color}${icon}${RESET} ${this.currentStep}${d}  \n`);
    }
  }

  /** Create an onProgress callback that drives this display. */
  onProgress = (step: string, detail?: string): void => {
    this.startStep(step, detail || '');
  };

  /** Finish the current step (call after generateSupports completes). */
  done(): void {
    if (this.currentStep) this.finishStep();
  }

  /** Mark current step as failed. */
  fail(msg: string): void {
    if (this.currentStep) this.failStep(msg);
  }
}
