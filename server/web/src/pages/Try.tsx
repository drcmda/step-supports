import { useState, useRef, useCallback, useEffect } from 'react';
import FileDropZone from '../components/FileDropZone';
import ProgressSteps, { type Step } from '../components/ProgressSteps';

type Phase = 'upload' | 'processing' | 'done' | 'error';

const FREE_RUNS_KEY = 'ns_web_runs';
const MAX_FREE_RUNS = 3;

function getRunCount(): number {
  try {
    return parseInt(localStorage.getItem(FREE_RUNS_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function incrementRunCount(): void {
  try {
    localStorage.setItem(FREE_RUNS_KEY, String(getRunCount() + 1));
  } catch {
    // ignore
  }
}

interface Stats {
  pieces: number;
  faces: number;
  volume: number;
}

export default function Try() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [margin, setMargin] = useState(0.2);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(getRunCount);
  const workerRef = useRef<Worker | null>(null);

  // Cleanup download URL on unmount
  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const updateStep = useCallback((name: string, detail?: string) => {
    setSteps((prev) => {
      const existing = prev.find((s) => s.name === name);
      if (existing) {
        return prev.map((s) =>
          s.name === name ? { ...s, detail, status: 'active' as const } : s
        );
      }
      // Mark previous active steps as done
      const updated = prev.map((s) =>
        s.status === 'active' ? { ...s, status: 'done' as const } : s
      );
      return [...updated, { name, detail, status: 'active' as const }];
    });
  }, []);

  const markAllDone = useCallback(() => {
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as const })));
  }, []);

  const handleGenerate = useCallback(() => {
    if (!file) return;
    if (runCount >= MAX_FREE_RUNS) return;

    setPhase('processing');
    setSteps([]);
    setStats(null);
    setErrorMsg('');
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    // Create worker
    const worker = new Worker(
      new URL('../workers/supports.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        updateStep(msg.step, msg.detail);
      } else if (msg.type === 'result') {
        markAllDone();
        const blob = new Blob([msg.stlBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setStats(msg.stats);
        setPhase('done');
        incrementRunCount();
        setRunCount(getRunCount());
        worker.terminate();
      } else if (msg.type === 'error') {
        setErrorMsg(msg.message);
        setPhase('error');
        worker.terminate();
      }
    };

    worker.onerror = (err) => {
      setErrorMsg(err.message || 'Worker crashed unexpectedly.');
      setPhase('error');
      worker.terminate();
    };

    // Transfer file buffer to worker
    file.arrayBuffer().then((buffer) => {
      worker.postMessage(
        {
          type: 'generate',
          fileBuffer: buffer,
          fileName: file.name,
          margin,
          minVolume: 1.0,
        },
        [buffer]
      );
    });
  }, [file, margin, runCount, downloadUrl, updateStep, markAllDone]);

  const handleCancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setPhase('upload');
    setSteps([]);
  }, []);

  const handleReset = useCallback(() => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setPhase('upload');
    setFile(null);
    setSteps([]);
    setStats(null);
    setErrorMsg('');
  }, [downloadUrl]);

  const outputName = file
    ? file.name.replace(/\.[^.]+$/, '_supports.stl')
    : 'supports.stl';

  const exhausted = runCount >= MAX_FREE_RUNS;
  const remaining = MAX_FREE_RUNS - runCount;

  return (
    <div className="try-page">
      <div className="container">
        <h1>Try it in your browser</h1>
        <p className="try-page__subtitle">
          Upload an STL or OBJ file and generate negative-space supports right here.
          No install needed.
        </p>
        <p className="try-page__warning">
          Browser processing may take a few minutes for complex models.
          For fastest results, install the CLI:{' '}
          <code>pip install negative-support</code>
        </p>

        {phase === 'upload' && (
          <div className="try-page__upload">
            <FileDropZone onFile={setFile} disabled={exhausted} />

            <div className="try-page__controls">
              <label className="try-page__margin">
                <span>Margin (mm)</span>
                <input
                  type="number"
                  min={0.05}
                  max={2.0}
                  step={0.05}
                  value={margin}
                  onChange={(e) => setMargin(parseFloat(e.target.value) || 0.2)}
                />
              </label>

              {exhausted ? (
                <div className="try-page__exhausted">
                  <p>You've used all {MAX_FREE_RUNS} free browser runs.</p>
                  <p>
                    Get unlimited runs with the CLI:{' '}
                    <a href="/#pricing">Buy a license</a>
                  </p>
                </div>
              ) : (
                <>
                  <button
                    className="btn btn--primary"
                    onClick={handleGenerate}
                    disabled={!file}
                  >
                    Generate supports
                  </button>
                  <p className="try-page__runs">
                    {remaining} of {MAX_FREE_RUNS} free runs remaining
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div className="try-page__processing">
            <ProgressSteps steps={steps} />
            <button className="btn btn--secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {phase === 'done' && stats && (
          <div className="try-page__done">
            <div className="try-page__stats">
              <h2>Supports generated</h2>
              <dl>
                <dt>Pieces</dt>
                <dd>{stats.pieces}</dd>
                <dt>Faces</dt>
                <dd>{stats.faces.toLocaleString()}</dd>
                <dt>Volume</dt>
                <dd>{stats.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm&sup3;</dd>
              </dl>
            </div>
            <div className="try-page__actions">
              <a className="btn btn--primary" href={downloadUrl!} download={outputName}>
                Download STL
              </a>
              <button className="btn btn--secondary" onClick={handleReset}>
                Generate another
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="try-page__error">
            <p className="try-page__error-msg">{errorMsg}</p>
            <button className="btn btn--secondary" onClick={handleReset}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
