// The focus trace: one ribbon for the whole session. Blue is focused, red is away.
export default function Trace({ segments, totalMs, height = 24, marks = [], label = 'Focus timeline' }) {
  const W = 1000;
  const H = 24;
  const total = Math.max(totalMs, 1);
  return (
    <svg className="trace" style={{ height }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <rect className="trace-focus" x="0" y="0" width={W} height={H} />
      {segments.map((s, i) => (
        <rect
          key={i}
          className="trace-away"
          x={(s.start / total) * W}
          y="0"
          width={Math.max(((s.end - s.start) / total) * W, 3)}
          height={H}
        />
      ))}
      {marks.map((t, i) => (
        <line key={i} className="trace-mark" x1={(t / total) * W} x2={(t / total) * W} y1="0" y2={H} />
      ))}
    </svg>
  );
}
