import { useEffect, useRef, useState } from 'react';
import { getQuestion } from '../lib/quizSource.js';
import { sameAnswer } from '../lib/localQuiz.js';
import { fmt } from '../lib/format.js';

export default function QuizCard({ quiz, engine, chunkText, onClose, onReread }) {
  const [q, setQ] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | asking | selfgrade | revealed
  const [result, setResult] = useState(null);
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    getQuestion(chunkText, quiz.tier, engine).then((next) => {
      if (alive) {
        setQ(next);
        setPhase('asking');
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [phase]);

  const finish = (ok) => {
    setResult(ok);
    setPhase('revealed');
    engine.grade(quiz.idx, ok, quiz.isRequiz);
  };
  const skip = () => {
    engine.grade(quiz.idx, null, quiz.isRequiz);
    onClose();
  };
  const pick = (i) => {
    setPicked(i);
    finish(i === q.correctIndex);
  };
  const submitBlank = (e) => {
    e.preventDefault();
    if (typed.trim()) finish(sameAnswer(typed, q.answer));
  };

  return (
    <section className="quiz" ref={ref} aria-live="polite">
      <div className="quiz-head">
        <h3>{quiz.label}</h3>
        <span className="muted small">
          {quiz.awayMs ? `You were away ${fmt(quiz.awayMs)}. ` : ''}
          {q ? (q.source === 'ai' ? 'AI question' : 'Practice question') : ''}
        </span>
      </div>

      {phase === 'loading' && <p className="muted">Writing a question from what you were reading...</p>}

      {q && (
        <>
          <p className="quiz-q">{q.question}</p>

          {phase === 'asking' && q.mode === 'mcq' && (
            <div className="options" role="group" aria-label="Answer choices">
              {q.options.map((o, i) => (
                <button key={i} className="option" onClick={() => pick(i)}>
                  {o}
                </button>
              ))}
            </div>
          )}

          {phase === 'asking' && q.mode === 'blank' && (
            <form className="blank" onSubmit={submitBlank}>
              <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your answer" aria-label="Your answer" />
              <button className="btn" type="submit">
                Check
              </button>
            </form>
          )}

          {phase === 'asking' && q.mode === 'open' && (
            <div className="blank">
              <textarea rows={2} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Answer in a sentence or two" aria-label="Your answer" />
              <button className="btn" onClick={() => setPhase('selfgrade')}>
                Show suggested answer
              </button>
            </div>
          )}

          {phase === 'selfgrade' && (
            <div>
              <p className="answer">
                <b>Suggested answer.</b> {q.answer}
              </p>
              <p className="muted small">{q.explanation}</p>
              <div className="actions">
                <button className="btn" onClick={() => finish(true)}>
                  I got it
                </button>
                <button className="btn btn-quiet" onClick={() => finish(false)}>
                  I missed it
                </button>
              </div>
            </div>
          )}

          {phase === 'revealed' && (
            <div>
              <p className={result ? 'verdict ok' : 'verdict bad'}>{result ? 'Correct.' : 'Not quite.'}</p>
              {q.mode === 'mcq' && !result && (
                <p className="answer">
                  <b>Answer.</b> {q.options[q.correctIndex]}
                </p>
              )}
              {q.mode === 'blank' && !result && (
                <p className="answer">
                  <b>Answer.</b> {q.answer}
                </p>
              )}
              {q.mode !== 'open' && <p className="muted small">{q.explanation}</p>}
              <div className="actions">
                {!result && (
                  <button className="btn" onClick={onReread}>
                    Re-read this chunk
                  </button>
                )}
                <button className={result ? 'btn' : 'btn btn-quiet'} onClick={onClose}>
                  Keep reading
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {(phase === 'asking' || phase === 'loading') && (
        <button className="skip" onClick={skip}>
          Skip
        </button>
      )}
    </section>
  );
}
