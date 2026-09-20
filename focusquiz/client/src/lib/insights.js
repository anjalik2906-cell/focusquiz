import { fmt, plural } from './format.js';

// Plain-language observations computed from the event log. No AI involved.
export function buildInsights(s) {
  if (!s.distractions && !s.fragmented && !s.idleEvents) {
    return ['No distractions were flagged. Your attention held for the whole session.'];
  }
  const out = [];
  if (s.firstDistractionMs != null) {
    out.push(`Your first distraction came ${fmt(s.firstDistractionMs)} into the session.`);
  }
  if (s.distractTimes.length >= 2) {
    const t = s.distractTimes.slice().sort((a, b) => a - b);
    const gaps = t.slice(1).map((v, i) => v - t[i]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    out.push(`Distractions came about every ${fmt(avg)}. A short break at that interval may help.`);
  }
  const trouble = (c) => c.distractions * 2 + c.wrong;
  const worst = s.chunks.slice().sort((a, b) => trouble(b) - trouble(a))[0];
  if (worst && trouble(worst) > 0) {
    out.push(
      `Chunk ${worst.index + 1} caused the most trouble: ${plural(worst.distractions, 'distraction')} and ${plural(worst.wrong, 'missed question')}.`
    );
  }
  if (s.accuracy != null) {
    out.push(
      s.accuracy >= 0.8
        ? 'Recall stayed strong after distractions.'
        : s.accuracy < 0.5
          ? 'You missed most questions after distractions. Re-read the flagged chunks before moving on.'
          : 'Recall was mixed. Review the chunks listed below.'
    );
  }
  if (s.idleEvents) out.push(`You went idle ${plural(s.idleEvents, 'time')} with the tab still open.`);
  return out;
}
