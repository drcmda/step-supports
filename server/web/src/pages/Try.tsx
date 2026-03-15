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
    <div className="py-15">
      <div className="max-w-[960px] mx-auto px-6">
        <h1 className="text-3xl mb-3">Generate supports</h1>
        <p className="text-dim mb-2">
          Upload an STL, OBJ, or STEP file and generate negative-space supports.
          Runs entirely in your browser — no install needed.
        </p>

        {phase === 'upload' && (
          <div>
            <FileDropZone onFile={setFile} disabled={exhausted} />

            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-dim">
                <span>Margin (mm)</span>
                <input
                  type="number"
                  min={0.05}
                  max={2.0}
                  step={0.05}
                  value={margin}
                  onChange={(e) => setMargin(parseFloat(e.target.value) || 0.2)}
                  className="w-[72px] px-2 py-1.5 bg-surface border border-border rounded-md text-primary font-mono text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-dim">
                <span>Overhang angle (°)</span>
                <input
                  type="number"
                  min={20}
                  max={80}
                  step={5}
                  value={angle}
                  onChange={(e) => setAngle(parseInt(e.target.value, 10) || 45)}
                  className="w-[72px] px-2 py-1.5 bg-surface border border-border rounded-md text-primary font-mono text-sm"
                />
              </label>

              {exhausted ? (
                <div className="bg-surface border border-border rounded-lg px-5 py-4 flex-1">
                  <p className="text-dim text-sm mb-1">You've used all {MAX_FREE_RUNS} free browser runs.</p>
                  <p className="text-dim text-sm">
                    Get unlimited runs with the CLI:{' '}
                    <a href="/#pricing" className="text-blue-500">Buy a license</a>
                  </p>
                </div>
              ) : (
                <>
                  <button
                    className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium bg-blue-500 text-white border-none cursor-pointer hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleGenerate}
                    disabled={!file}
                  >
                    Generate supports
                  </button>
                  <p className="text-dim text-sm ml-auto">
                    {remaining} of {MAX_FREE_RUNS} free runs remaining
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
              className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium bg-surface text-primary border border-border cursor-pointer hover:border-dim transition-all"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        )}

        {phase === 'done' && stats && (
          <div className="mt-6">
            <div className="bg-surface border border-border rounded-xl p-6 mb-6">
              <h2 className="text-xl mb-4 text-green-500">Supports generated</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                <dt className="text-dim text-sm">Pieces</dt>
                <dd className="font-mono text-sm">{stats.pieces}</dd>
                <dt className="text-dim text-sm">Faces</dt>
                <dd className="font-mono text-sm">{stats.faces.toLocaleString()}</dd>
                <dt className="text-dim text-sm">Volume</dt>
                <dd className="font-mono text-sm">{stats.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm&sup3;</dd>
              </dl>
            </div>
            <div className="flex gap-3">
              <a
                className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium no-underline bg-blue-500 text-white hover:bg-blue-600 transition-all"
                href={downloadUrl!}
                download={outputName}
              >
                Download STL
              </a>
              <button
                className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium bg-surface text-primary border border-border cursor-pointer hover:border-dim transition-all"
                onClick={handleReset}
              >
                Generate another
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="mt-6">
            <p className="bg-[#1a0000] border border-[#5c1a1a] rounded-lg px-5 py-4 text-[#fca5a5] text-sm mb-4">{errorMsg}</p>
            <button
              className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium bg-surface text-primary border border-border cursor-pointer hover:border-dim transition-all"
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
