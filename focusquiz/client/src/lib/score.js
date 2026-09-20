// Focus score = 100 - away% - 5 x fragmentation events + 10 x quiz accuracy, clamped to 0..100.
export function computeScore({ totalMs, awayMs, fragmented, right, wrong }) {
  const answered = right + wrong;
  const accuracy = answered ? right / answered : null;
  const awayPct = totalMs > 0 ? Math.min(awayMs / totalMs, 1) * 100 : 0;
  const raw = 100 - awayPct - 5 * fragmented + (accuracy == null ? 0 : 10 * accuracy);
  return { score: Math.round(Math.max(0, Math.min(100, raw))), awayPct, accuracy };
}
