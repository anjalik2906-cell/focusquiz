import { useEffect, useRef, useState } from 'react';
import Bar from './Bar.jsx';
import Trace from './Trace.jsx';
import { saveSession } from '../lib/api.js';
import { fmt, plural } from '../lib/format.js';

function summaryText(s) {
  const lines = [
    'FocusQuiz session summary',
    `Focus score: ${s.focusScore}`,
    `Length ${fmt(s.totalMs)}, away ${fmt(s.awayMs)} (${Math.round(s.awayPct)}%)`,
    `${plural(s.distractions, 'distraction')}, ${s.fragmented} fragmented, ${s.idleEvents} idle`,
    s.accuracy == null ? 'Quiz accuracy: no answers' : `Quiz accuracy: ${Math.round(s.accuracy * 100)}%`,
    '',
    'Revisit:'
  ];
  if (!s.revisit.length) lines.push('- Nothing flagged');
  s.revisit.forEach((i) => lines.push(`- Chunk ${i + 1}: ${s.chunks[i].preview}...`));
  return lines.join('\n');
}

export default function Dashboard({ summary: s, onNew }) {
  const [save, setSave] = useState('saving'); // saving | saved | failed
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  const doSave = () => {
    setSave('saving');
    saveSession(s)
      .then(() => setSave('saved'))
      .catch(() => setSave('failed'));
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    doSave();
  }, []);

  const copy = () =>
    navigator.clipboard.writeText(summaryText(s)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  const maxHeat = Math.max(1, ...s.chunks.map((c) => c.distractions));

  return (
    <>
      <Bar />
      <main className="shell dash">
        <section className="dash-hero">
          <h1>Session complete</h1>
          <p className="lede">
            You stayed focused for {fmt(s.totalMs - s.awayMs)} of {fmt(s.totalMs)}
            {s.distractions ? ` and got pulled away ${plural(s.distractions, 'time')}` : ' with no distractions'}.
          </p>
          <Trace segments={s.segments} totalMs={s.totalMs} height={56} marks={s.distractTimes} label="Focus versus distraction timeline" />
          <div className="axis">
            <span>0:00</span>
            <span>
              <i className="key key-focus" /> focused <i className="key key-away" /> away
            </span>
            <span>{fmt(s.totalMs)}</span>
          </div>
        </section>

        <section className="dash-grid">
          <div>
            <h2>Numbers</h2>
            <dl className="facts wide">
              <div>
                <dt>Focus score</dt>
                <dd className="score">{s.focusScore}</dd>
              </div>
              <div>
                <dt>Time away</dt>
                <dd>
                  {fmt(s.awayMs)} ({Math.round(s.awayPct)}%)
                </dd>
              </div>
              <div>
                <dt>Distractions</dt>
                <dd>{s.distractions}</dd>
              </div>
              <div>
                <dt>Fragmented attention</dt>
                <dd>{s.fragmented}</dd>
              </div>
              <div>
                <dt>Idle flags</dt>
                <dd>{s.idleEvents}</dd>
              </div>
              <div>
                <dt>Quiz accuracy</dt>
                <dd>{s.accuracy == null ? 'No answers' : `${Math.round(s.accuracy * 100)}% (${s.quizRight} of ${s.quizRight + s.quizWrong})`}</dd>
              </div>
            </dl>
            <p className="muted small">
              Focus score is 100, minus the percent of time away, minus 5 per fragmentation event, plus up to 10 for quiz accuracy.
            </p>
          </div>

          <div>
            <h2>What stood out</h2>
            <ul className="insights">
              {s.insights.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2>Chunk by chunk</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Chunk</th>
                  <th>Text</th>
                  <th>Read</th>
                  <th>Distraction heat</th>
                  <th>Right / wrong</th>
                </tr>
              </thead>
              <tbody>
                {s.chunks.map((c) => (
                  <tr key={c.index}>
                    <td>{c.index + 1}</td>
                    <td className="preview">{c.preview}...</td>
                    <td>{c.dwell}s</td>
                    <td>
                      <div className="heat-track">
                        <div className="heat" style={{ width: `${(c.distractions / maxHeat) * 100}%` }} />
                      </div>
                    </td>
                    <td>
                      {c.right} / {c.wrong}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>Chunks to revisit</h2>
          {s.revisit.length === 0 ? (
            <p className="muted">Nothing flagged. You can move on.</p>
          ) : (
            s.revisit.map((i) => (
              <details key={i} className="revisit">
                <summary>
                  Chunk {i + 1}: {s.chunks[i].preview}...
                </summary>
                <p>{s.chunks[i].text}</p>
              </details>
            ))
          )}
        </section>

        <div className="actions">
          <button className="btn" onClick={onNew}>
            Start a new session
          </button>
          <button className="btn btn-quiet" onClick={copy}>
            {copied ? 'Copied' : 'Copy summary'}
          </button>
          <span className="muted small" role="status">
            {save === 'saving' && 'Saving to your history...'}
            {save === 'saved' && 'Saved to your history.'}
            {save === 'failed' && (
              <>
                Could not save. <button className="linklike" onClick={doSave}>Try again</button>
              </>
            )}
          </span>
        </div>
      </main>
    </>
  );
}
