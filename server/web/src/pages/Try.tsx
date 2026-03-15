import { useState, useRef, useCallback, useEffect } from 'react';
import FileDropZone from '../components/FileDropZone';
import ProgressSteps, { type Step } from '../components/ProgressSteps';

type Phase = 'upload' | 'processing' | 'done' | 'error';

const FREE_RUNS_KEY = 'ns_web_runs';
const IS_DEV = import.meta.env.DEV || window.location.hostname === 'localhost';
const MAX_FREE_RUNS = IS_DEV ? Infinity : 3;

function getRunCount(): number {
  try {
    return parseInt(localStorage.getItem(FREE_RUNS_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function incrementRunCount(): void {
  if (IS_DEV) return;
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
  const [angle, setAngle] = useState(45);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadUrl3mf, setDownloadUrl3mf] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(getRunCount);
  const workerRef = useRef<Worker | null>(null);

  // Cleanup download URLs on unmount
  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      if (downloadUrl3mf) URL.revokeObjectURL(downloadUrl3mf);
    };
  }, [downloadUrl, downloadUrl3mf]);

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
    if (downloadUrl3mf) {
      URL.revokeObjectURL(downloadUrl3mf);
      setDownloadUrl3mf(null);
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
        const stlBlob = new Blob([msg.stlBuffer], { type: 'application/octet-stream' });
        setDownloadUrl(URL.createObjectURL(stlBlob));
        const threemfBlob = new Blob([msg.threemfBuffer], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
        setDownloadUrl3mf(URL.createObjectURL(threemfBlob));
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
          angle,
          minVolume: 1.0,
        },
        [buffer]
      );
    });
  }, [file, margin, angle, runCount, downloadUrl, updateStep, markAllDone]);

  const handleCancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setPhase('upload');
    setSteps([]);
  }, []);

  const handleReset = useCallback(() => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    if (downloadUrl3mf) URL.revokeObjectURL(downloadUrl3mf);
    setDownloadUrl(null);
    setDownloadUrl3mf(null);
    setPhase('upload');
    setFile(null);
    setSteps([]);
    setStats(null);
    setErrorMsg('');
  }, [downloadUrl, downloadUrl3mf]);

  const outputName = file
    ? file.name.replace(/\.[^.]+$/, '_supports.stl')
    : 'supports.stl';
  const outputName3mf = file
    ? file.name.replace(/\.[^.]+$/, '.3mf')
    : 'model.3mf';

  const exhausted = runCount >= MAX_FREE_RUNS;
  const remaining = MAX_FREE_RUNS - runCount;

  return (
    <div className="py-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <p className="label-xs mb-4 tracking-[0.14em]">Browser</p>
        <h1 className="text-2xl font-semibold mb-2 tracking-[-0.01em]">Generate supports</h1>
        <p className="text-dim text-sm mb-8 leading-relaxed max-w-[520px]">
          Upload an STL, OBJ, or STEP file and generate negative-space supports.
          Runs entirely in your browser — no install needed.
        </p>

        {phase === 'upload' && (
          <div>
            <FileDropZone onFile={setFile} disabled={exhausted} />

            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-dim">
                <span className="font-mono text-[11px] tracking-[0.04em] text-muted">Margin (mm)</span>
                <input
                  type="number"
                  min={0.05}
                  max={2.0}
                  step={0.05}
                  value={margin}
                  onChange={(e) => setMargin(parseFloat(e.target.value) || 0.2)}
                  className="w-[72px] px-2 py-1.5 bg-base/60 border border-border rounded-md text-primary font-mono text-xs focus:border-accent/40 focus:outline-none transition-colors"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-dim">
                <span className="font-mono text-[11px] tracking-[0.04em] text-muted">Angle (°)</span>
                <input
                  type="number"
                  min={20}
                  max={80}
                  step={5}
                  value={angle}
                  onChange={(e) => setAngle(parseInt(e.target.value, 10) || 45)}
                  className="w-[72px] px-2 py-1.5 bg-base/60 border border-border rounded-md text-primary font-mono text-xs focus:border-accent/40 focus:outline-none transition-colors"
                />
              </label>

              {exhausted ? (
                <div className="rounded-xl px-5 py-4 flex-1 glass">
                  <p className="text-dim text-sm mb-1">You've used all {MAX_FREE_RUNS} free browser runs.</p>
                  <p className="text-dim text-sm">
                    Get unlimited runs with the CLI:{' '}
                    <a href="/#pricing" className="text-accent no-underline hover:underline">Buy a license</a>
                  </p>
                </div>
              ) : (
                <>
                  <button
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-accent text-base border-none cursor-pointer hover:brightness-110 transition-all glow-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    onClick={handleGenerate}
                    disabled={!file}
                  >
                    Generate supports
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                  <p className="text-muted text-xs font-mono ml-auto">
                    {remaining}/{MAX_FREE_RUNS} free
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div className="mt-6">
            <ProgressSteps steps={steps} />
            <button
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium glass glass-hover text-primary/70 cursor-pointer border-none"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        )}

        {phase === 'done' && stats && (
          <div className="mt-6">
            <div className="rounded-xl p-6 mb-6 border border-accent/20 bg-accent-glow">
              <p className="label-xs text-accent/50 mb-4">Result</p>
              <div className="grid grid-cols-3 gap-6 max-sm:grid-cols-1">
                <div>
                  <p className="font-mono text-[11px] text-muted mb-1">Pieces</p>
                  <p className="font-pixel text-2xl text-accent">{stats.pieces}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] text-muted mb-1">Faces</p>
                  <p className="font-pixel text-2xl text-accent">{stats.faces.toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] text-muted mb-1">Volume</p>
                  <p className="font-pixel text-2xl text-accent">{stats.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-sm text-dim font-mono">mm&sup3;</span></p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <a
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium no-underline bg-accent text-base hover:brightness-110 transition-all glow-accent"
                href={downloadUrl3mf!}
                download={outputName3mf}
              >
                Download 3MF
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </a>
              <a
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium no-underline glass glass-hover text-primary/70"
                href={downloadUrl!}
                download={outputName}
              >
                Download STL
              </a>
              <button
                className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium glass glass-hover text-primary/70 cursor-pointer border-none"
                onClick={handleReset}
              >
                Generate another
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="mt-6">
            <div className="rounded-xl px-5 py-4 mb-4 border border-red-500/20 bg-red-500/5">
              <p className="text-red-400 text-sm">{errorMsg}</p>
            </div>
            <button
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium glass glass-hover text-primary/70 cursor-pointer border-none"
              onClick={handleReset}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
