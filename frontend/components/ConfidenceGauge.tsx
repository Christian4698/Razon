export function ConfidenceGauge({ value }: { value: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.max(0, Math.min(100, value));
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="gauge" aria-label={`Confidence ${safeValue} percent`}>
      <svg width="116" height="116" viewBox="0 0 116 116" role="img">
        <circle
          cx="58"
          cy="58"
          r={radius}
          fill="none"
          stroke="#26302e"
          strokeWidth="10"
        />
        <circle
          cx="58"
          cy="58"
          r={radius}
          fill="none"
          stroke="#33d0b3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="10"
        />
        <text x="58" y="64" textAnchor="middle">
          {safeValue}%
        </text>
      </svg>
    </div>
  );
}
