import { useState, useRef, useCallback, useEffect } from 'react';
import FileDropZone from '../components/FileDropZone';
import ProgressSteps, { type Step } from '../components/ProgressSteps';
import { useAuth } from '../lib/AuthContext';
import { loginUrl } from '../lib/auth';

type Phase = 'upload' | 'processing' | 'done' | 'error';

const FREE_RUNS = 10;

interface Stats {
  pieces: number;
  faces: number;
  volume: number;
}

export default function Try() {
  const auth = useAuth();
  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [margin, setMargin] = useState(0.2);
  const [angle, setAngle] = useState(45);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadUrl3mf, setDownloadUrl3mf] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const licensed = auth.license?.plan === 'lifetime';
  const canGenerate = licensed || auth.freeRemaining > 0;
  const exhausted = !licensed && auth.freeRemaining <= 0 && auth.user !== null;

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
    if (!file || !canGenerate) return;

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
        // Track run server-side
        if (!licensed && auth.license?.token) {
          fetch('/api/free-tier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: auth.license.token }),
          }).then(() => auth.refresh());
        }
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
  }, [file, margin, angle, canGenerate, licensed, auth, downloadUrl, updateStep, markAllDone]);

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

  // Loading state
  if (auth.loading) {
    return (
      <div className="py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center gap-2 text-dim text-sm">
            <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!auth.user) {
    return (
      <div className="py-24">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="label-xs mb-6 tracking-[0.14em]">Browser</p>
          <h1 className="text-2xl font-semibold mb-2 tracking-[-0.01em]">Generate supports</h1>
          <p className="text-dim text-sm mb-10 max-w-[420px] mx-auto leading-relaxed">
            Sign in to generate negative-space supports.
            You get {FREE_RUNS} free runs — no credit card needed.
          </p>
          <a
            href={loginUrl()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium no-underline bg-primary text-base hover:brightness-90 transition-all"
          >
            Sign in
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="py-16">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex items-center gap-3 mb-4">
          <p className="label-xs tracking-[0.14em]">Browser</p>
          {licensed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider text-accent border border-accent/20 bg-accent-glow">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              Licensed
            </span>
          )}
        </div>
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
                  <p className="text-dim text-sm mb-2">You've used all {FREE_RUNS} free runs.</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <a href="/#pricing" className="text-accent text-sm no-underline hover:underline">Buy a license</a>
                  </div>
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
                  {licensed ? (
                    <p className="text-accent/50 text-xs font-mono ml-auto">∞ unlimited</p>
                  ) : (
                    <p className="text-muted text-xs font-mono ml-auto">
                      {auth.freeRemaining}/{FREE_RUNS} free
                    </p>
                  )}
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
