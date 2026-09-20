import { useState } from 'react';
import Bar from './Bar.jsx';
import History from './History.jsx';
import { SAMPLE_TEXT } from '../lib/sample.js';

export default function Setup({ health, history, onStart }) {
  const [text, setText] = useState('');
  const [goalMin, setGoalMin] = useState(25);
  const [demo, setDemo] = useState(true);
  const [error, setError] = useState('');

  const start = () => {
    if (text.trim().length < 80) {
      setError('Paste at least a few sentences, or load the sample text.');
      return;
    }
    setError('');
    onStart(text.trim(), { goalMin: Math.max(1, Number(goalMin) || 25), demo });
  };

  return (
    <>
      <Bar />
      <main className="shell setup">
        <section className="setup-main">
          <h1>What are you studying?</h1>
          <p className="lede">
            Paste your notes or a chapter. FocusQuiz splits them into chunks, notices when your attention leaves the tab,
            and quizzes you on the part you were reading when you drifted.
          </p>

          <label className="field">
            <span>Study text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste notes, a chapter or an article. Blank lines split it into chunks."
              rows={10}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="controls">
            <label className="field inline">
              <span>Focus goal (minutes)</span>
              <input type="number" min="1" max="240" value={goalMin} onChange={(e) => setGoalMin(e.target.value)} />
            </label>
            <label className="check">
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
              <span>
                Demo mode
                <small>Short timers and buttons that simulate distractions</small>
              </span>
            </label>
          </div>

          <div className="actions">
            <button className="btn" onClick={start}>
              Start session
            </button>
            <button className="btn btn-quiet" onClick={() => setText(SAMPLE_TEXT)}>
              Load sample text
            </button>
          </div>

          <p className="muted small">
            {health == null
              ? 'Checking the server...'
              : health.ai
                ? 'Questions are written by Claude. Only the chunk you were reading is sent to the AI.'
                : 'AI questions are off, so you will get local practice questions. Add ANTHROPIC_API_KEY on the server to turn them on.'}
          </p>
        </section>

        <section className="setup-history">
          <h2>Recent sessions</h2>
          <History history={history} />
        </section>
      </main>
    </>
  );
}
