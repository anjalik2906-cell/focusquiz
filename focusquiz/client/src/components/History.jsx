import { useState } from 'react';
import Trace from './Trace.jsx';
import { deleteSession } from '../lib/api.js';
import { fmt } from '../lib/format.js';

export default function History({ history, onDeleted }) {
  const [pending, setPending] = useState(null); // id awaiting a second click to confirm
  const [busy, setBusy] = useState(null); // id currently deleting

  const handleDelete = async (id) => {
    if (pending !== id) {
      setPending(id);
      return;
    }
    setBusy(id);
    try {
      await deleteSession(id);
      onDeleted(id);
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  if (history.status === 'loading') return <p className="muted">Loading your sessions...</p>;
  if (history.status === 'offline') {
    return <p className="muted">The server is not reachable, so past sessions cannot load. Start it with npm run dev.</p>;
  }
  if (!history.items.length) return <p className="muted">Finished sessions will appear here.</p>;

  return (
    <ul className="history">
      {history.items.map((s) => (
        <li key={s.id}>
          <div className="history-head">
            <span>{new Date(s.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
            <span className="history-right">
              {fmt(s.totalMs)} long, score <b>{s.focusScore}</b>
              <button
                className={`history-delete${pending === s.id ? ' confirm' : ''}`}
                onClick={() => handleDelete(s.id)}
                disabled={busy === s.id}
                aria-label={pending === s.id ? 'Click again to confirm delete' : 'Delete this session'}
                title={pending === s.id ? 'Click again to confirm' : 'Delete'}
              >
                {busy === s.id ? '...' : pending === s.id ? 'Confirm?' : '×'}
              </button>
            </span>
          </div>
          <Trace segments={s.summary.segments || []} totalMs={s.totalMs} height={10} label="Session focus timeline" />
        </li>
      ))}
    </ul>
  );
}