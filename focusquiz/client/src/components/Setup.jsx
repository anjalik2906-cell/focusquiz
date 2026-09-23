import { useState } from 'react';
import Bar from './Bar.jsx';
import History from './History.jsx';
import { SAMPLE_TEXT } from '../lib/sample.js';
import { chunkText } from '../lib/chunker.js';
import { extractFile, fetchLink } from '../lib/api.js';

const MAX_COMFORTABLE_CHUNKS = 40;

export default function Setup({ health, history, onStart, onDeleted }) {
  const [text, setText] = useState('');
  const [goalMin, setGoalMin] = useState(25);
  const [demo, setDemo] = useState(true);
  const [error, setError] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [source, setSource] = useState({ busy: false, note: '', error: '' });

  const chunkCount = text.trim() ? chunkText(text.trim()).length : 0;

  // Run a loader, put the extracted text into the box, and report the outcome.
  const load = async (task, describe) => {
    setSource({ busy: true, note: '', error: '' });
    try {
      const result = await task();
      setText(result.text);
      setError('');
      setSource({ busy: false, note: describe(result), error: '' });
    } catch (err) {
      setSource({ busy: false, note: '', error: err.message });
    }
  };

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // lets the same file be picked again
    if (file) load(() => extractFile(file), (r) => `Loaded ${r.title}. Trim the text below if you only want part of it.`);
  };

  const onYoutube = () => {
    if (ytUrl.trim()) {
      load(() => fetchLink(ytUrl), (r) =>
        r.videoId
          ? 'Loaded the video transcript. Each block starts with its timestamp.'
          : `Loaded ${r.title}. Trim the text below if you only want part of it.`
      );
    }
  };

  const start = () => {
    if (text.trim().length < 80) {
      setError('Add some study material first: paste text, upload a file, load a YouTube link, or use the sample.');
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
            Paste your notes, upload a file, or load a link (YouTube video, article or web page). FocusQuiz splits it into chunks, notices when your
            attention leaves the tab, and quizzes you on the part you were on when you drifted.
          </p>

          <div className="sources">
            <label className="btn btn-quiet file-btn">
              Upload a file
              <input type="file" accept=".txt,.md,.pdf,.docx" onChange={onFile} disabled={source.busy} hidden />
            </label>
            <span className="muted small">.txt, .md, .pdf or .docx, up to 10 MB</span>
          </div>
          <div className="sources">
            <input
              type="text"
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onYoutube()}
              placeholder="Paste a link: YouTube video, article or web page"
              aria-label="Link"
            />
            <button className="btn btn-quiet" onClick={onYoutube} disabled={source.busy || !ytUrl.trim()}>
              Load link
            </button>
          </div>
          <p className="muted small" role="status">
            {source.busy && 'Loading...'}
            {source.note}
            {source.error && <span className="error">{source.error}</span>}
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
          {chunkCount > 0 && (
            <p className="muted small">
              {chunkCount} chunks.
              {chunkCount > MAX_COMFORTABLE_CHUNKS && ' That is a lot for one session. Delete the parts you will study later.'}
            </p>
          )}
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


        </section>

        <section className="setup-history">
          <h2>Recent sessions</h2>
                    <History history={history} onDeleted={onDeleted} />
        </section>
      </main>
    </>
  );
}