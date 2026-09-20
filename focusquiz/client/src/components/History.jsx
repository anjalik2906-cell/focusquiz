import Trace from './Trace.jsx';
import { fmt } from '../lib/format.js';

export default function History({ history }) {
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
            <span>
              {fmt(s.totalMs)} long, score <b>{s.focusScore}</b>
            </span>
          </div>
          <Trace segments={s.summary.segments || []} totalMs={s.totalMs} height={10} label="Session focus timeline" />
        </li>
      ))}
    </ul>
  );
}
