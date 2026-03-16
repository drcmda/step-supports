export interface Step {
  name: string;
  detail?: string;
  status: 'pending' | 'active' | 'done';
}

interface Props {
  steps: Step[];
}

export default function ProgressSteps({ steps }: Props) {
  return (
    <div className="mb-6">
      {steps.map((step, i) => (
        <div key={i} className={`flex items-center gap-3 py-2.5 ${
          step.status === 'done' ? 'text-accent' : step.status === 'active' ? 'text-primary' : 'text-muted'
        }`}>
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            {step.status === 'done' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {step.status === 'active' && (
              <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
            )}
            {step.status === 'pending' && (
              <div className="w-1.5 h-1.5 rounded-full bg-border" />
            )}
          </div>
          <div className="flex gap-3 items-baseline">
            <span className="font-medium text-sm">{step.name}</span>
            {step.detail && <span className="text-muted text-xs font-mono">{step.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
