import { Fragment, useEffect, useState, useSyncExternalStore } from 'react';
import Bar from './Bar.jsx';
import Trace from './Trace.jsx';
import QuizCard from './QuizCard.jsx';
import { fmt } from '../lib/format.js';

const STATUS_LABEL = { focused: 'Focused', away: 'Away', idle: 'Idle' };

function nearestChunk() {
  const mid = window.innerHeight / 2;
  let best = null;
  let bestDist = Infinity;
  document.querySelectorAll('[data-chunk]').forEach((el) => {
    const r = el.getBoundingClientRect();
    const d = Math.abs((r.top + r.bottom) / 2 - mid);
    if (d < bestDist) {
      bestDist = d;
      best = Number(el.dataset.chunk);
    }
  });
  return best;
}

export default function Session({ engine, onEnd }) {
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [quiz, setQuiz] = useState(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    engine.setTriggerHandler(setQuiz);
    return () => engine.setTriggerHandler(() => {});
  }, [engine]);

  useEffect(() => {
    const tickId = setInterval(() => engine.tick(), 1000);
    const onVisibility = () => (document.hidden ? engine.leave() : engine.comeBack());
    const onBlur = () => engine.leave();
    const onFocus = () => engine.comeBack();
    const onActivity = () => engine.activity();
    const onScroll = () => {
      engine.activity();
      const idx = nearestChunk();
      if (idx != null) engine.setCurrent(idx);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('scroll', onScroll, { passive: true });
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      clearInterval(tickId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('scroll', onScroll);
      ['mousemove', 'keydown', 'click', 'touchstart'].forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [engine]);

  const closeQuiz = () => {
    engine.closeQuiz();
    setQuiz(null);
  };
  const reread = (idx) => {
    closeQuiz();
    setFlash(idx);
    engine.setCurrent(idx);
    document.getElementById(`chunk-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setFlash(null), 1800);
  };

  const goalPct = Math.min(100, (snap.focused / snap.goalMs) * 100);

  return (
    <>
      <Bar>
        <div className="bar-trace">
          <Trace segments={snap.segments} totalMs={snap.total} height={14} label="Focus so far this session" />
          <div className="goal" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalPct)} aria-label="Focus goal progress">
            <div style={{ width: `${goalPct}%` }} />
          </div>
        </div>
        <span className="bar-goal">
          {fmt(snap.focused)} of {fmt(snap.goalMs)} focused
        </span>
      </Bar>

      <div className="shell session">
        <main className="reader">
          {snap.chunks.map((c, i) => (
            <Fragment key={i}>
              <article
                id={`chunk-${i}`}
                data-chunk={i}
                className={`chunk${snap.cur === i ? ' current' : ''}${flash === i ? ' flash' : ''}`}
                style={{ '--heat': `${Math.min(c.distractions * 30, 100)}%` }}
                onClick={() => engine.setCurrent(i)}
              >
                <span className="chunk-no">{i + 1}</span>
                <p>{c.text}</p>
                {c.distractions > 0 && (
                  <span className="chunk-flag">
                    {c.distractions} {c.distractions === 1 ? 'distraction' : 'distractions'} here
                  </span>
                )}
              </article>
              {quiz && quiz.idx === i && (
                <QuizCard key={quiz.id} quiz={quiz} engine={engine} chunkText={c.text} onClose={closeQuiz} onReread={() => reread(i)} />
              )}
            </Fragment>
          ))}
        </main>

        <aside className="rail">
          <div className={`status status-${snap.status}`}>
            <span className="dot" aria-hidden="true" />
            <b>{STATUS_LABEL[snap.status]}</b>
          </div>
          <dl className="facts">
            <div>
              <dt>Session</dt>
              <dd>{fmt(snap.total)}</dd>
            </div>
            <div>
              <dt>Reading chunk</dt>
              <dd>
                {snap.cur + 1} of {snap.chunks.length}
              </dd>
            </div>
            <div>
              <dt>Distractions</dt>
              <dd>{snap.distractions}</dd>
            </div>
            <div>
              <dt>Fragmented</dt>
              <dd>{snap.fragmented}</dd>
            </div>
            <div>
              <dt>Idle</dt>
              <dd>{snap.idleEvents}</dd>
            </div>
          </dl>

          {engine.cfg.demo && (
            <div className="demo">
              <h3>Demo controls</h3>
              <p className="muted small">Skip the wait. Switching real tabs works too.</p>
              <button className="btn btn-quiet" onClick={() => engine.simulateAway(engine.cfg.distractMs + 2000)}>
                Simulate a tab switch
              </button>
              <button className="btn btn-quiet" onClick={() => engine.simulateAway(engine.cfg.longMs + 5000)}>
                Simulate a long distraction
              </button>
              <button
                className="btn btn-quiet"
                onClick={() => {
                  for (let i = 0; i < engine.cfg.fragCount; i++) engine.simulateAway(1000);
                }}
              >
                Simulate quick switches
              </button>
            </div>
          )}

          <button className="btn" onClick={onEnd}>
            End session
          </button>
        </aside>
      </div>
    </>
  );
}
