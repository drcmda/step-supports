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
    <div className="progress-steps">
      {steps.map((step, i) => (
        <div key={i} className={`progress-step progress-step--${step.status}`}>
          <div className="progress-step__indicator">
            {step.status === 'done' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {step.status === 'active' && <div className="spinner" />}
            {step.status === 'pending' && <div className="progress-step__dot" />}
          </div>
          <div className="progress-step__content">
            <span className="progress-step__name">{step.name}</span>
            {step.detail && <span className="progress-step__detail">{step.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
