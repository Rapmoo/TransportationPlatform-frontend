export default function StepProgress({ current, total, labels = [] }) {
  return (
    <div className="step-progress" aria-label={labels.filter(Boolean).join(', ')}>
      <div
        className="step-progress-grid"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => {
          const idx = i + 1;
          const isDone = idx < current;
          const isCurrent = idx === current;
          return (
            <div
              key={idx}
              className={`step-progress-item${isDone ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}
            >
              <div className={`step-label${isCurrent ? ' is-current' : ''}`}>
                {labels[idx - 1] || '\u00a0'}
              </div>
              <div className="step-progress-line" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </div>
  );
}